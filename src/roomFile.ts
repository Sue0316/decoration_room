import { FURNITURE_TYPES } from "../shared/schemas";
import type { Design, Item, Point } from "./types";

const FORMAT = "room-studio-room";

export function downloadRoom(name: string, design: Design) {
  const body = JSON.stringify({ format: FORMAT, version: 1, name, design }, null, 2);
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "room"}.room.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);

/** Reads a saved room file, keeping only well-formed values. Throws a readable message otherwise. */
export function parseRoomFile(text: string, fallbackName: string): { name: string; design: Design } {
  let data: { format?: unknown; name?: unknown; design?: Record<string, unknown> };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a room file.");
  }
  const d = data?.design;
  if (data?.format !== FORMAT || !d) throw new Error("This file isn't a room file.");

  const points = (Array.isArray(d.points) ? d.points : []).filter((p: Point) => num(p?.x) && num(p?.y)).map((p: Point) => ({ x: p.x, y: p.y }));
  if (points.length < 3) throw new Error("The room in this file has no usable outline.");

  const types: readonly string[] = FURNITURE_TYPES;
  const items: Item[] = (Array.isArray(d.items) ? d.items : [])
    .filter((i: Item) => types.includes(i?.type) && [i.x, i.y, i.w, i.d, i.h, i.rot].every(num))
    .map((i: Item, n: number) => ({
      id: typeof i.id === "string" && i.id ? i.id : `imported-${n}`,
      type: i.type,
      label: typeof i.label === "string" ? i.label.slice(0, 40) : i.type,
      x: i.x,
      y: i.y,
      w: i.w,
      d: i.d,
      h: i.h,
      rot: i.rot,
      color: hex(i.color, "#b9aea0"),
      ...(num(i.z) ? { z: i.z } : {}),
    }));

  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 40) : fallbackName;
  return {
    name,
    design: {
      points,
      height: num(d.height) && d.height >= 2 && d.height <= 6 ? d.height : 2.7,
      wallColor: hex(d.wallColor, "#ece6da"),
      floorColor: hex(d.floorColor, "#c9a97f"),
      wallFinish: typeof d.wallFinish === "string" ? d.wallFinish : undefined,
      floorFinish: typeof d.floorFinish === "string" ? d.floorFinish : undefined,
      items,
    },
  };
}
