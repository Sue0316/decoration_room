import { LAYER_TYPES, WALL_TYPES } from "./catalog";
import type { Design, Item, Point } from "./types";

export const round = (v: number, step: number) => Math.round(v / step) * step;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function signedArea(p: Point[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return a / 2;
}

export const area = (p: Point[]) => Math.abs(signedArea(p));

export function bounds(p: Point[]) {
  const xs = p.map((v) => v.x);
  const ys = p.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
}

export function centroid(p: Point[]): Point {
  const b = bounds(p);
  const c = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  if (inside(c, p)) return c;
  // Concave rooms can have a bounding-box centre outside the walls.
  const avg = {
    x: p.reduce((s, v) => s + v.x, 0) / p.length,
    y: p.reduce((s, v) => s + v.y, 0) / p.length,
  };
  return inside(avg, p) ? avg : { x: p[0].x + 0.5, y: p[0].y + 0.5 };
}

export function inside(pt: Point, poly: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** True when no two walls cross and every wall has length. */
export function isSimple(p: Point[]): boolean {
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.2) return false;
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      if (segmentsCross(a, b, p[j], p[(j + 1) % p.length])) return false;
    }
  }
  return true;
}

export function nearestWall(pt: Point, poly: Point[]) {
  let best = { index: 0, dist: Infinity, x: poly[0].x, y: poly[0].y };
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = clamp(((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const dist = Math.hypot(pt.x - x, pt.y - y);
    if (dist < best.dist) best = { index: i, dist, x, y };
  }
  return best;
}

/** Puts a point on the closest wall, with rotation turning the item's front into the room. */
export function snapToWall(pt: Point, poly: Point[]) {
  const wall = nearestWall(pt, poly);
  const a = poly[wall.index];
  const b = poly[(wall.index + 1) % poly.length];
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const rad = (deg * Math.PI) / 180;
  const front = { x: wall.x - Math.sin(rad) * 0.05, y: wall.y + Math.cos(rad) * 0.05 };
  return { x: wall.x, y: wall.y, rot: inside(front, poly) ? normDeg(deg) : normDeg(deg + 180) };
}

export const normDeg = (d: number) => ((d % 360) + 360) % 360;

export function resnapWallItems(design: Design): Design {
  return {
    ...design,
    items: design.items.map((it) => (WALL_TYPES.includes(it.type) ? { ...it, ...snapToWall(it, design.points) } : it)),
  };
}

/** Corners on the plan of a rectangle given in the item's own coordinates. */
function rectCorners(it: Item, cx: number, cy: number, w: number, d: number): Point[] {
  const r = (it.rot * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([u, v]) => {
    const lx = cx + (u * w) / 2;
    const ly = cy + (v * d) / 2;
    return { x: it.x + lx * c - ly * s, y: it.y + lx * s + ly * c };
  });
}

export function corners(it: Item): Point[] {
  return rectCorners(it, 0, 0, it.w, it.d);
}

/** Seat depth of a U-shaped sofa: its back section and both returns. */
export const uSeat = (w: number, d: number) => Math.min(0.85, w * 0.3, d * 0.45);

/** A U-shaped sofa's outline in its own coordinates, open at the front (+y). */
export function uOutline(w: number, d: number): Point[] {
  const s = uSeat(w, d);
  return [
    [-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [w / 2 - s, d / 2], [w / 2 - s, -d / 2 + s],
    [-w / 2 + s, -d / 2 + s], [-w / 2 + s, d / 2], [-w / 2, d / 2],
  ].map(([x, y]) => ({ x, y }));
}

/** The rectangles an item really occupies, so a table can stand inside a U-shaped sofa. */
export function footprints(it: Item): Point[][] {
  if (it.type !== "u_sofa") return [corners(it)];
  const s = uSeat(it.w, it.d);
  return [
    rectCorners(it, 0, -it.d / 2 + s / 2, it.w, s),
    rectCorners(it, -it.w / 2 + s / 2, s / 2, s, it.d - s),
    rectCorners(it, it.w / 2 - s / 2, s / 2, s, it.d - s),
  ];
}

function overlaps(a: Point[], b: Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 2; i++) {
      const nx = poly[i + 1].y - poly[i].y;
      const ny = poly[i].x - poly[i + 1].x;
      const project = (ps: Point[]) => ps.map((p) => p.x * nx + p.y * ny);
      const pa = project(a);
      const pb = project(b);
      const gap = 1e-3;
      if (Math.max(...pa) <= Math.min(...pb) + gap || Math.max(...pb) <= Math.min(...pa) + gap) return false;
    }
  }
  return true;
}

/** Ids of items that poke through a wall or collide with another piece. */
export function findProblems(design: Design): Set<string> {
  const bad = new Set<string>();
  const solid = design.items.filter((i) => !WALL_TYPES.includes(i.type));
  const rects = new Map(solid.map((i) => [i.id, footprints(i)]));
  for (const it of solid) {
    if (it.type === "pendant_lamp") {
      if (!inside(it, design.points)) bad.add(it.id);
      continue;
    }
    // A corner resting exactly on a wall should not count as outside.
    const c = rects.get(it.id)!.flat();
    const out = c.some((p) => !inside(p, design.points) && nearestWall(p, design.points).dist > 0.02);
    if (out) bad.add(it.id);
  }
  const blockers = solid.filter((i) => !LAYER_TYPES.includes(i.type));
  const clash = (a: Point[][], b: Point[][]) => a.some((pa) => b.some((pb) => overlaps(pa, pb)));
  for (let i = 0; i < blockers.length; i++) {
    for (let j = i + 1; j < blockers.length; j++) {
      if (clash(rects.get(blockers[i].id)!, rects.get(blockers[j].id)!)) {
        bad.add(blockers[i].id);
        bad.add(blockers[j].id);
      }
    }
  }
  return bad;
}

const COWHIDE_HALF: [number, number][] = [
  [0, -1], [0.2, -0.95], [0.32, -0.72], [0.72, -0.86], [0.98, -0.8], [0.66, -0.48], [0.58, -0.1],
  [0.6, 0.35], [0.72, 0.55], [1, 0.82], [0.62, 0.8], [0.36, 0.72], [0.16, 0.96], [0, 1],
];

/** Patches on a cowhide as [x, y, radiusX, radiusY], in the same -1..1 units as its outline. */
export const COWHIDE_SPOTS: [number, number, number, number][] = [
  [-0.18, -0.5, 0.26, 0.18],
  [0.24, 0.05, 0.26, 0.32],
  [-0.28, 0.38, 0.22, 0.28],
  [0.2, 0.62, 0.14, 0.13],
  [-0.38, -0.08, 0.14, 0.16],
  [0.4, -0.42, 0.14, 0.1],
];

/** A smoothed, symmetrical hide outline for a piece of size w by d, centred on 0,0. */
export function cowhideOutline(w: number, d: number): Point[] {
  const mirrored = COWHIDE_HALF.slice(1, -1).reverse().map(([x, y]): [number, number] => [-x, y]);
  let pts = [...COWHIDE_HALF, ...mirrored];
  for (let pass = 0; pass < 2; pass++) {
    pts = pts.flatMap(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      return [
        [x * 0.75 + nx * 0.25, y * 0.75 + ny * 0.25],
        [x * 0.25 + nx * 0.75, y * 0.25 + ny * 0.75],
      ] as [number, number][];
    });
  }
  return pts.map(([x, y]) => ({ x: (x * w) / 2, y: (y * d) / 2 }));
}

export const rectRoom = (w: number, d: number): Point[] => [
  { x: 0, y: 0 },
  { x: w, y: 0 },
  { x: w, y: d },
  { x: 0, y: d },
];

export const lRoom = (w: number, d: number): Point[] => {
  const nx = round(w * 0.55, 0.1);
  const ny = round(d * 0.55, 0.1);
  return [
    { x: 0, y: 0 },
    { x: nx, y: 0 },
    { x: nx, y: ny },
    { x: w, y: ny },
    { x: w, y: d },
    { x: 0, y: d },
  ];
};
