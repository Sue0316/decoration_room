import { useState } from "react";
import { ANALYZE_SYSTEM, analyzeTask, chatPrompt } from "../../shared/prompts";
import { RoomAnalysisSchema } from "../../shared/schemas";
import type { RoomAnalysis } from "../../shared/schemas";
import { analyzePhoto, prepareImage } from "../api";
import { ChatBridge } from "./ChatBridge";

type Mode = "room" | "item";

interface Props {
  configured: boolean;
  onResult(result: RoomAnalysis, mode: Mode): void;
}

export function PhotoPanel({ configured, onResult }: Props) {
  const [mode, setMode] = useState<Mode>("room");
  const [photo, setPhoto] = useState<{ base64: string; previewUrl: string } | null>(null);
  const [width, setWidth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<RoomAnalysis | null>(null);

  const knownWidth = Number(width) > 0 ? Number(width) : undefined;

  const accept = (result: RoomAnalysis) => {
    if (mode === "item" && result.items.length === 0) throw new Error("No furniture was recognised in that photo.");
    onResult(result, mode);
    setDone(result);
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setDone(null);
    try {
      setPhoto(await prepareImage(file));
    } catch {
      setError("That file couldn't be opened as an image. Try a JPEG, PNG or WebP.");
    }
  };

  const run = async () => {
    if (!photo) return;
    setBusy(true);
    setError("");
    setDone(null);
    try {
      accept(await analyzePhoto({ image: photo.base64, mediaType: "image/jpeg", mode, knownWidth }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="muted">
        Claude estimates the layout, sizes and colours from your photo, then the app rebuilds it from editable 3D shapes. It's a close
        approximation, not a scan.
      </p>

      <div className="seg wide">
        <button className={mode === "room" ? "on" : ""} onClick={() => setMode("room")}>
          Whole room
        </button>
        <button className={mode === "item" ? "on" : ""} onClick={() => setMode("item")}>
          One piece
        </button>
      </div>

      <label className="field">
        <span>{mode === "room" ? "Room width" : "Item width"}, if you know it (m)</span>
        <input type="number" min="0.1" step="0.1" value={width} placeholder="Optional, improves scale" onChange={(e) => setWidth(e.target.value)} />
      </label>

      {configured ? (
        <>
          <label
            className={`drop${photo ? " has" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(e.dataTransfer.files[0]);
            }}
          >
            <input type="file" accept="image/*" data-testid="photo-input" onChange={(e) => choose(e.target.files?.[0])} />
            {photo ? <img src={photo.previewUrl} alt="Your upload" /> : <span>Choose a photo or drop it here</span>}
          </label>
          <button className="primary" disabled={!photo || busy} onClick={run}>
            {busy ? "Analysing, usually under a minute…" : mode === "room" ? "Build 3D room" : "Add to my room"}
          </button>
        </>
      ) : (
        <ChatBridge
          getPrompt={() => chatPrompt(ANALYZE_SYSTEM, analyzeTask(mode, knownWidth), RoomAnalysisSchema)}
          schema={RoomAnalysisSchema}
          chatStep=", attach your photo"
          importLabel={mode === "room" ? "Build 3D room" : "Add to my room"}
          onImport={accept}
        />
      )}
      {mode === "room" && <p className="muted small">This replaces the current room. Undo brings it back.</p>}

      {error && <p className="error">{error}</p>}
      {done && (
        <div className="result">
          <strong>{mode === "room" ? `Built: ${done.style}` : `Added: ${done.items[0]?.label}`}</strong>
          <p>{mode === "room" ? `${done.items.length} pieces placed. ${done.notes}` : done.notes}</p>
        </div>
      )}
    </>
  );
}
