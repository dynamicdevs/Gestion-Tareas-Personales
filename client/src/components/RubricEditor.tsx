import { useState } from "react";
import { RUBRIC_KINDS, RUBRIC_KIND_META, type RubricItemInput, type RubricKind } from "../types";
import { api } from "../api";
import { useConfirm } from "../confirm";

interface Props {
  objective: string;
  items: RubricItemInput[];
  mode: "template" | "instance";
  meetingTitle?: string; // título de la reunión (contexto para la IA)
  onObjectiveChange: (v: string) => void;
  onItemsChange: (items: RubricItemInput[]) => void;
  onMinutesToNotes?: (text: string) => void; // volcar el acta a las notas de la reunión
}

const inputCls = "field-input";

function emptyItem(kind: RubricKind = "punto"): RubricItemInput {
  return { title: "", kind, done: false, notes: "", responsible: "" };
}

// Editor reutilizable de rúbrica. En "template" solo título/tipo/orden;
// en "instance" añade marcar tratado, notas y responsable, y asistencia de IA.
export default function RubricEditor({
  objective,
  items,
  mode,
  meetingTitle = "",
  onObjectiveChange,
  onItemsChange,
  onMinutesToNotes,
}: Props) {
  const isInstance = mode === "instance";
  const confirm = useConfirm();
  const [suggesting, setSuggesting] = useState(false);
  const [generatingMinutes, setGeneratingMinutes] = useState(false);
  const [minutes, setMinutes] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  async function suggestWithAI() {
    const title = meetingTitle.trim();
    if (!title) {
      setAiError("Ponle un título a la reunión para sugerir el orden del día.");
      return;
    }
    if (items.some((it) => (it.title ?? "").trim())) {
      const ok = await confirm({
        title: "Sugerir orden del día",
        message: "Se añadirán puntos sugeridos por IA a los que ya tienes. ¿Continuar?",
        confirmText: "Sugerir",
      });
      if (!ok) return;
    }
    setAiError(null);
    setSuggesting(true);
    try {
      const res = await api.aiSuggestRubric(title, objective);
      const nuevos: RubricItemInput[] = res.items.map((s) => ({
        title: s.title,
        kind: (RUBRIC_KINDS as readonly string[]).includes(s.kind) ? (s.kind as RubricKind) : "punto",
        done: false,
        notes: "",
        responsible: "",
      }));
      // Quitamos los items vacíos previos antes de añadir las sugerencias.
      onItemsChange([...items.filter((it) => (it.title ?? "").trim()), ...nuevos]);
    } catch {
      setAiError("No pude sugerir el orden del día (¿está corriendo Ollama?).");
    } finally {
      setSuggesting(false);
    }
  }

  async function generateMinutesAI() {
    setAiError(null);
    setGeneratingMinutes(true);
    try {
      const res = await api.aiMinutes({
        title: meetingTitle.trim() || "Reunión",
        objective,
        items: items
          .filter((it) => (it.title ?? "").trim())
          .map((it) => ({ title: it.title, kind: it.kind, notes: it.notes, responsible: it.responsible, done: it.done })),
      });
      setMinutes(res.text);
    } catch {
      setAiError("No pude generar el acta (¿está corriendo Ollama?).");
    } finally {
      setGeneratingMinutes(false);
    }
  }

  const hasNotes = items.some((it) => (it.notes ?? "").trim());

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
      {/* Objetivo / descripción */}
      <label className="block text-xs text-fg-dim mb-1">
        {isInstance ? "🎯 Objetivo de la reunión" : "🎯 Descripción / objetivo de la rúbrica"}
      </label>
      <textarea
        className={inputCls + " mb-4 resize-y"}
        rows={2}
        value={objective}
        onChange={(e) => onObjectiveChange(e.target.value)}
        placeholder={isInstance ? "¿Qué se quiere lograr en esta reunión?" : "¿De qué trata esta rúbrica y cuándo usarla?"}
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
                  checked={!!it.done}
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
                value={it.title ?? ""}
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
                  value={it.responsible ?? ""}
                  placeholder="👤 Responsable"
                  onChange={(e) => update(i, { responsible: e.target.value })}
                />
                <input
                  className="field-input flex-[2] text-sm py-1.5"
                  value={it.notes ?? ""}
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

      {/* Asistencia de IA (solo en la instancia de una reunión) */}
      {isInstance && (
        <div className="mt-3 pt-3 border-t border-line/15">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50"
              disabled={suggesting}
              onClick={suggestWithAI}
            >
              {suggesting ? "✨ Generando…" : "✨ Sugerir con IA"}
            </button>
            {hasNotes && (
              <button
                type="button"
                className="btn-ghost text-xs px-3 py-1.5 disabled:opacity-50"
                disabled={generatingMinutes}
                onClick={generateMinutesAI}
              >
                {generatingMinutes ? "📝 Generando…" : "📝 Generar acta"}
              </button>
            )}
          </div>

          {aiError && <div className="text-[11px] text-red-400 mt-2">⚠ {aiError}</div>}

          {/* Acta generada */}
          {minutes && (
            <div className="mt-3 rounded-xl border border-accent/30 bg-accent/[0.04] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-fg">📋 Acta generada</span>
                <button type="button" className="text-fg-dim hover:text-fg text-xs" onClick={() => setMinutes(null)}>
                  ✕
                </button>
              </div>
              <textarea
                className="field-input w-full text-xs resize-y"
                rows={8}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="btn-ghost text-xs px-3 py-1.5"
                  onClick={() => navigator.clipboard?.writeText(minutes)}
                >
                  📋 Copiar
                </button>
                {onMinutesToNotes && (
                  <button
                    type="button"
                    className="btn-primary text-xs px-3 py-1.5"
                    onClick={() => {
                      onMinutesToNotes(minutes);
                      setMinutes(null);
                    }}
                  >
                    ↧ Volcar a notas
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
