import { z } from "zod";

/** Every shape the app can draw. The AI must pick from this list too. */
export const FURNITURE_TYPES = [
  "bed",
  "sofa",
  "armchair",
  "chair",
  "stool",
  "dining_table",
  "coffee_table",
  "desk",
  "side_table",
  "wardrobe",
  "dresser",
  "bookshelf",
  "tv_stand",
  "floor_lamp",
  "pendant_lamp",
  "plant",
  "rug",
  "wall_art",
  "door",
  "window",
  "stairs",
  "bench",
  "pouf",
  "round_coffee_table",
  "round_dining_table",
  "vase",
  "floor_mirror",
  "round_rug",
  "cowhide_rug",
  "striped_rug",
  "box",
] as const;

export type FurnitureType = (typeof FURNITURE_TYPES)[number];

const furnitureType = z.enum(FURNITURE_TYPES);

/** Structured-output schemas stay free of numeric bounds; values are clamped on import. */
export const AnalyzedItemSchema = z.object({
  type: furnitureType,
  label: z.string().describe("Short name, e.g. 'Grey linen sofa'"),
  x_m: z.number().describe("Centre, metres from the left wall"),
  y_m: z.number().describe("Centre, metres from the back wall (the wall furthest from the camera)"),
  width_m: z.number().describe("Size along the item's own left-right axis"),
  depth_m: z.number().describe("Size along the item's own front-back axis"),
  height_m: z.number(),
  rotation_deg: z
    .number()
    .describe("0 = the item's front faces the camera, 90 = faces the left wall, 180 = faces the back wall, 270 = faces the right wall"),
  color: z.string().describe("Dominant colour as #rrggbb"),
});

export const RoomAnalysisSchema = z.object({
  room: z.object({
    width_m: z.number().describe("Left wall to right wall"),
    depth_m: z.number().describe("Back wall to the camera-side wall"),
    height_m: z.number(),
    wall_color: z.string().describe("#rrggbb"),
    floor_color: z.string().describe("#rrggbb"),
  }),
  items: z.array(AnalyzedItemSchema),
  style: z.string().describe("Two or three words describing the current style"),
  notes: z.string().describe("One or two sentences on what was uncertain or out of frame"),
});

export type RoomAnalysis = z.infer<typeof RoomAnalysisSchema>;

const SuggestedItemSchema = z.object({
  type: furnitureType,
  label: z.string(),
  width_m: z.number(),
  depth_m: z.number(),
  height_m: z.number(),
  color: z.string().describe("#rrggbb"),
  why: z.string().describe("One short sentence"),
});

export const BrainstormSchema = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      tagline: z.string(),
      why_it_fits: z.string().describe("Two sentences referring to this specific room"),
      wall_color: z.string().describe("#rrggbb"),
      floor_color: z.string().describe("#rrggbb"),
      palette: z.array(z.object({ name: z.string(), hex: z.string().describe("#rrggbb") })),
      layout_moves: z.array(z.string()).describe("Concrete changes to the existing layout"),
      add_items: z.array(SuggestedItemSchema),
      lighting: z.string(),
      budget_note: z.string(),
    }),
  ),
});

export type Brainstorm = z.infer<typeof BrainstormSchema>;
export type Concept = Brainstorm["concepts"][number];
export type SuggestedItem = Concept["add_items"][number];

export const AnalyzeRequestSchema = z.object({
  image: z.string().min(1).describe("base64 without a data: prefix"),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  mode: z.enum(["room", "item"]),
  knownWidth: z.number().positive().optional(),
});

export const BrainstormRequestSchema = z.object({
  room: z.object({
    area_m2: z.number(),
    width_m: z.number(),
    depth_m: z.number(),
    height_m: z.number(),
    wall_color: z.string(),
    floor_color: z.string(),
    items: z.array(z.object({ label: z.string(), type: z.string(), x_m: z.number(), y_m: z.number() })),
  }),
  style: z.string().max(80),
  budget: z.string().max(80),
  notes: z.string().max(1000),
});

export type BrainstormRequest = z.infer<typeof BrainstormRequestSchema>;
