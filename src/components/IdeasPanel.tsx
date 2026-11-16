import { useState } from "react";
import { BRAINSTORM_SYSTEM, brainstormTask, chatPrompt } from "../../shared/prompts";
import { BrainstormSchema } from "../../shared/schemas";
import type { BrainstormRequest, Concept, SuggestedItem } from "../../shared/schemas";
import { brainstorm } from "../api";
import { area, bounds } from "../geometry";
import type { Design } from "../types";
import { ChatBridge } from "./ChatBridge";

const STYLES = ["Surprise me", "Japandi", "Mid-century modern", "Scandinavian", "Industrial", "Bohemian", "Coastal", "Minimalist", "Traditional"];
const BUDGETS = ["Not sure", "Under $500", "$500 to $2,000", "$2,000 to $10,000", "Over $10,000"];

interface Props {
  configured: boolean;
  design: Design;
  onApplyColors(c: Concept): void;
  onAddItem(s: SuggestedItem): void;
}

export function IdeasPanel({ configured, design, onApplyColors, onAddItem }: Props) {
  const [style, setStyle] = useState(STYLES[0]);
  const [budget, setBudget] = useState(BUDGETS[0]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const request = (): BrainstormRequest => {
    const b = bounds(design.points);
    return {
      room: {
        area_m2: Number(area(design.points).toFixed(1)),
        width_m: Number(b.w.toFixed(2)),
        depth_m: Number(b.h.toFixed(2)),
        height_m: design.height,
        wall_color: design.wallColor,
        floor_color: design.floorColor,
        items: design.items.map((i) => ({ label: i.label, type: i.type, x_m: Number(i.x.toFixed(2)), y_m: Number(i.y.toFixed(2)) })),
      },
      style: style === STYLES[0] ? "" : style,
      budget: budget === BUDGETS[0] ? "" : budget,
      notes: notes.trim(),
    };
  };

  const show = (concepts: Concept[]) => {
    setConcepts(concepts);
    setAdded(new Set());
  };

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      show((await brainstorm(request())).concepts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p className="muted">Get three design directions based on your current room and furniture.</p>
      <label className="field">
        <span>Style</span>
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          {STYLES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Budget</span>
        <select value={budget} onChange={(e) => setBudget(e.target.value)}>
          {BUDGETS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>What matters to you?</span>
        <textarea rows={3} maxLength={1000} value={notes} placeholder="Works from home, two cats, wants more storage…" onChange={(e) => setNotes(e.target.value)} />
      </label>
      {configured ? (
        <button className="primary" disabled={busy} onClick={run}>
          {busy ? "Thinking, usually under a minute…" : concepts.length ? "Generate new ideas" : "Brainstorm ideas"}
        </button>
      ) : (
        <ChatBridge
          getPrompt={() => chatPrompt(BRAINSTORM_SYSTEM, brainstormTask(request()), BrainstormSchema)}
          schema={BrainstormSchema}
          chatStep=""
          importLabel="Show ideas"
          onImport={(result) => show(result.concepts)}
        />
      )}
      {error && <p className="error">{error}</p>}

      {concepts.map((c, ci) => (
        <article className="concept" key={ci}>
          <h3>{c.name}</h3>
          <p className="tagline">{c.tagline}</p>
          <div className="palette">
            {c.palette.map((p) => (
              <span key={p.name + p.hex} style={{ background: p.hex }} title={`${p.name} ${p.hex}`} />
            ))}
          </div>
          <p>{c.why_it_fits}</p>
          <button onClick={() => onApplyColors(c)}>Try these wall and floor colours</button>
          <h4>Layout</h4>
          <ul>
            {c.layout_moves.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <h4>Add to the room</h4>
          <ul className="adds">
            {c.add_items.map((s, si) => {
              const key = `${ci}-${si}`;
              return (
                <li key={key}>
                  <div>
                    <strong>{s.label}</strong>
                    <span>{s.why}</span>
                  </div>
                  <button
                    disabled={added.has(key)}
                    onClick={() => {
                      onAddItem(s);
                      setAdded((prev) => new Set(prev).add(key));
                    }}
                  >
                    {added.has(key) ? "Added" : "Add"}
                  </button>
                </li>
              );
            })}
          </ul>
          <h4>Lighting</h4>
          <p>{c.lighting}</p>
          <h4>Budget</h4>
          <p>{c.budget_note}</p>
        </article>
      ))}
    </>
  );
}
