import { useState } from "react";
import type { ZodType } from "zod";

interface Props<T> {
  getPrompt(): string;
  schema: ZodType<T>;
  /** Extra instruction for the step in the chat, e.g. attaching a photo. */
  chatStep: string;
  importLabel: string;
  onImport(value: T): void;
}

/** Pulls the JSON object out of a chat reply, which may be wrapped in a code block or prose. */
function readReply<T>(text: string, schema: ZodType<T>): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON found. Copy the whole reply from the chat, including the code block.");
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("The reply looks cut off or incomplete. Ask the chat to send the full JSON again.");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error("The reply doesn't match what the app expects. Copy a fresh prompt and try again.");
  return parsed.data;
}

export function ChatBridge<T>({ getPrompt, schema, chatStep, importLabel, onImport }: Props<T>) {
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  const copy = async () => {
    const prompt = getPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setManual("");
      setCopied(true);
    } catch {
      setCopied(false);
      setManual(prompt);
    }
  };

  const importReply = () => {
    try {
      onImport(readReply(reply, schema));
      setError("");
      setReply("");
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ol className="bridge">
      <li>
        <button onClick={copy}>{copied ? "Prompt copied" : "Copy prompt"}</button>
        {manual && <textarea readOnly rows={4} value={manual} aria-label="Prompt to copy by hand" onFocus={(e) => e.target.select()} />}
      </li>
      <li>
        <span>
          Open{" "}
          <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
            your Claude chat
          </a>
          , paste the prompt{chatStep}, and send it.
        </span>
      </li>
      <li>
        <textarea rows={4} value={reply} placeholder="Paste the chat's reply here" aria-label="Chat reply" onChange={(e) => setReply(e.target.value)} />
        <button className="primary" disabled={!reply.trim()} onClick={importReply}>
          {importLabel}
        </button>
        {error && <p className="error">{error}</p>}
      </li>
    </ol>
  );
}
