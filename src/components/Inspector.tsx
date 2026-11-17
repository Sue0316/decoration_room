import { useState } from "react";
import { WALL_TYPES } from "../catalog";
import { finishId, finishImage, finishInfo, FLOOR_FINISHES, WALL_FINISHES } from "../finishes";
import type { FinishId } from "../finishes";
import { WINDOW_SILL } from "../furniture3d";
import { area, bounds, normDeg } from "../geometry";
import type { Design, Item } from "../types";

function Num({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange(v: number): void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        key={value}
        defaultValue={Number(value.toFixed(2))}
        min={min}
        max={max}
        step={step}
        onBlur={(e) => {
          const v = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(v) && v !== Number(value.toFixed(2))) onChange(Math.min(max, Math.max(min, v)));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}

interface Props {
  design: Design;
  selected: Item | null;
  hasProblem: boolean;
  onItem(id: string, change: Partial<Item>): void;
  onRemove(id: string): void;
  onDuplicate(id: string): void;
  onRoom(change: Partial<Pick<Design, "height" | "wallColor" | "floorColor" | "wallFinish" | "floorFinish">>): void;
  onShape(shape: "rect" | "l", w: number, d: number): void;
}

export function Inspector({ design, selected, hasProblem, onItem, onRemove, onDuplicate, onRoom, onShape }: Props) {
  if (selected) {
    const isWall = WALL_TYPES.includes(selected.type);
    return (
      <div className="panel" key={selected.id}>
        <h2>Selected item</h2>
        {hasProblem && <p className="error">This overlaps another piece or crosses a wall.</p>}
        <label className="field">
          <span>Name</span>
          <input defaultValue={selected.label} maxLength={40} onBlur={(e) => e.target.value && onItem(selected.id, { label: e.target.value })} />
        </label>
        <div className="row">
          <Num label="Width (m)" value={selected.w} min={0.05} max={8} step={0.05} onChange={(w) => onItem(selected.id, { w })} />
          {!isWall && <Num label="Depth (m)" value={selected.d} min={0.05} max={8} step={0.05} onChange={(d) => onItem(selected.id, { d })} />}
          <Num label="Height (m)" value={selected.h} min={0.01} max={6} step={0.05} onChange={(h) => onItem(selected.id, { h })} />
        </div>
        {selected.type === "window" && (
          <div className="row">
            <Num label="Sill height (m)" value={selected.z ?? WINDOW_SILL} min={0} max={3} step={0.05} onChange={(z) => onItem(selected.id, { z })} />
            <button className="align-end" onClick={() => onItem(selected.id, { z: 0, h: Math.max(0.5, Math.round((design.height - 0.4) * 100) / 100) })}>
              Make floor-length
            </button>
          </div>
        )}
        {!isWall && (
          <div className="row">
            <Num label="Rotation (°)" value={selected.rot} min={0} max={359} step={15} onChange={(rot) => onItem(selected.id, { rot })} />
            <button className="align-end" onClick={() => onItem(selected.id, { rot: normDeg(selected.rot + 90) })}>
              Turn 90°
            </button>
          </div>
        )}
        <label className="field">
          <span>Colour</span>
          <input type="color" value={selected.color} onChange={(e) => onItem(selected.id, { color: e.target.value })} />
        </label>
        <div className="row">
          <button onClick={() => onDuplicate(selected.id)}>Duplicate</button>
          <button className="danger" onClick={() => onRemove(selected.id)}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  const b = bounds(design.points);
  return <RoomForm key={`${b.w}x${b.h}`} design={design} onRoom={onRoom} onShape={onShape} />;
}

function RoomForm({ design, onRoom, onShape }: Pick<Props, "design" | "onRoom" | "onShape">) {
  const b = bounds(design.points);
  const [w, setW] = useState(b.w);
  const [d, setD] = useState(b.h);
  return (
    <div className="panel">
      <h2>Room map</h2>
      <p className="muted">
        {area(design.points).toFixed(1)} m² · {design.points.length} corners. Drag a corner to reshape. Drag a small dot on a wall to add a corner, and
        double-click a corner to remove it.
      </p>
      <div className="row">
        <Num label="Width (m)" value={w} min={1.5} max={30} step={0.1} onChange={setW} />
        <Num label="Depth (m)" value={d} min={1.5} max={30} step={0.1} onChange={setD} />
      </div>
      <div className="row">
        <button onClick={() => onShape("rect", w, d)}>Make rectangle</button>
        <button onClick={() => onShape("l", w, d)}>Make L-shape</button>
      </div>
      <Num label="Ceiling height (m)" value={design.height} min={2} max={6} step={0.05} onChange={(height) => onRoom({ height })} />
      <FinishPicker title="Walls" options={WALL_FINISHES} value={finishId(design.wallFinish)} color={design.wallColor} onFinish={(wallFinish) => onRoom({ wallFinish })} onColor={(wallColor) => onRoom({ wallColor })} />
      <FinishPicker title="Floor" options={FLOOR_FINISHES} value={finishId(design.floorFinish)} color={design.floorColor} onFinish={(floorFinish) => onRoom({ floorFinish })} onColor={(floorColor) => onRoom({ floorColor })} />
    </div>
  );
}

interface PickerProps {
  title: string;
  options: FinishId[];
  value: FinishId;
  color: string;
  onFinish(id: FinishId): void;
  onColor(color: string): void;
}

function FinishPicker({ title, options, value, color, onFinish, onColor }: PickerProps) {
  return (
    <section>
      <h3>{title}</h3>
      <div className="finishes" role="group" aria-label={`${title} finish`}>
        {options.map((id) => (
          <button key={id} className={id === value ? "finish on" : "finish"} aria-pressed={id === value} onClick={() => onFinish(id)}>
            <span className="thumb" style={{ backgroundImage: `url(${finishImage(id, color, 96)})` }} />
            <span className="finish-name">{finishInfo(id).label}</span>
          </button>
        ))}
      </div>
      <label className="field finish-color">
        <span>{title} colour</span>
        <input type="color" value={color} onChange={(e) => onColor(e.target.value)} />
      </label>
    </section>
  );
}
