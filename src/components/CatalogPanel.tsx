import { CATALOG } from "../catalog";
import type { CatalogEntry } from "../catalog";

export function CatalogPanel({ onAdd }: { onAdd(entry: CatalogEntry): void }) {
  return (
    <>
      <p className="muted">Click to add, or drag onto the plan.</p>
      {CATALOG.map((group) => (
        <section key={group.group}>
          <h3>{group.group}</h3>
          <div className="catalog">
            {group.entries.map((entry) => (
              <button
                key={entry.label}
                className="card"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/catalog", entry.label)}
                onClick={() => onAdd(entry)}
              >
                <span className="swatch" style={{ background: entry.color }} />
                <span className="name">{entry.label}</span>
                <span className="size">
                  {entry.w.toFixed(1)} × {entry.d.toFixed(1)} m
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
