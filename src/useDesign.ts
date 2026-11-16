import { useCallback, useEffect, useRef, useState } from "react";
import { uid } from "./aiImport";
import { rectRoom } from "./geometry";
import type { Design } from "./types";

const KEY = "room-studio-rooms-v1";
/** Where the app kept its single design before named rooms existed. */
const LEGACY_KEY = "room-studio-design-v1";
const HISTORY = 60;

export interface SavedRoom {
  id: string;
  name: string;
  design: Design;
}

interface Library {
  activeId: string;
  rooms: SavedRoom[];
}

export const emptyDesign = (): Design => ({
  points: rectRoom(5, 4),
  height: 2.7,
  wallColor: "#ece6da",
  floorColor: "#c9a97f",
  items: [],
});

const isDesign = (d: Design | undefined): d is Design => Array.isArray(d?.points) && d.points.length >= 3 && Array.isArray(d.items);

function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const lib = JSON.parse(raw) as Library;
      const rooms = lib.rooms.filter((r) => isDesign(r.design));
      if (rooms.length) return { rooms, activeId: rooms.some((r) => r.id === lib.activeId) ? lib.activeId : rooms[0].id };
    }
  } catch {
    // Fall through to the older format or a blank room.
  }
  let design = emptyDesign();
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null") as Design | null;
    if (legacy && isDesign(legacy)) design = legacy;
  } catch {
    // Unreadable storage just means starting fresh.
  }
  const id = uid();
  return { activeId: id, rooms: [{ id, name: "My room", design }] };
}

export function useDesign() {
  const [initial] = useState(loadLibrary);
  const [rooms, setRooms] = useState(initial.rooms);
  const [activeId, setActiveId] = useState(initial.activeId);
  const [design, setDesign] = useState<Design>(() => initial.rooms.find((r) => r.id === initial.activeId)!.design);
  const [saved, setSaved] = useState(true);
  const current = useRef(design);
  current.current = design;
  const past = useRef<Design[]>([]);
  const future = useRef<Design[]>([]);
  const [, bump] = useState(0);

  useEffect(() => {
    const library: Library = { activeId, rooms: rooms.map((r) => (r.id === activeId ? { ...r, design } : r)) };
    try {
      localStorage.setItem(KEY, JSON.stringify(library));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [design, rooms, activeId]);

  /** Records the present state as an undo point. Call once at the start of a drag. */
  const checkpoint = useCallback(() => {
    past.current = [...past.current.slice(-HISTORY + 1), current.current];
    future.current = [];
    bump((n) => n + 1);
  }, []);

  /** Live update with no undo point; use between checkpoint() and the end of a drag. */
  const patch = useCallback((fn: (d: Design) => Design) => {
    const next = fn(current.current);
    current.current = next;
    setDesign(next);
  }, []);

  /** A discrete, undoable edit. */
  const commit = useCallback(
    (fn: (d: Design) => Design) => {
      checkpoint();
      patch(fn);
    },
    [checkpoint, patch],
  );

  const undo = useCallback(() => {
    const prev = past.current.at(-1);
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [current.current, ...future.current];
    current.current = prev;
    setDesign(prev);
  }, []);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next) return;
    future.current = rest;
    past.current = [...past.current, current.current];
    current.current = next;
    setDesign(next);
  }, []);

  const roomsWithCurrent = () => rooms.map((r) => (r.id === activeId ? { ...r, design: current.current } : r));

  /** Undo history belongs to one editing session of one room, so it resets here. */
  const open = (id: string, list: SavedRoom[]) => {
    const target = list.find((r) => r.id === id)!;
    past.current = [];
    future.current = [];
    current.current = target.design;
    setRooms(list);
    setActiveId(id);
    setDesign(target.design);
  };

  const switchRoom = (id: string) => {
    if (id !== activeId) open(id, roomsWithCurrent());
  };

  const createRoom = (name: string) => {
    const room = { id: uid(), name, design: emptyDesign() };
    open(room.id, [...roomsWithCurrent(), room]);
  };

  const copyRoom = (name: string) => {
    const room = { id: uid(), name, design: structuredClone(current.current) };
    open(room.id, [...roomsWithCurrent(), room]);
  };

  const renameRoom = (name: string) => setRooms((list) => list.map((r) => (r.id === activeId ? { ...r, name } : r)));

  const deleteRoom = () => {
    const remaining = roomsWithCurrent().filter((r) => r.id !== activeId);
    if (remaining.length) open(remaining[0].id, remaining);
  };

  return {
    design,
    patch,
    commit,
    checkpoint,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    rooms,
    activeId,
    saved,
    switchRoom,
    createRoom,
    copyRoom,
    renameRoom,
    deleteRoom,
  };
}
