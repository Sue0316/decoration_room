import { useRef, useState } from "react";
import { downloadRoom, parseRoomFile } from "../roomFile";
import type { Design } from "../types";
import type { SavedRoom } from "../useDesign";

type Naming = "new" | "copy" | "rename";

interface Props {
  rooms: SavedRoom[];
  activeId: string;
  saved: boolean;
  design: Design;
  onImport(name: string, design: Design): void;
  onSwitch(id: string): void;
  onCreate(name: string): void;
  onCopy(name: string): void;
  onRename(name: string): void;
  onDelete(): void;
}

const LABELS: Record<Naming, string> = { new: "Create", copy: "Save copy", rename: "Rename" };

export function RoomBar({ rooms, activeId, saved, design, onImport, onSwitch, onCreate, onCopy, onRename, onDelete }: Props) {
  const [naming, setNaming] = useState<Naming | null>(null);
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const active = rooms.find((r) => r.id === activeId);

  const importFile = async (file: File) => {
    try {
      const room = parseRoomFile(await file.text(), file.name.replace(/(\.room)?\.json$/i, ""));
      onImport(room.name, room.design);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "This file couldn't be read.");
    }
  };

  const start = (mode: Naming) => {
    setNaming(mode);
    setText(mode === "rename" ? (active?.name ?? "") : mode === "copy" ? `${active?.name} copy` : `Room ${rooms.length + 1}`);
  };

  const submit = () => {
    const name = text.trim();
    if (!name) return;
    if (naming === "new") onCreate(name);
    else if (naming === "copy") onCopy(name);
    else onRename(name);
    setNaming(null);
  };

  if (naming) {
    return (
      <form
        className="roombar"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          autoFocus
          aria-label="Room name"
          maxLength={40}
          value={text}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setNaming(null)}
        />
        <button type="submit" disabled={!text.trim()}>
          {LABELS[naming]}
        </button>
        <button type="button" onClick={() => setNaming(null)}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="roombar">
      <select aria-label="Room" value={activeId} onChange={(e) => onSwitch(e.target.value)}>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <button onClick={() => start("new")}>New room</button>
      <button onClick={() => start("rename")}>Rename</button>
      <button onClick={() => start("copy")}>Save a copy</button>
      <button
        disabled={rooms.length < 2}
        title={rooms.length < 2 ? "You need at least one room" : undefined}
        onClick={() => {
          if (window.confirm(`Delete "${active?.name}"? This can't be undone.`)) onDelete();
        }}
      >
        Delete
      </button>
      <button title="Download this room as a file" onClick={() => downloadRoom(active?.name ?? "room", design)}>
        Export
      </button>
      <button title="Open a room file as a new room" onClick={() => fileRef.current?.click()}>
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        data-testid="import-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) importFile(file);
        }}
      />
      <span className={saved ? "saved" : "saved failed"} data-testid="save-state">
        {saved ? "Saved" : "Not saved: browser storage is full or blocked"}
      </span>
    </div>
  );
}
