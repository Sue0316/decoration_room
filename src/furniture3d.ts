import * as THREE from "three";
import { SURFACE_TYPES } from "./catalog";
import { corners, COWHIDE_SPOTS, cowhideOutline, inside, uSeat } from "./geometry";
import type { Item } from "./types";

export const WINDOW_SILL = 0.9;
const WHITE =new THREE.Color("#ffffff");
const WOOD = new THREE.Color("#7a5a3e");
const METAL = new THREE.Color("#3a3a3c");
const LINEN = new THREE.Color("#f3eee4");

/** Builds a piece centred on its footprint, standing on y=0, with its front towards +z. */
export function buildFurniture(item: Item): THREE.Group {
  const g = new THREE.Group();
  const { w, d, h } = item;
  const c = new THREE.Color(item.color);
  const dark = c.clone().multiplyScalar(0.72);
  const light = c.clone().lerp(WHITE, 0.32);

  const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, col: THREE.Color, extra?: Partial<THREE.MeshStandardMaterialParameters>) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.75, ...extra }));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  /** y is the bottom of the box. */
  const box = (bw: number, bh: number, bd: number, x: number, y: number, z: number, col = c, extra?: Partial<THREE.MeshStandardMaterialParameters>) =>
    add(new THREE.BoxGeometry(bw, bh, bd), x, y + bh / 2, z, col, extra);
  const cyl = (top: number, bottom: number, ch: number, x: number, y: number, z: number, col = c, extra?: Partial<THREE.MeshStandardMaterialParameters>) =>
    add(new THREE.CylinderGeometry(top, bottom, ch, 24), x, y + ch / 2, z, col, extra);
  const legs = (lw: number, lh: number, lx: number, lz: number, col = WOOD) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(lw, lh, lw, sx * lx, 0, sz * lz, col);
  };

  switch (item.type) {
    case "bed": {
      const frameH = h * 0.3;
      box(w, frameH, d, 0, 0, 0, dark);
      box(w * 0.97, h * 0.26, d * 0.96, 0, frameH, 0.01, LINEN);
      box(w * 1.0, h * 0.06, d * 0.62, 0, frameH + h * 0.26, d * 0.19, c);
      box(w, h, 0.07, 0, 0, -d / 2 + 0.035, dark);
      const pillows = w > 1.2 ? [-w / 4, w / 4] : [0];
      for (const px of pillows) box(Math.min(0.62, w * 0.42), 0.13, 0.4, px, frameH + h * 0.26, -d / 2 + 0.32, WHITE);
      break;
    }
    case "sofa":
    case "armchair": {
      const arm = Math.min(0.2, w * 0.12);
      const seatY = h * 0.27;
      const seatH = h * 0.26;
      const backD = d * 0.24;
      box(w, seatY, d, 0, 0.05, 0, dark);
      box(w, h - 0.05, backD, 0, 0.05, -d / 2 + backD / 2);
      for (const s of [-1, 1]) box(arm, h * 0.72 - 0.05, d, s * (w / 2 - arm / 2), 0.05, 0);
      const inner = w - arm * 2;
      const cushions = item.type === "sofa" ? Math.max(2, Math.round(inner / 0.75)) : 1;
      const cw = inner / cushions;
      for (let i = 0; i < cushions; i++) {
        box(cw - 0.02, seatH * 0.72, d - backD - 0.02, -inner / 2 + cw * (i + 0.5), seatY + 0.05, backD / 2, light);
      }
      legs(0.05, 0.05, w / 2 - 0.08, d / 2 - 0.08);
      break;
    }
    case "chair": {
      const seat = h * 0.53;
      legs(0.035, seat - 0.04, w / 2 - 0.04, d / 2 - 0.04, dark);
      box(w, 0.04, d, 0, seat - 0.04, 0);
      box(w, h - seat, 0.035, 0, seat, -d / 2 + 0.02, dark);
      break;
    }
    case "stool":
      cyl(w / 2, w / 2, 0.05, 0, h - 0.05, 0);
      legs(0.03, h - 0.05, w / 3.2, d / 3.2, dark);
      break;
    case "dining_table":
    case "coffee_table":
    case "desk":
    case "side_table": {
      const top = item.type === "coffee_table" ? 0.04 : 0.035;
      box(w, top, d, 0, h - top, 0);
      legs(0.05, h - top, w / 2 - 0.06, d / 2 - 0.06, dark);
      if (item.type === "desk") box(w * 0.3, h * 0.72, d * 0.86, w / 2 - w * 0.17, h * 0.26 - top, 0, dark);
      if (item.type === "side_table") box(w * 0.9, h * 0.32, d * 0.9, 0, h * 0.58, 0, light);
      break;
    }
    case "wardrobe": {
      box(w, h, d, 0, 0, 0);
      const doors = Math.max(2, Math.round(w / 0.55));
      const dw = w / doors;
      for (let i = 0; i < doors; i++) {
        const dx = -w / 2 + dw * (i + 0.5);
        box(dw - 0.015, h - 0.1, 0.015, dx, 0.06, d / 2 + 0.005, light);
        box(0.015, 0.2, 0.02, dx + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), h / 2, d / 2 + 0.02, METAL);
      }
      break;
    }
    case "dresser": {
      box(w, h - 0.08, d, 0, 0.08, 0);
      legs(0.05, 0.08, w / 2 - 0.05, d / 2 - 0.05, dark);
      const rows = Math.max(3, Math.round(h / 0.24));
      const rh = (h - 0.12) / rows;
      for (let i = 0; i < rows; i++) {
        box(w - 0.04, rh - 0.02, 0.012, 0, 0.1 + i * rh, d / 2 + 0.004, light);
        cyl(0.012, 0.012, 0.02, 0, 0.1 + i * rh + rh / 2 - 0.01, d / 2 + 0.02, METAL);
      }
      break;
    }
    case "bookshelf": {
      box(w, h, 0.015, 0, 0, -d / 2 + 0.008, dark);
      for (const s of [-1, 1]) box(0.025, h, d, s * (w / 2 - 0.012), 0, 0);
      const shelves = Math.max(3, Math.round(h / 0.38));
      const palette = ["#b5654a", "#50708c", "#d6b56b", "#6b8f71", "#e8e0d2"];
      for (let i = 0; i <= shelves; i++) {
        const sy = (i * (h - 0.025)) / shelves;
        box(w, 0.025, d, 0, sy, 0);
        if (i === shelves) break;
        let bx = -w / 2 + 0.05;
        let n = i * 3;
        while (bx < w / 2 - 0.16) {
          const bw = 0.03 + ((n * 7) % 4) * 0.012;
          const bh = 0.17 + ((n * 5) % 5) * 0.02;
          box(bw, bh, d * 0.7, bx + bw / 2, sy + 0.025, 0, new THREE.Color(palette[n % palette.length]));
          bx += bw + 0.005;
          n++;
          if ((n + i) % 11 === 0) bx += 0.14;
        }
      }
      break;
    }
    case "tv_stand": {
      box(w, h - 0.08, d, 0, 0.08, 0);
      legs(0.04, 0.08, w / 2 - 0.06, d / 2 - 0.05, METAL);
      const tvW = w * 0.8;
      const tvH = tvW * 0.56;
      box(0.3, 0.04, 0.18, 0, h, 0, METAL);
      box(tvW, tvH, 0.04, 0, h + 0.07, 0, new THREE.Color("#141416"), { roughness: 0.25 });
      break;
    }
    case "floor_lamp":
      cyl(0.14, 0.14, 0.03, 0, 0, 0, METAL);
      cyl(0.012, 0.012, h - 0.3, 0, 0.03, 0, METAL);
      cyl(w * 0.34, w / 2, 0.28, 0, h - 0.28, 0, c, { emissive: c, emissiveIntensity: 0.55 });
      break;
    case "pendant_lamp": {
      // h is the drop; the caller lifts the group to ceiling height.
      cyl(0.006, 0.006, h, 0, 0, 0, METAL);
      add(new THREE.SphereGeometry(w / 2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0, -w / 2 + 0.02, 0, c, {
        side: THREE.DoubleSide,
        emissive: c,
        emissiveIntensity: 0.55,
      });
      break;
    }
    case "plant": {
      const potH = h * 0.24;
      const r = Math.min(w, d) * 0.34;
      cyl(r, r * 0.76, potH, 0, 0, 0, new THREE.Color("#c9a68a"));
      cyl(0.016, 0.022, h * 0.5, 0, potH, 0, WOOD);
      const blobs: [number, number, number, number][] = [
        [0, 0.72, 0, 0.5],
        [0.26, 0.62, 0.12, 0.34],
        [-0.24, 0.66, -0.14, 0.36],
        [0.08, 0.92, -0.14, 0.34],
        [-0.1, 0.58, 0.26, 0.3],
      ];
      blobs.forEach(([bx, by, bz, br], i) =>
        add(new THREE.IcosahedronGeometry(w * br, 1), bx * w, by * h, bz * w, i % 2 ? dark : c, { flatShading: true }),
      );
      break;
    }
    case "rug": {
      box(w, Math.max(h, 0.012), d, 0, 0, 0);
      box(w * 0.86, Math.max(h, 0.012) + 0.002, d * 0.82, 0, 0, 0, light);
      box(w * 0.72, Math.max(h, 0.012) + 0.004, d * 0.64, 0, 0, 0);
      break;
    }
    case "wall_art":
      box(w, h, Math.max(d, 0.03), 0, 0, 0, new THREE.Color("#2e2a26"));
      box(w * 0.92, h * 0.9, 0.006, 0, h * 0.05, Math.max(d, 0.03) / 2 + 0.002, LINEN);
      box(w * 0.6, h * 0.55, 0.006, 0, h * 0.22, Math.max(d, 0.03) / 2 + 0.006, c);
      break;
    case "door":
      box(w + 0.12, h + 0.06, Math.max(d, 0.08), 0, 0, 0, c.clone().multiplyScalar(0.9));
      box(w, h, 0.05, 0, 0, Math.max(d, 0.08) / 2, c);
      for (const py of [0.16, 0.56]) box(w * 0.68, h * 0.34, 0.008, 0, h * py, Math.max(d, 0.08) / 2 + 0.028, light);
      cyl(0.022, 0.022, 0.05, w / 2 - 0.08, h * 0.47, Math.max(d, 0.08) / 2 + 0.05, METAL);
      break;
    case "window": {
      const t = Math.max(d, 0.08);
      box(w + 0.1, h + 0.1, t, 0, 0, 0, c);
      box(w, h, 0.012, 0, 0.05, t / 2 + 0.002, new THREE.Color("#bcdcf0"), {
        roughness: 0.1,
        emissive: new THREE.Color("#a8cfe8"),
        emissiveIntensity: 0.5,
      });
      box(0.035, h, 0.02, 0, 0.05, t / 2 + 0.008, c);
      box(w, 0.035, 0.02, 0, 0.05 + h / 2, t / 2 + 0.008, c);
      break;
    }
    case "fireplace": {
      // A chimney breast with a mantel shelf and a dark firebox opening on the front.
      const shelf = 0.06;
      const body = h - shelf;
      box(w, body, d, 0, 0, 0);
      box(w + 0.1, shelf, Math.min(0.25, d * 0.4), 0, body, d / 2 - Math.min(0.25, d * 0.4) / 2 + 0.04, light);
      const openW = w * 0.6;
      const openH = Math.min(0.75, body * 0.65);
      box(openW, openH, 0.02, 0, 0.1, d / 2 + 0.002, new THREE.Color("#1f1b18"), { roughness: 0.95 });
      box(w + 0.12, 0.04, 0.4, 0, 0, d / 2 + 0.18, new THREE.Color("#4b4744"));
      break;
    }
    case "u_sofa": {
      // Back section along -z and two returns down the sides, open at the front (+z).
      const s = uSeat(w, d);
      const backD = Math.min(0.22, s * 0.3);
      const inner = s - backD;
      const seatY = h * 0.3;
      const cushH = h * 0.18;
      const leather = { roughness: 0.45 };
      const cushion = c.clone().lerp(WHITE, 0.1);
      box(w, seatY, s, 0, 0, -d / 2 + s / 2, dark, leather);
      box(w, h, backD, 0, 0, -d / 2 + backD / 2, c, leather);
      box(w - 2 * backD - 0.02, cushH, inner - 0.02, 0, seatY, -d / 2 + backD + inner / 2, cushion, leather);
      for (const sx of [-1, 1]) {
        box(s, seatY, d - s, sx * (w / 2 - s / 2), 0, s / 2, dark, leather);
        box(backD, h, d - backD, sx * (w / 2 - backD / 2), 0, backD / 2, c, leather);
        box(inner - 0.02, cushH, d - s - 0.02, sx * (w / 2 - backD - inner / 2), seatY, s / 2, cushion, leather);
      }
      break;
    }
    case "heater": {
      // A column radiator on two feet, its back against the wall (-z).
      const lift = Math.min(0.12, h * 0.2);
      const body = h - lift;
      const cols = Math.max(4, Math.round(w / 0.06));
      const step = w / cols;
      for (let i = 0; i < cols; i++) box(step * 0.72, body, d * 0.75, -w / 2 + step * (i + 0.5), lift, 0, c, { roughness: 0.4 });
      for (const y of [lift + 0.03, h - 0.06]) box(w, 0.03, d * 0.35, 0, y, 0, c, { roughness: 0.4 });
      for (const s of [-1, 1]) box(0.04, lift, d * 0.6, s * (w / 2 - step), 0, 0, dark);
      break;
    }
    case "stairs": {
      // The bottom step is at the front (+z); the flight climbs towards -z.
      const steps = Math.max(3, Math.round(h / 0.18));
      const rise = h / steps;
      const tread = d / steps;
      for (let i = 0; i < steps; i++) {
        const z = d / 2 - tread * (i + 0.5);
        box(w, rise * (i + 1) - 0.025, tread, 0, 0, z, dark);
        box(w + 0.02, 0.03, tread + 0.015, 0, rise * (i + 1) - 0.03, z, c);
      }
      const railX = w / 2 - 0.02;
      const railH = 0.9;
      for (let i = 0; i < steps; i += 2) {
        cyl(0.012, 0.012, railH, railX, rise * (i + 1), d / 2 - tread * (i + 0.5), METAL);
      }
      const len = Math.hypot(d, h);
      const rail = add(new THREE.BoxGeometry(0.05, 0.04, len), railX, h / 2 + railH + rise / 2, 0, dark);
      rail.rotation.x = Math.atan2(h, d);
      break;
    }
    case "bench":
      box(w, 0.05, d, 0, h - 0.11, 0);
      box(w * 0.98, 0.07, d * 0.96, 0, h - 0.07, 0, light);
      for (const s of [-1, 1]) box(0.05, h - 0.11, d * 0.9, s * (w / 2 - 0.08), 0, 0, dark);
      break;
    case "pouf": {
      cyl(w / 2 - 0.02, w / 2, h, 0, 0, 0).scale.z = d / w;
      cyl(w / 2 - 0.06, w / 2 - 0.02, 0.012, 0, h, 0, light).scale.z = d / w;
      break;
    }
    case "round_coffee_table":
    case "round_dining_table": {
      const stemR = Math.min(0.07, w * 0.08);
      cyl(w * 0.28, w * 0.3, 0.03, 0, 0, 0, dark).scale.z = d / w;
      cyl(stemR, stemR * 1.3, h - 0.07, 0, 0.03, 0, dark);
      cyl(w / 2, w / 2, 0.04, 0, h - 0.04, 0).scale.z = d / w;
      break;
    }
    case "vase": {
      const r = Math.min(w, d) / 2;
      const profile: [number, number][] = [[0.55, 0], [0.9, 0.18], [1, 0.42], [0.72, 0.68], [0.36, 0.84], [0.42, 0.94], [0.56, 1]];
      add(new THREE.LatheGeometry(profile.map(([pr, py]) => new THREE.Vector2(pr * r, py * h)), 32), 0, 0, 0, c, { side: THREE.DoubleSide, roughness: 0.35 });
      break;
    }
    case "floor_mirror": {
      const t = Math.max(d, 0.04);
      box(w, h, t, 0, 0, 0);
      box(w - 0.08, h - 0.08, 0.008, 0, 0.04, t / 2 + 0.002, new THREE.Color("#d9e6ec"), { metalness: 0.65, roughness: 0.12 });
      break;
    }
    case "round_rug": {
      const t = Math.max(h, 0.012);
      cyl(w / 2, w / 2, t, 0, 0, 0).scale.z = d / w;
      cyl(w * 0.4, w * 0.4, t + 0.002, 0, 0, 0, light).scale.z = d / w;
      cyl(w * 0.3, w * 0.3, t + 0.004, 0, 0, 0).scale.z = d / w;
      break;
    }
    case "striped_rug": {
      const t = Math.max(h, 0.012);
      box(w, t, d, 0, 0, 0, LINEN);
      const stripes = Math.max(3, Math.round(d / 0.3));
      const band = d / (stripes * 2 + 1);
      for (let i = 0; i < stripes; i++) box(w, t + 0.002, band, 0, 0, -d / 2 + band * (2 * i + 1.5));
      break;
    }
    case "cowhide_rug": {
      const t = Math.max(h, 0.008);
      const shape = new THREE.Shape(cowhideOutline(w, d).map((p) => new THREE.Vector2(p.x, p.y)));
      const hide = add(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }), 0, t, 0, new THREE.Color("#efe6d6"));
      hide.rotation.x = Math.PI / 2;
      for (const [sx, sy, rx, ry] of COWHIDE_SPOTS) {
        const spot = add(new THREE.CircleGeometry(1, 32), (sx * w) / 2, t + 0.002, (sy * d) / 2, c);
        spot.rotation.x = -Math.PI / 2;
        spot.scale.set((rx * w) / 2, (ry * d) / 2, 1);
        spot.castShadow = false;
      }
      break;
    }
    default:
      box(w, h, d, 0, 0, 0);
  }
  return g;
}

/** Height of the group's origin above the floor. */
export function elevation(item: Item, ceiling: number, items: Item[]): number {
  if (item.type === "vase") {
    const under = items.filter((o) => SURFACE_TYPES.includes(o.type) && inside(item, corners(o)));
    return Math.max(0, ...under.map((o) => o.h));
  }
  if (item.type === "pendant_lamp") return ceiling - item.h;
  // The frame adds 0.1 m on top, and the window never pokes through the ceiling.
  if (item.type === "window") return Math.max(0, Math.min(item.z ?? WINDOW_SILL, ceiling - item.h - 0.1));
  if (item.type === "wall_art") return Math.min(1.35, ceiling - item.h - 0.1);
  return 0;
}
