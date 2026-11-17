import type { FurnitureType } from "../shared/schemas";

export interface Point {
  x: number;
  y: number;
}

/**
 * x,y is the item's centre on the plan in metres (y grows towards the viewer).
 * w runs along the item's own x axis, d along its y axis; the front is +y.
 * rot is in degrees, clockwise on the plan.
 */
export interface Item {
  id: string;
  type: FurnitureType;
  label: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  rot: number;
  color: string;
  /** Windows only: height of the bottom edge above the floor. Absent means a standard 0.9 m sill. */
  z?: number;
}

export interface Design {
  points: Point[];
  height: number;
  wallColor: string;
  floorColor: string;
  /** A FinishId; absent on older saves, which means plain. */
  wallFinish?: string;
  floorFinish?: string;
  items: Item[];
}
