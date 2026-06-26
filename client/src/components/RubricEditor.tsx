import { RUBRIC_KINDS, RUBRIC_KIND_META, type RubricItemInput, type RubricKind } from "../types";

interface Props {
  objective: string;
  items: RubricItemInput[];
  mode: "template" | "instance";
  onObjectiveChange: (v: string) => void;
  onItemsChange: (items: RubricItemInput[]) => void;
}

const inputCls = "field-input";

function emptyItem(kind: RubricKind = "punto"): RubricItemInput {
  return { title: "", kind, done: false, notes: "", responsible: "" };
}

// Editor reutilizable de rúbrica. En "template" solo título/tipo/orden;
// en "instance" añade marcar tratado, notas y responsable.
export default function RubricEditor({ objective, items, mode, onObjectiveChange, onItemsChange }: Props) {
  const isInstance = mode === "instance";

  function update(i: number, patch: Partial<RubricItemInput>) {
    onItemsChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    onItemsChange(items.filter((_, j) => j !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onItemsChange(next);
  }
  function add(kind: RubricKind) {
    onItemsChange([...items, emptyItem(kind)]);
  }

  const doneCount = items.filter((it) => it.done).length;

  return (
    <div>
      {/* Objetivo */}
      <label className="block text-xs text-fg-dim mb-1">🎯 Objetivo de la reunión</label>
      <textarea
        className={inputCls + " mb-4 resize-y"}
        rows={2}
        value={objective}
        onChange={(e) => onObjectiveChange(e.target.value)}
        placeholder="¿Qué se quiere lograr en esta reunión?"
      />

      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-fg-dim">Puntos de la rúbrica</label>
        {isInstance && items.length > 0 && (
          <span className="text-[11px] text-fg-dim">{doneCount}/{items.length} tratados</span>
        )}
      </div>

      <div className="space-y-2 mb-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl border border-line/20 bg-surface-soft/40 p-2.5">
            <div className="flex items-center gap-2">
              {isInstance && (
                <input
                  type="checkbox"
                  className="accent-green-500 w-4 h-4 flex-shrink-0"
                  checked={it.done}
                  onChange={(e) => update(i, { done: e.target.checked })}
                  title="Marcar como tratado"
                />
              )}
              <select
                className="bg-surface-soft border border-line/30 rounded-lg text-xs px-1.5 py-1.5 text-fg flex-shrink-0"
                value={it.kind}
                onChange={(e) => update(i, { kind: e.target.value as RubricKind })}
                title="Tipo de punto"
              >
                {RUBRIC_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {RUBRIC_KIND_META[k].icon} {RUBRIC_KIND_META[k].label}
                  </option>
                ))}
              </select>
              <input
                className={inputCls + " flex-1"}
                value={it.title}
                placeholder="Describe el punto..."
                onChange={(e) => update(i, { title: e.target.value })}
              />
              <div className="flex flex-col flex-shrink-0">
                <button
                  type="button"
                  className="text-fg-dim hover:text-accent leading-none text-xs disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  title="Subir"
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="text-fg-dim hover:text-accent leading-none text-xs disabled:opacity-30"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  title="Bajar"
                >
                  ▼
                </button>
              </div>
              <button
                type="button"
                className="text-fg-dim hover:text-red-400 px-1 flex-shrink-0"
                onClick={() => remove(i)}
              >
                ✕
              </button>
            </div>

            {/* Solo en la instancia: notas y responsable */}
            {isInstance && (
              <div className="flex gap-2 mt-2 pl-6">
                <input
                  className="field-input flex-1 text-sm py-1.5"
                  value={it.responsible}
                  placeholder="👤 Responsable"
                  onChange={(e) => update(i, { responsible: e.target.value })}
                />
                <input
                  className="field-input flex-[2] text-sm py-1.5"
                  value={it.notes}
                  placeholder="📝 Notas / lo que se dijo"
                  onChange={(e) => update(i, { notes: e.target.value })}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Añadir por tipo */}
      <div className="flex flex-wrap gap-2">
        {RUBRIC_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className="btn-ghost text-xs px-3 py-1.5"
            onClick={() => add(k)}
          >
            + {RUBRIC_KIND_META[k].icon} {RUBRIC_KIND_META[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}
