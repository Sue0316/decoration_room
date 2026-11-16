import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import express from "express";
import type { Response } from "express";
import type { ZodType } from "zod";
import { ANALYZE_SYSTEM, analyzeTask, BRAINSTORM_SYSTEM, brainstormTask } from "../shared/prompts";
import { AnalyzeRequestSchema, BrainstormRequestSchema, BrainstormSchema, RoomAnalysisSchema } from "../shared/schemas";

try {
  process.loadEnvFile();
} catch {
  // No .env file; credentials may come from the environment.
}

const MODEL = "claude-opus-5-5";
const PORT = Number(process.env.PORT ?? 8787);
const hasCredentials = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | undefined;
const claude = () => (client ??= new Anthropic());

class UserFacingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function ask<T>(schema: ZodType<T>, effort: "medium" | "high", system: string, content: Anthropic.Beta.Messages.BetaContentBlockParam[]): Promise<T> {
  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new UserFacingError(422, "The AI declined this request. Try a different photo or description.");
  if (response.stop_reason === "max_tokens") throw new UserFacingError(502, "The AI's answer was cut off. Please try again.");
  if (!response.parsed_output) throw new UserFacingError(502, "The AI's answer couldn't be read. Please try again.");
  return response.parsed_output as T;
}

function sendError(res: Response, error: unknown) {
  console.error(error);
  if (error instanceof UserFacingError) return res.status(error.status).json({ error: error.message });
  if (!hasCredentials()) return res.status(503).json({ error: "AI isn't set up yet. Add ANTHROPIC_API_KEY to a .env file in the project folder and restart the server." });
  if (error instanceof Anthropic.AuthenticationError) return res.status(401).json({ error: "The API key was rejected. Check ANTHROPIC_API_KEY in .env and restart the server." });
  if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Too many AI requests right now. Wait a moment and try again." });
  if (error instanceof Anthropic.BadRequestError) return res.status(400).json({ error: `The AI service rejected the request: ${error.message}` });
  if (error instanceof Anthropic.APIConnectionError) return res.status(502).json({ error: "Couldn't reach the AI service. Check your connection." });
  if (error instanceof Anthropic.APIError) return res.status(502).json({ error: "The AI service had a problem. Please try again." });
  return res.status(500).json({ error: "Something went wrong on the server." });
}

const app = express();
app.use(express.json({ limit: "12mb" }));

app.get("/api/status", (_req, res) => {
  res.json({ configured: hasCredentials() });
});

app.post("/api/analyze", async (req, res) => {
  const input = AnalyzeRequestSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "That image upload wasn't valid." });
  const { image, mediaType, mode, knownWidth } = input.data;

  try {
    const result = await ask(RoomAnalysisSchema, "high", ANALYZE_SYSTEM, [
      { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
      { type: "text", text: analyzeTask(mode, knownWidth) },
    ]);
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/api/brainstorm", async (req, res) => {
  const input = BrainstormRequestSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: "The room data wasn't valid." });

  try {
    const result = await ask(BrainstormSchema, "medium", BRAINSTORM_SYSTEM, [{ type: "text", text: brainstormTask(input.data) }]);
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

// `npm run build` output is served here for `npm start`.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
app.use(express.static(dist));

app.listen(PORT, "127.0.0.1", () => {
  console.log(`API on http://localhost:${PORT} (AI ${hasCredentials() ? "ready" : "needs ANTHROPIC_API_KEY in .env"})`);
});
