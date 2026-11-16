import type { Brainstorm, BrainstormRequest, RoomAnalysis } from "../shared/schemas";

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the app server. Is `npm run dev` still running?");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `The server returned an error (${res.status}).`);
  return data as T;
}

export interface AnalyzeInput {
  image: string;
  mediaType: "image/jpeg";
  mode: "room" | "item";
  knownWidth?: number;
}

export const analyzePhoto = (input: AnalyzeInput) => post<RoomAnalysis>("/api/analyze", input);
export const brainstorm = (input: BrainstormRequest) => post<Brainstorm>("/api/brainstorm", input);

export async function aiConfigured(): Promise<boolean> {
  try {
    const res = await fetch("/api/status");
    return ((await res.json()) as { configured: boolean }).configured;
  } catch {
    return false;
  }
}

/** Shrinks a photo to the size the vision model uses and returns bare base64 JPEG. */
export async function prepareImage(file: File): Promise<{ base64: string; previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const previewUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: previewUrl.split(",")[1], previewUrl };
}
