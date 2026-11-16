import type { RoomAnalysis, SuggestedItem } from "../shared/schemas";
import { defaultsFor, WALL_TYPES } from "./catalog";
import { clamp, normDeg, rectRoom, snapToWall } from "./geometry";
import type { Design, Item } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

const safeHex = (v: string, fallback: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : fallback);
const num = (v: number, fallback: number) => (Number.isFinite(v) ? v : fallback);
const size = (v: number, fallback: number) => clamp(num(v, fallback), 0.01, 8);

type Analysed = RoomAnalysis["items"][number];

function toItem(a: Analysed, x: number, y: number, rot: number): Item {
  const base = defaultsFor(a.type);
  return {
    id: uid(),
    type: a.type,
    label: a.label.slice(0, 40) || base.label,
    x,
    y,
    w: size(a.width_m, base.w),
    d: size(a.depth_m, base.d),
    h: size(a.height_m, base.h),
    rot: normDeg(num(rot, 0)),
    color: safeHex(a.color, base.color),
  };
}

/** Turns a validated model response into a design, keeping every piece within the walls. */
export function designFromAnalysis(a: RoomAnalysis): Design {
  const w = clamp(num(a.room.width_m, 5), 1.5, 30);
  const d = clamp(num(a.room.depth_m, 4), 1.5, 30);
  const points = rectRoom(w, d);
  const items = a.items.map((src) => {
    const x = clamp(num(src.x_m, w / 2), 0, w);
    const y = clamp(num(src.y_m, d / 2), 0, d);
    const it = toItem(src, x, y, src.rotation_deg);
    if (WALL_TYPES.includes(it.type)) return { ...it, ...snapToWall(it, points) };
    const r = (it.rot * Math.PI) / 180;
    const halfX = (Math.abs(Math.cos(r)) * it.w + Math.abs(Math.sin(r)) * it.d) / 2;
    const halfY = (Math.abs(Math.sin(r)) * it.w + Math.abs(Math.cos(r)) * it.d) / 2;
    it.x = halfX * 2 >= w ? w / 2 : clamp(it.x, halfX, w - halfX);
    it.y = halfY * 2 >= d ? d / 2 : clamp(it.y, halfY, d - halfY);
    return it;
  });
  return {
    points,
    height: clamp(num(a.room.height_m, 2.7), 2, 6),
    wallColor: safeHex(a.room.wall_color, "#ece6da"),
    floorColor: safeHex(a.room.floor_color, "#c9a97f"),
    items,
  };
}

/** A single analysed piece, placed at a given spot in the existing room. */
export function itemFromAnalysis(a: Analysed, x: number, y: number): Item {
  return toItem(a, x, y, 0);
}

export function itemFromSuggestion(s: SuggestedItem, x: number, y: number): Item {
  return toItem({ ...s, x_m: x, y_m: y, rotation_deg: 0 }, x, y, 0);
}
