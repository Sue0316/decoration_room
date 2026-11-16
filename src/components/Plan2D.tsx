import { useMemo, useRef, useState } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { ROUND_TYPES, RUG_TYPES, WALL_TYPES } from "../catalog";
import { finishId, finishImage, finishInfo } from "../finishes";
import { area, bounds, COWHIDE_SPOTS, cowhideOutline, normDeg, round } from "../geometry";
import type { Design, Item, Point } from "../types";

interface Props {
  design: Design;
  selectedId: string | null;
  problems: Set<string>;
  onSelect(id: string | null): void;
  onDragStart(): void;
  onMoveItem(id: string, x: number, y: number): void;
  onRotateItem(id: string, deg: number): void;
  onMoveVertex(index: number, p: Point): void;
  onInsertVertex(afterIndex: number, p: Point): void;
  onRemoveVertex(index: number): void;
  onDropCatalog(key: string, p: Point): void;
}

type Drag =
  | { kind: "item"; id: string; dx: number; dy: number; started: boolean }
  | { kind: "rotate"; id: string }
  | { kind: "vertex"; index: number };

const PAD = 0.9;

export function Plan2D(props: Props) {
  const { design, selectedId, problems } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const frozen = useRef<string>("");

  // The view stays put during a drag so the room doesn't slide under the cursor.
  const viewBox = useMemo(() => {
    if (dragging && frozen.current) return frozen.current;
    const b = bounds(design.points);
    // Margin grows with the room because label size scales with the view.
    const pad = Math.max(PAD, Math.max(b.w, b.h) * 0.15);
    const vb = `${b.minX - pad} ${b.minY - pad} ${b.w + pad * 2} ${b.h + pad * 2}`;
    frozen.current = vb;
    return vb;
  }, [design.points, dragging]);

  const [vx, vy, vw, vh] = viewBox.split(" ").map(Number);
  const unit = Math.max(vw, vh) / 42;

  const toWorld = (e: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  };

  const begin = (e: ReactPointerEvent, drag: Drag) => {
    e.stopPropagation();
    dragRef.current = drag;
    setDragging(true);
    svgRef.current!.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toWorld(e);
    if (drag.kind === "item") {
      if (!drag.started) {
        drag.started = true;
        props.onDragStart();
      }
      props.onMoveItem(drag.id, p.x + drag.dx, p.y + drag.dy);
    } else if (drag.kind === "rotate") {
      const it = design.items.find((i) => i.id === drag.id);
      if (!it) return;
      const deg = (Math.atan2(p.x - it.x, -(p.y - it.y)) * 180) / Math.PI;
      props.onRotateItem(drag.id, normDeg(e.shiftKey ? Math.round(deg) : round(deg, 15)));
    } else {
      props.onMoveVertex(drag.index, { x: round(p.x, 0.1), y: round(p.y, 0.1) });
    }
  };

  const end = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const onDrop = (e: DragEvent) => {
    const key = e.dataTransfer.getData("text/catalog");
    if (key) {
      e.preventDefault();
      props.onDropCatalog(key, toWorld(e));
    }
  };

  const polygon = design.points.map((p) => `${p.x},${p.y}`).join(" ");
  const selected = design.items.find((i) => i.id === selectedId);
  // Rugs lie underneath; small pieces that sit on others stay clickable on top.
  const layer = (i: Item) => (RUG_TYPES.includes(i.type) ? 0 : i.type === "vase" || i.type === "pendant_lamp" ? 2 : 1);
  const ordered = [...design.items].sort((a, b) => layer(a) - layer(b));

  const floorId = finishId(design.floorFinish);
  const floorInfo = finishInfo(floorId);

  const gridLines = [];
  for (let x = Math.ceil(vx * 2) / 2; x <= vx + vw; x += 0.5) {
    gridLines.push(<line key={`x${x}`} x1={x} x2={x} y1={vy} y2={vy + vh} className={Number.isInteger(x) ? "grid major" : "grid"} />);
  }
  for (let y = Math.ceil(vy * 2) / 2; y <= vy + vh; y += 0.5) {
    gridLines.push(<line key={`y${y}`} y1={y} y2={y} x1={vx} x2={vx + vw} className={Number.isInteger(y) ? "grid major" : "grid"} />);
  }

  return (
    <svg
      ref={svgRef}
      className="plan"
      data-testid="plan"
      viewBox={viewBox}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerDown={() => props.onSelect(null)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {gridLines}
      {floorId !== "plain" && (
        <defs>
          <pattern id="floor-finish" patternUnits="userSpaceOnUse" width={floorInfo.w} height={floorInfo.h}>
            <image href={finishImage(floorId, design.floorColor, 768)} width={floorInfo.w} height={floorInfo.h} preserveAspectRatio="none" />
          </pattern>
        </defs>
      )}
      <polygon points={polygon} fill={floorId === "plain" ? design.floorColor : "url(#floor-finish)"} fillOpacity={0.55} data-testid="plan-floor" />
      <polygon points={polygon} className="walls" />

      {design.points.map((a, i) => {
        const b = design.points[(i + 1) % design.points.length];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const sign = Math.sign(design.points.length ? shoelace(design.points) : 1) || 1;
        const nx = ((b.y - a.y) / len) * sign;
        const ny = (-(b.x - a.x) / len) * sign;
        // Horizontal text needs more clearance beside a vertical wall.
        const offset = unit * (1.3 + Math.abs(nx) * 1.5);
        return (
          <g key={`edge${i}`}>
            <text x={mx + nx * offset} y={my + ny * offset} fontSize={unit * 0.85} className="dim">
              {len.toFixed(2)} m
            </text>
            <circle
              cx={mx}
              cy={my}
              r={unit * 0.34}
              className="edge-handle"
              onPointerDown={(e) => {
                props.onInsertVertex(i, { x: round(mx, 0.1), y: round(my, 0.1) });
                begin(e, { kind: "vertex", index: i + 1 });
              }}
            >
              <title>Drag to add a corner</title>
            </circle>
          </g>
        );
      })}

      {ordered.map((it) => (
        <ItemShape
          key={it.id}
          item={it}
          unit={unit}
          selected={it.id === selectedId}
          bad={problems.has(it.id)}
          onDown={(e) => {
            props.onSelect(it.id);
            const p = toWorld(e);
            begin(e, { kind: "item", id: it.id, dx: it.x - p.x, dy: it.y - p.y, started: false });
          }}
        />
      ))}

      {selected && !WALL_TYPES.includes(selected.type) && (
        <g transform={`translate(${selected.x} ${selected.y}) rotate(${selected.rot})`}>
          <line x1={0} y1={-selected.d / 2} x2={0} y2={-selected.d / 2 - unit * 1.5} className="rot-line" />
          <circle
            cx={0}
            cy={-selected.d / 2 - unit * 1.5}
            r={unit * 0.5}
            className="rot-handle"
            data-testid="rotate-handle"
            onPointerDown={(e) => {
              props.onDragStart();
              begin(e, { kind: "rotate", id: selected.id });
            }}
          >
            <title>Drag to rotate (hold Shift for 1°)</title>
          </circle>
        </g>
      )}

      {design.points.map((p, i) => (
        <circle
          key={`v${i}`}
          cx={p.x}
          cy={p.y}
          r={unit * 0.48}
          className="vertex"
          onPointerDown={(e) => {
            props.onDragStart();
            begin(e, { kind: "vertex", index: i });
          }}
          onDoubleClick={() => props.onRemoveVertex(i)}
        >
          <title>Drag to reshape, double-click to remove</title>
        </circle>
      ))}

      <text x={vx + unit * 0.7} y={vy + unit * 1.4} fontSize={unit * 0.85} className="area">
        {area(design.points).toFixed(1)} m²
      </text>
    </svg>
  );
}

function shoelace(p: Point[]) {
  return p.reduce((s, v, i) => {
    const q = p[(i + 1) % p.length];
    return s + v.x * q.y - q.x * v.y;
  }, 0);
}

function ItemShape({ item, unit, selected, bad, onDown }: { item: Item; unit: number; selected: boolean; bad: boolean; onDown(e: ReactPointerEvent): void }) {
  const isWall = WALL_TYPES.includes(item.type);
  const d = isWall ? Math.max(item.d, 0.14) : item.d;
  const isRound = ROUND_TYPES.includes(item.type);
  const isRug = RUG_TYPES.includes(item.type);
  const steps = item.type === "stairs" ? Math.max(3, Math.round(item.h / 0.18)) : 0;
  const size = Math.min(unit * 0.72, (item.w / Math.max(item.label.length, 4)) * 1.7);
  const cls = `item${selected ? " selected" : ""}${bad ? " bad" : ""}`;
  return (
    <g className={cls} data-testid="plan-item" data-type={item.type} onPointerDown={onDown}>
      <g transform={`translate(${item.x} ${item.y}) rotate(${item.rot})`}>
        {item.type === "cowhide_rug" ? (
          <>
            <polygon points={cowhideOutline(item.w, d).map((p) => `${p.x},${p.y}`).join(" ")} fill="#efe6d6" className="body" />
            {COWHIDE_SPOTS.map(([sx, sy, rx, ry]) => (
              <ellipse key={`${sx},${sy}`} cx={(sx * item.w) / 2} cy={(sy * d) / 2} rx={(rx * item.w) / 2} ry={(ry * d) / 2} fill={item.color} />
            ))}
          </>
        ) : (
          <rect
            x={-item.w / 2}
            y={-d / 2}
            width={item.w}
            height={d}
            rx={isRound ? item.w / 2 : 0.03}
            ry={isRound ? d / 2 : 0.03}
            fill={item.color}
            fillOpacity={isRug ? 0.5 : 0.92}
            className="body"
          />
        )}
        {Array.from({ length: Math.max(0, steps - 1) }, (_, i) => {
          const y = d / 2 - ((i + 1) * d) / steps;
          return <line key={i} x1={-item.w / 2} x2={item.w / 2} y1={y} y2={y} className="tread" />;
        })}
        {!isWall && !isRound && !isRug && !steps && <line x1={-item.w / 2 + 0.05} x2={item.w / 2 - 0.05} y1={d / 2 - 0.05} y2={d / 2 - 0.05} className="front" />}
      </g>
      {!isWall && size > unit * 0.3 && (
        <text x={item.x} y={item.y} fontSize={size} className="label">
          {item.label}
        </text>
      )}
    </g>
  );
}
