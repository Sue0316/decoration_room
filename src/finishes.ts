type Ctx = CanvasRenderingContext2D;

/** w and h are the real size in metres of one repeat; draw works in those metres. */
interface Finish {
  label: string;
  w: number;
  h: number;
  draw(c: Ctx, color: string): void;
}

/** Stable pseudo-random value in -0.5..0.5, so a surface looks the same on every redraw. */
function noise(i: number, j: number) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s) - 0.5;
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Positive amounts move towards white, negative towards black. */
function shade(hex: string, amount: number) {
  const target = amount > 0 ? 255 : 0;
  const a = Math.min(1, Math.abs(amount));
  const [r, g, b] = rgb(hex).map((v) => Math.round(v + (target - v) * a));
  return `rgb(${r},${g},${b})`;
}

function isLight(hex: string) {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 165;
}

const grout = (color: string) => (isLight(color) ? shade(color, -0.3) : shade(color, 0.5));
const seam = (color: string) => shade(color, -0.5);

interface Grid {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  gap: number;
  vary: number;
  joint: string;
  stagger?: boolean;
}

function tiles(c: Ctx, color: string, g: Grid) {
  c.fillStyle = g.joint;
  c.fillRect(0, 0, g.cols * g.cw, g.rows * g.ch);
  for (let r = 0; r < g.rows; r++) {
    const shift = g.stagger && r % 2 ? g.cw / 2 : 0;
    for (let col = -1; col < g.cols; col++) {
      // Cells that wrap past the edge reuse the shade of their other half.
      c.fillStyle = shade(color, noise((col + g.cols) % g.cols, r) * g.vary);
      c.fillRect(col * g.cw + shift + g.gap / 2, r * g.ch + g.gap / 2, g.cw - g.gap, g.ch - g.gap);
    }
  }
}

const FINISHES = {
  plain: { label: "Plain", w: 1, h: 1, draw() {} },
  subway_tile: {
    label: "Subway tile",
    w: 0.8,
    h: 0.4,
    draw: (c, color) => tiles(c, color, { cols: 4, rows: 4, cw: 0.2, ch: 0.1, gap: 0.005, vary: 0.08, joint: grout(color), stagger: true }),
  },
  square_tile: {
    label: "Square tile",
    w: 0.8,
    h: 0.8,
    draw: (c, color) => tiles(c, color, { cols: 4, rows: 4, cw: 0.2, ch: 0.2, gap: 0.006, vary: 0.05, joint: grout(color) }),
  },
  mosaic_tile: {
    label: "Mosaic",
    w: 0.8,
    h: 0.8,
    draw: (c, color) => tiles(c, color, { cols: 16, rows: 16, cw: 0.05, ch: 0.05, gap: 0.005, vary: 0.25, joint: grout(color) }),
  },
  brick: {
    label: "Brick",
    w: 0.88,
    h: 0.6,
    draw: (c, color) => tiles(c, color, { cols: 4, rows: 8, cw: 0.22, ch: 0.075, gap: 0.012, vary: 0.22, joint: grout(color), stagger: true }),
  },
  wood_panel: {
    label: "Wood panel",
    w: 0.96,
    h: 2.4,
    draw: (c, color) => tiles(c, color, { cols: 8, rows: 1, cw: 0.12, ch: 2.4, gap: 0.006, vary: 0.14, joint: seam(color) }),
  },
  stripes: {
    label: "Striped paper",
    w: 0.3,
    h: 0.3,
    draw(c, color) {
      c.fillStyle = color;
      c.fillRect(0, 0, 0.3, 0.3);
      c.fillStyle = shade(color, -0.12);
      c.fillRect(0, 0, 0.15, 0.3);
    },
  },
  planks: {
    label: "Wood planks",
    w: 1.8,
    h: 1.44,
    draw: (c, color) => tiles(c, color, { cols: 1, rows: 8, cw: 1.8, ch: 0.18, gap: 0.005, vary: 0.2, joint: seam(color), stagger: true }),
  },
  parquet: {
    label: "Parquet",
    w: 0.6,
    h: 0.6,
    draw(c, color) {
      c.fillStyle = seam(color);
      c.fillRect(0, 0, 0.6, 0.6);
      const gap = 0.004;
      for (let bx = 0; bx < 2; bx++) {
        for (let by = 0; by < 2; by++) {
          for (let s = 0; s < 3; s++) {
            c.fillStyle = shade(color, noise(bx * 3 + s, by) * 0.24);
            const across = 0.1 * s + gap / 2;
            const along = gap / 2;
            const [x, y, w, h] = (bx + by) % 2 ? [along, across, 0.3 - gap, 0.1 - gap] : [across, along, 0.1 - gap, 0.3 - gap];
            c.fillRect(bx * 0.3 + x, by * 0.3 + y, w, h);
          }
        }
      }
    },
  },
  large_tile: {
    label: "Large tile",
    w: 1.2,
    h: 1.2,
    draw: (c, color) => tiles(c, color, { cols: 2, rows: 2, cw: 0.6, ch: 0.6, gap: 0.006, vary: 0.04, joint: grout(color) }),
  },
  small_tile: {
    label: "Small tile",
    w: 1.2,
    h: 1.2,
    draw: (c, color) => tiles(c, color, { cols: 4, rows: 4, cw: 0.3, ch: 0.3, gap: 0.006, vary: 0.06, joint: grout(color) }),
  },
  checker: {
    label: "Checker",
    w: 0.8,
    h: 0.8,
    draw(c, color) {
      c.fillStyle = color;
      c.fillRect(0, 0, 0.8, 0.8);
      c.fillStyle = shade(color, isLight(color) ? -0.65 : 0.7);
      c.fillRect(0, 0, 0.4, 0.4);
      c.fillRect(0.4, 0.4, 0.4, 0.4);
    },
  },
  carpet: {
    label: "Carpet",
    w: 0.4,
    h: 0.4,
    draw(c, color) {
      const n = 50;
      const cell = 0.4 / n;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          c.fillStyle = shade(color, noise(i, j) * 0.3);
          c.fillRect(i * cell, j * cell, cell, cell);
        }
      }
    },
  },
} satisfies Record<string, Finish>;

export type FinishId = keyof typeof FINISHES;

export const WALL_FINISHES: FinishId[] = ["plain", "subway_tile", "square_tile", "mosaic_tile", "brick", "wood_panel", "stripes"];
export const FLOOR_FINISHES: FinishId[] = ["plain", "planks", "parquet", "large_tile", "small_tile", "checker", "carpet"];

/** Saves made before finishes existed have none, and they count as plain. */
export const finishId = (id: string | undefined): FinishId => (id && id in FINISHES ? (id as FinishId) : "plain");

export const finishInfo = (id: FinishId): Finish => FINISHES[id];

/** Draws one repeat of the finish; the longer side of the canvas is `px` pixels. */
export function finishCanvas(id: FinishId, color: string, px: number) {
  const f: Finish = FINISHES[id];
  const scale = px / Math.max(f.w, f.h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(f.w * scale);
  canvas.height = Math.round(f.h * scale);
  const c = canvas.getContext("2d")!;
  c.fillStyle = color;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.scale(canvas.width / f.w, canvas.height / f.h);
  f.draw(c, color);
  return canvas;
}

const images = new Map<string, string>();

/** A cached picture of the finish, for the plan and the picker. */
export function finishImage(id: FinishId, color: string, px: number) {
  const key = `${id}|${color}|${px}`;
  let url = images.get(key);
  if (!url) {
    // Dragging a colour picker creates many one-off entries.
    if (images.size > 200) images.clear();
    url = finishCanvas(id, color, px).toDataURL();
    images.set(key, url);
  }
  return url;
}
