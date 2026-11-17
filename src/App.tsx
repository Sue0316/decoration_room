import { useCallback, useEffect, useMemo, useState } from "react";
import type { Concept, RoomAnalysis, SuggestedItem } from "../shared/schemas";
import { designFromAnalysis, itemFromAnalysis, itemFromSuggestion, uid } from "./aiImport";
import { aiConfigured } from "./api";
import { ALL_ENTRIES, WALL_TYPES } from "./catalog";
import type { CatalogEntry } from "./catalog";
import { CatalogPanel } from "./components/CatalogPanel";
import { IdeasPanel } from "./components/IdeasPanel";
import { Inspector } from "./components/Inspector";
import { PhotoPanel } from "./components/PhotoPanel";
import { Plan2D } from "./components/Plan2D";
import { RoomBar } from "./components/RoomBar";
import { Scene3D } from "./components/Scene3D";
import { bounds, centroid, findProblems, isSimple, lRoom, normDeg, rectRoom, resnapWallItems, round, snapToWall } from "./geometry";
import type { Design, Item, Point } from "./types";
import { useDesign } from "./useDesign";

type View = "plan" | "split" | "3d";
type Tab = "furniture" | "photo" | "ideas";

/** Walks the walls for a stretch not already taken by another door, window or picture. */
function freeWallSpot(design: Design, item: Item): Point {
  const others = design.items.filter((i) => WALL_TYPES.includes(i.type));
  const pts = design.points;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = item.w / 2 + 0.1; s <= len - item.w / 2 - 0.1; s += 0.1) {
      const spot = { x: a.x + ((b.x - a.x) * s) / len, y: a.y + ((b.y - a.y) * s) / len };
      if (others.every((o) => Math.hypot(o.x - spot.x, o.y - spot.y) >= (o.w + item.w) / 2 + 0.1)) return spot;
    }
  }
  return centroid(pts);
}

/** Finds the open spot nearest the room's centre that fits the item. */
function placeNear(design: Design, item: Item, target?: Point): Item {
  if (WALL_TYPES.includes(item.type)) return { ...item, ...snapToWall(target ?? freeWallSpot(design, item), design.points) };
  if (target) return { ...item, x: round(target.x, 0.05), y: round(target.y, 0.05) };
  const c = centroid(design.points);
  const b = bounds(design.points);
  const spots: Point[] = [];
  for (let x = b.minX; x <= b.maxX; x += 0.2) for (let y = b.minY; y <= b.maxY; y += 0.2) spots.push({ x: round(x, 0.05), y: round(y, 0.05) });
  spots.sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y));
  for (const s of spots) {
    const candidate = { ...item, ...s };
    if (!findProblems({ ...design, items: [...design.items, candidate] }).has(item.id)) return candidate;
  }
  return { ...item, ...c };
}

export function App() {
  const { design, patch, commit, checkpoint, undo, redo, canUndo, canRedo, rooms, activeId, saved, switchRoom, createRoom, copyRoom, importRoom, renameRoom, deleteRoom } = useDesign();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("split");
  const [tab, setTab] = useState<Tab>("furniture");
  const [frameToken, setFrameToken] = useState(0);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    aiConfigured().then(setConfigured);
  }, []);

  const problems = useMemo(() => findProblems(design), [design]);
  const selected = design.items.find((i) => i.id === selectedId) ?? null;
  const reframe = () => setFrameToken((n) => n + 1);
  const afterRoomChange = () => {
    setSelectedId(null);
    reframe();
  };

  const addEntry = useCallback(
    (entry: CatalogEntry, at?: Point) => {
      const id = uid();
      commit((d) => {
        const item = placeNear(d, { id, ...entry, x: 0, y: 0, rot: 0 }, at);
        return { ...d, items: [...d.items, item] };
      });
      setSelectedId(id);
    },
    [commit],
  );

  const updateItem = useCallback(
    (id: string, change: Partial<Item>) => commit((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...change } : i)) })),
    [commit],
  );

  const removeItem = useCallback(
    (id: string) => {
      commit((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
      setSelectedId(null);
    },
    [commit],
  );

  const duplicateItem = useCallback(
    (id: string) => {
      const copyId = uid();
      commit((d) => {
        const src = d.items.find((i) => i.id === id);
        if (!src) return d;
        const copy = WALL_TYPES.includes(src.type)
          ? { ...src, id: copyId, ...snapToWall({ x: src.x + src.w + 0.2, y: src.y }, d.points) }
          : placeNear(d, { ...src, id: copyId });
        return { ...d, items: [...d.items, copy] };
      });
      setSelectedId(copyId);
    },
    [commit],
  );

  const moveItem = useCallback(
    (id: string, x: number, y: number) =>
      patch((d) => ({
        ...d,
        items: d.items.map((i) => {
          if (i.id !== id) return i;
          return WALL_TYPES.includes(i.type) ? { ...i, ...snapToWall({ x, y }, d.points) } : { ...i, x: round(x, 0.05), y: round(y, 0.05) };
        }),
      })),
    [patch],
  );

  const rotateItem = useCallback(
    (id: string, rot: number) => patch((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, rot } : i)) })),
    [patch],
  );

  const moveVertex = useCallback(
    (index: number, p: Point) =>
      patch((d) => {
        const points = d.points.map((v, i) => (i === index ? p : v));
        return isSimple(points) ? resnapWallItems({ ...d, points }) : d;
      }),
    [patch],
  );

  const insertVertex = useCallback(
    (after: number, p: Point) => commit((d) => ({ ...d, points: [...d.points.slice(0, after + 1), p, ...d.points.slice(after + 1)] })),
    [commit],
  );

  const removeVertex = useCallback(
    (index: number) =>
      commit((d) => {
        if (d.points.length <= 3) return d;
        const points = d.points.filter((_, i) => i !== index);
        return isSimple(points) ? resnapWallItems({ ...d, points }) : d;
      }),
    [commit],
  );

  const setShape = (shape: "rect" | "l", w: number, d: number) => {
    commit((cur) => resnapWallItems({ ...cur, points: shape === "rect" ? rectRoom(w, d) : lRoom(w, d) }));
    reframe();
  };

  const applyAnalysis = (result: RoomAnalysis, mode: "room" | "item") => {
    if (mode === "room") {
      commit(() => designFromAnalysis(result));
      setSelectedId(null);
    } else if (result.items[0]) {
      const id = uid();
      commit((d) => ({ ...d, items: [...d.items, placeNear(d, { ...itemFromAnalysis(result.items[0], 0, 0), id })] }));
      setSelectedId(id);
    }
    setView((v) => (v === "plan" ? "split" : v));
    reframe();
  };

  const addSuggestion = (s: SuggestedItem) => {
    const id = uid();
    commit((d) => ({ ...d, items: [...d.items, placeNear(d, { ...itemFromSuggestion(s, 0, 0), id })] }));
    setSelectedId(id);
  };

  const applyColors = (c: Concept) => {
    commit((d) => ({
      ...d,
      wallColor: /^#[0-9a-f]{6}$/i.test(c.wall_color) ? c.wall_color : d.wallColor,
      floorColor: /^#[0-9a-f]{6}$/i.test(c.floor_color) ? c.floor_color : d.floorColor,
    }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches("input, textarea, select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (selected && (e.key === "Delete" || e.key === "Backspace")) {
        removeItem(selected.id);
      } else if (selected && e.key.toLowerCase() === "r" && !mod && !WALL_TYPES.includes(selected.type)) {
        updateItem(selected.id, { rot: normDeg(selected.rot + 90) });
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, undo, redo, removeItem, updateItem]);

  const tabs: [Tab, string][] = [
    ["furniture", "Furniture"],
    ["photo", "Photo to 3D"],
    ["ideas", "Ideas"],
  ];
  const views: [View, string][] = [
    ["plan", "Plan"],
    ["split", "Split"],
    ["3d", "3D"],
  ];

  return (
    <div className="app">
      <header className="topbar">
        <h1>Room Studio</h1>
        <div className="seg" role="group" aria-label="View">
          {views.map(([v, label]) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {label}
            </button>
          ))}
        </div>
        <RoomBar
          rooms={rooms}
          activeId={activeId}
          saved={saved}
          design={design}
          onImport={(name, d) => {
            importRoom(name, d);
            afterRoomChange();
          }}
          onSwitch={(id) => {
            switchRoom(id);
            afterRoomChange();
          }}
          onCreate={(name) => {
            createRoom(name);
            afterRoomChange();
          }}
          onCopy={(name) => {
            copyRoom(name);
            afterRoomChange();
          }}
          onRename={renameRoom}
          onDelete={() => {
            deleteRoom();
            afterRoomChange();
          }}
        />
        <div className="spacer" />
        <button onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={redo} disabled={!canRedo}>
          Redo
        </button>
      </header>

      <aside className="left">
        <div className="tabs" role="tablist">
          {tabs.map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
        <div className="panel" hidden={tab !== "furniture"}>
          <CatalogPanel onAdd={addEntry} />
        </div>
        <div className="panel" hidden={tab !== "photo"}>
          <PhotoPanel configured={configured} onResult={applyAnalysis} />
        </div>
        <div className="panel" hidden={tab !== "ideas"}>
          <IdeasPanel configured={configured} design={design} onApplyColors={applyColors} onAddItem={addSuggestion} />
        </div>
      </aside>

      <main className={`stage ${view}`}>
        {view !== "3d" && (
          <Plan2D
            design={design}
            selectedId={selectedId}
            problems={problems}
            onSelect={setSelectedId}
            onDragStart={checkpoint}
            onMoveItem={moveItem}
            onRotateItem={rotateItem}
            onMoveVertex={moveVertex}
            onInsertVertex={insertVertex}
            onRemoveVertex={removeVertex}
            onDropCatalog={(key, p) => {
              const entry = ALL_ENTRIES.find((e) => e.label === key);
              if (entry) addEntry(entry, p);
            }}
          />
        )}
        {view !== "plan" && (
          <Scene3D design={design} selectedId={selectedId} frameToken={frameToken} onSelect={setSelectedId} onDragStart={checkpoint} onMove={moveItem} />
        )}
      </main>

      <aside className="right">
        <Inspector
          design={design}
          selected={selected}
          hasProblem={selected ? problems.has(selected.id) : false}
          onItem={updateItem}
          onRemove={removeItem}
          onDuplicate={duplicateItem}
          onRoom={(c) => commit((d) => ({ ...d, ...c }))}
          onShape={setShape}
        />
      </aside>

      <footer className="status">
        <span>{design.items.length} {design.items.length === 1 ? "item" : "items"}</span>
        {problems.size > 0 && <span className="warn">{problems.size} overlapping or outside the walls</span>}
        <span className="hint">Drag items to move · R rotates · Delete removes · Drag a corner to reshape the room · Saved in this browser</span>
      </footer>
    </div>
  );
}
