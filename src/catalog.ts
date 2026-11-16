import type { FurnitureType } from "../shared/schemas";

export interface CatalogEntry {
  type: FurnitureType;
  label: string;
  w: number;
  d: number;
  h: number;
  color: string;
}

export const CATALOG: { group: string; entries: CatalogEntry[] }[] = [
  {
    group: "Seating",
    entries: [
      { type: "sofa", label: "Sofa", w: 2.1, d: 0.92, h: 0.82, color: "#8a9a8b" },
      { type: "armchair", label: "Armchair", w: 0.85, d: 0.85, h: 0.82, color: "#c08552" },
      { type: "chair", label: "Chair", w: 0.46, d: 0.5, h: 0.85, color: "#a47551" },
      { type: "stool", label: "Stool", w: 0.38, d: 0.38, h: 0.65, color: "#a47551" },
      { type: "bench", label: "Bench", w: 1.3, d: 0.4, h: 0.46, color: "#a47551" },
      { type: "pouf", label: "Pouf", w: 0.55, d: 0.55, h: 0.38, color: "#c9a26b" },
    ],
  },
  {
    group: "Bedroom",
    entries: [
      { type: "bed", label: "Double bed", w: 1.6, d: 2.05, h: 0.95, color: "#6f8aa6" },
      { type: "bed", label: "Single bed", w: 0.95, d: 2.05, h: 0.9, color: "#6f8aa6" },
      { type: "side_table", label: "Nightstand", w: 0.48, d: 0.42, h: 0.52, color: "#9c7a5b" },
      { type: "wardrobe", label: "Wardrobe", w: 1.5, d: 0.6, h: 2.1, color: "#d8cfc0" },
      { type: "dresser", label: "Dresser", w: 1.2, d: 0.48, h: 0.82, color: "#9c7a5b" },
      { type: "dresser", label: "Kommot", w: 0.9, d: 0.45, h: 1.0, color: "#b08d68" },
    ],
  },
  {
    group: "Tables and work",
    entries: [
      { type: "dining_table", label: "Dining table", w: 1.6, d: 0.9, h: 0.75, color: "#a9825c" },
      { type: "round_dining_table", label: "Round dining table", w: 1.2, d: 1.2, h: 0.75, color: "#a9825c" },
      { type: "coffee_table", label: "Coffee table", w: 1.1, d: 0.6, h: 0.42, color: "#a9825c" },
      { type: "round_coffee_table", label: "Round coffee table", w: 0.8, d: 0.8, h: 0.42, color: "#a9825c" },
      { type: "desk", label: "Desk", w: 1.4, d: 0.7, h: 0.75, color: "#d9c7a8" },
    ],
  },
  {
    group: "Storage and media",
    entries: [
      { type: "bookshelf", label: "Bookshelf", w: 0.9, d: 0.32, h: 1.9, color: "#9c7a5b" },
      { type: "tv_stand", label: "TV and stand", w: 1.6, d: 0.42, h: 0.5, color: "#5b5148" },
    ],
  },
  {
    group: "Rugs",
    entries: [
      { type: "rug", label: "Rug", w: 2.4, d: 1.7, h: 0.015, color: "#b5654a" },
      { type: "cowhide_rug", label: "Cowhide rug", w: 1.9, d: 2.3, h: 0.012, color: "#4a3226" },
      { type: "round_rug", label: "Round rug", w: 2.0, d: 2.0, h: 0.015, color: "#7f8f7a" },
      { type: "striped_rug", label: "Striped rug", w: 2.4, d: 1.7, h: 0.015, color: "#3f5470" },
      { type: "rug", label: "Runner", w: 0.8, d: 2.6, h: 0.015, color: "#8c4a3c" },
    ],
  },
  {
    group: "Decor",
    entries: [
      { type: "plant", label: "Plant", w: 0.5, d: 0.5, h: 1.4, color: "#4f7a55" },
      { type: "vase", label: "Vase", w: 0.18, d: 0.18, h: 0.32, color: "#3f6f8a" },
      { type: "vase", label: "Floor vase", w: 0.34, d: 0.34, h: 0.75, color: "#c8b8a0" },
      { type: "floor_mirror", label: "Floor mirror", w: 0.7, d: 0.06, h: 1.75, color: "#a9825c" },
      { type: "floor_lamp", label: "Floor lamp", w: 0.38, d: 0.38, h: 1.65, color: "#e9d9b8" },
      { type: "pendant_lamp", label: "Pendant lamp", w: 0.45, d: 0.45, h: 0.6, color: "#e9d9b8" },
      { type: "wall_art", label: "Wall art", w: 0.9, d: 0.04, h: 0.65, color: "#d08a5a" },
    ],
  },
  {
    group: "Doors, windows and stairs",
    entries: [
      { type: "stairs", label: "Stairs", w: 0.95, d: 3.0, h: 2.7, color: "#a9825c" },
      { type: "door", label: "Door", w: 0.9, d: 0.08, h: 2.05, color: "#f1ece3" },
      { type: "window", label: "Window", w: 1.4, d: 0.08, h: 1.25, color: "#f1ece3" },
    ],
  },
];

export const ALL_ENTRIES = CATALOG.flatMap((g) => g.entries);

export function defaultsFor(type: FurnitureType): CatalogEntry {
  return (
    ALL_ENTRIES.find((e) => e.type === type) ?? {
      type: "box",
      label: "Box",
      w: 0.6,
      d: 0.6,
      h: 0.6,
      color: "#b9aea0",
    }
  );
}

/** These snap to the nearest wall. */
export const WALL_TYPES: readonly FurnitureType[] = ["door", "window", "wall_art"];
export const RUG_TYPES: readonly FurnitureType[] = ["rug", "round_rug", "cowhide_rug", "striped_rug"];
/** These can sit over or under other furniture without counting as a clash. */
export const LAYER_TYPES: readonly FurnitureType[] = [...RUG_TYPES, "pendant_lamp", "vase"];
/** Drawn as circles or ovals on the plan. */
export const ROUND_TYPES: readonly FurnitureType[] = ["plant", "floor_lamp", "pendant_lamp", "pouf", "round_coffee_table", "round_dining_table", "round_rug", "vase"];
/** A vase placed over one of these stands on top of it. */
export const SURFACE_TYPES: readonly FurnitureType[] = ["dining_table", "round_dining_table", "coffee_table", "round_coffee_table", "desk", "side_table", "dresser", "wardrobe"];
