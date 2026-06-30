import { useEffect, useState } from "react";
import {
  CATEGORIES,
  PRIORITIES,
  STATES,
  TYPES,
  MODALITIES,
  CATEGORY_META,
  STATE_META,
  TYPE_META,
  MODALITY_META,
  projectTerm,
  type Task,
  type TaskInput,
  type Project,
  type RubricInput,
  type RubricItemInput,
} from "../types";
import { toDateInput, fromDateInput, toTimeInput, combineDateTime, addMinutesToTime } from "../utils";
import RubricEditor from "./RubricEditor";

interface Props {
  task: Task | null; // null = crear
  defaultCategory: TaskInput["category"];
  defaultState?: TaskInput["state"];
  defaultProjectId?: string | null;
  defaultType?: TaskInput["type"];
  defaultDue?: string | null; // ISO, para preseleccionar fecha/hora (agendar desde calendario)
  draft?: TaskInput | null; // borrador propuesto por la IA, para editar antes de crear
  projects: Project[];
  onClose: () => void;
  onSave: (data: TaskInput) => void;
}

const PRIO_LABEL: Record<string, string> = { urgente: "🔥 Urgente", alta: "Alta", media: "Media", baja: "Baja" };

export default function TaskModal({
  task,
  defaultCategory,
  defaultState = "pendiente",
  defaultProjectId = null,
  defaultType = "tarea",
  defaultDue = null,
  draft = null,
  projects,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskInput["type"]>("tarea");
  const [category, setCategory] = useState<TaskInput["category"]>(defaultCategory);
  const [priority, setPriority] = useState<TaskInput["priority"]>("media");
  const [state, setState] = useState<TaskInput["state"]>(defaultState);
  const [due, setDue] = useState(""); // tarea: date | evento: date (inicio)
  const [endDate, setEndDate] = useState(""); // evento: date (fin)
  // Reunión: fecha + hora inicio + hora fin (campos separados).
  const [meetDate, setMeetDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [modality, setModality] = useState<TaskInput["modality"]>(null);
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [subtasks, setSubtasks] = useState<{ text: string; done: boolean }[]>([]);
  // Rúbrica de la reunión (instancia).
  const [rubricObjective, setRubricObjective] = useState("");
  const [rubricItems, setRubricItems] = useState<RubricItemInput[]>([]);
  const [rubricSourceId, setRubricSourceId] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setType(task.type);
      setCategory(task.category);
      setPriority(task.priority);
      setState(task.state);
      setProjectId(task.projectId);
      setModality(task.modality);
      setTags(task.tags.join(", "));
      setNotes(task.notes);
      setSubtasks(task.subtasks.map((s) => ({ text: s.text, done: s.done })));
      if (task.type === "reunion") {
        setMeetDate(toDateInput(task.due));
        setStartTime(toTimeInput(task.due));
        setEndTime(toTimeInput(task.endDate));
      } else {
        setDue(toDateInput(task.due));
        setEndDate(toDateInput(task.endDate));
      }
      // Cargar rúbrica existente.
      if (task.rubric) {
        setRubricObjective(task.rubric.objective);
        setRubricSourceId(task.rubric.sourceId);
        setRubricItems(
          task.rubric.items.map((it) => ({
            title: it.title,
            kind: it.kind,
            done: it.done,
            notes: it.notes,
            responsible: it.responsible,
          }))
        );
      } else {
        setRubricObjective("");
        setRubricItems([]);
        setRubricSourceId(null);
      }
    } else if (draft) {
      // Borrador propuesto por la IA: precargar todos los campos para editar antes de crear.
      setTitle(draft.title);
      setType(draft.type);
      setCategory(draft.category);
      setPriority(draft.priority);
      setState(draft.state);
      setProjectId(draft.projectId);
      setModality(draft.modality);
      setTags(draft.tags.join(", "));
      setNotes(draft.notes);
      setSubtasks(draft.subtasks.map((s) => ({ text: s.text, done: s.done })));
      setRubricObjective("");
      setRubricItems([]);
      setRubricSourceId(null);
      if (draft.type === "reunion") {
        setMeetDate(toDateInput(draft.due));
        setStartTime(toTimeInput(draft.due));
        setEndTime(toTimeInput(draft.endDate));
      } else {
        setDue(toDateInput(draft.due));
        setEndDate(toDateInput(draft.endDate));
      }
    } else {
      setType(defaultType);
      setCategory(defaultCategory);
      setState(defaultState);
      setProjectId(defaultProjectId);
      setModality(defaultType === "reunion" ? "presencial" : null);
      setTitle("");
      setNotes("");
      setTags("");
      setSubtasks([]);
      setDue("");
      setEndDate("");
      setMeetDate("");
      setStartTime("");
      setEndTime("");
      setRubricObjective("");
      setRubricItems([]);
      setRubricSourceId(null);
      // Agendar desde el calendario: fecha+hora preseleccionada, +30 min de fin por defecto.
      if (defaultDue && defaultType === "reunion") {
        setMeetDate(toDateInput(defaultDue));
        const start = toTimeInput(defaultDue);
        setStartTime(start);
        setEndTime(addMinutesToTime(start, 30));
      } else if (defaultDue) {
        setDue(toDateInput(defaultDue));
      }
    }
  }, [task, defaultCategory, defaultState, defaultProjectId, defaultType, defaultDue, draft]);

  // Cuando cambia la hora de inicio, ajustamos el fin para mantener al menos 30 min.
  function changeStart(t: string) {
    setStartTime(t);
    if (t && (!endTime || endTime <= t)) setEndTime(addMinutesToTime(t, 30));
  }

  function changeType(t: TaskInput["type"]) {
    setType(t);
    setDue("");
    setEndDate("");
    setMeetDate("");
    setStartTime("");
    setEndTime("");
    setModality(t === "reunion" ? "presencial" : null);
  }

  // Proyectos disponibles para la categoría seleccionada en el formulario.
  // Se ocultan los finalizados, salvo que la tarea editada ya pertenezca a uno
  // (para no perder su asignación al editarla).
  const availableProjects = projects.filter(
    (p) => p.category === category && (!p.finishedAt || p.id === projectId)
  );

  // Una reunión con fin <= inicio es inválida.
  const invalidMeetingTime = type === "reunion" && !!startTime && !!endTime && endTime <= startTime;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit() {
    if (!title.trim()) return;
    // Cada tipo compone due/endDate de forma distinta:
    let dueIso: string | null;
    let endIso: string | null;
    if (type === "reunion") {
      dueIso = combineDateTime(meetDate, startTime);
      endIso = combineDateTime(meetDate, endTime);
    } else if (type === "evento") {
      dueIso = fromDateInput(due);
      endIso = fromDateInput(endDate);
    } else {
      dueIso = fromDateInput(due);
      endIso = null;
    }
    onSave({
      title: title.trim(),
      type,
      category,
      priority,
      state,
      due: dueIso,
      endDate: endIso,
      modality: type === "reunion" ? modality : null,
      // Solo conservamos el proyecto si pertenece a la categoría elegida.
      projectId: availableProjects.some((p) => p.id === projectId) ? projectId : null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: notes.trim(),
      subtasks: subtasks.filter((s) => s.text.trim()).map((s) => ({ ...s, text: s.text.trim() })),
      rubric: buildRubricInput(),
    });
  }

  // Construye la rúbrica solo si es reunión y tiene contenido.
  function buildRubricInput(): RubricInput | null {
    if (type !== "reunion") return null;
    const items = rubricItems.filter((it) => it.title.trim());
    if (!rubricObjective.trim() && items.length === 0) return null;
    return {
      name: title.trim(),
      objective: rubricObjective.trim(),
      sourceId: rubricSourceId,
      items: items.map((it) => ({ ...it, title: it.title.trim() })),
    };
  }

  const inputCls = "field-input";

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <h2 className="text-lg font-bold mb-4 text-fg flex items-center gap-2">
          <span className="text-accent">{task ? "✏️" : "✨"}</span>
          {task ? `Editar ${TYPE_META[type].label.toLowerCase()}` : `Nuevo/a ${TYPE_META[type].label.toLowerCase()}`}
        </h2>

        {/* Selector de tipo */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => changeType(t)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-sm font-medium transition border ${
                type === t
                  ? "bg-accent/15 border-accent/50 text-accent"
                  : "border-line/20 text-fg-dim hover:bg-surface-soft/60"
              }`}
            >
              <span className="text-lg">{TYPE_META[t].icon}</span>
              {TYPE_META[t].label}
            </button>
          ))}
        </div>

        <label className="block text-xs text-fg-dim mb-1">Título *</label>
        <input
          autoFocus
          className={inputCls + " mb-4"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "reunion" ? "ej: Daily con el equipo" : type === "evento" ? "ej: Vacaciones / Conferencia" : "¿Qué hay que hacer?"
          }
        />

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-fg-dim mb-1">Apartado</label>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as any)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-fg-dim mb-1">Prioridad</label>
            <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value as any)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIO_LABEL[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-fg-dim mb-1">Estado</label>
            <select className={inputCls} value={state} onChange={(e) => setState(e.target.value as any)}>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {STATE_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            {/* El campo de fecha cambia según el tipo. Reunión usa fecha aquí y horas en fila aparte. */}
            {type === "reunion" ? (
              <>
                <label className="block text-xs text-fg-dim mb-1">Fecha</label>
                <input type="date" className={inputCls} value={meetDate} onChange={(e) => setMeetDate(e.target.value)} />
              </>
            ) : type === "evento" ? (
              <>
                <label className="block text-xs text-fg-dim mb-1">Inicio</label>
                <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
              </>
            ) : (
              <>
                <label className="block text-xs text-fg-dim mb-1">Fecha límite</label>
                <input type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} />
              </>
            )}
          </div>
        </div>

        {/* Campos específicos por tipo */}
        {type === "reunion" && (
          <>
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-xs text-fg-dim mb-1">Hora inicio</label>
                <input
                  type="time"
                  className={inputCls}
                  value={startTime}
                  step={300}
                  onChange={(e) => changeStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-fg-dim mb-1">Hora fin</label>
                <input
                  type="time"
                  className={inputCls}
                  value={endTime}
                  step={300}
                  min={startTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>
            {startTime && endTime && endTime <= startTime && (
              <p className="text-xs text-red-400 -mt-2 mb-3">La hora de fin debe ser posterior a la de inicio.</p>
            )}

            <div className="mb-4">
              <label className="block text-xs text-fg-dim mb-1">Modalidad</label>
              <div className="grid grid-cols-2 gap-2">
                {MODALITIES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModality(m)}
                    className={`py-2 rounded-xl text-sm font-medium transition border ${
                      modality === m
                        ? "bg-accent/15 border-accent/50 text-accent"
                        : "border-line/20 text-fg-dim hover:bg-surface-soft/60"
                    }`}
                  >
                    {MODALITY_META[m].icon} {MODALITY_META[m].label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {type === "evento" && (
          <div className="mb-4">
            <label className="block text-xs text-fg-dim mb-1">Fin (opcional, para eventos de varios días)</label>
            <input type="date" className={inputCls} value={endDate} min={due} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        )}

        <label className="block text-xs text-fg-dim mb-1">{projectTerm(category)}</label>
        <select
          className={inputCls + " mb-4"}
          value={projectId ?? ""}
          onChange={(e) => setProjectId(e.target.value || null)}
        >
          <option value="">Sin {projectTerm(category).toLowerCase()}</option>
          {availableProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="block text-xs text-fg-dim mb-1">Etiquetas (separadas por comas)</label>
        <input
          className={inputCls + " mb-4"}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="ej: urgente, reunión, react"
        />

        <label className="block text-xs text-fg-dim mb-1">Notas</label>
        <textarea
          className={inputCls + " mb-4 resize-y"}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Detalles, enlaces, contexto..."
        />

        {/* Puntos de la reunión (opcional, puede quedar vacío) */}
        {type === "reunion" && (
          <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/[0.04] p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-fg flex items-center gap-2">📋 Puntos de la reunión</h3>
              <span className="text-[11px] text-fg-dim">Opcional</span>
            </div>
            <RubricEditor
              mode="instance"
              objective={rubricObjective}
              items={rubricItems}
              meetingTitle={title}
              onObjectiveChange={setRubricObjective}
              onItemsChange={setRubricItems}
              onMinutesToNotes={(text) =>
                setNotes((prev) => (prev.trim() ? prev + "\n\n" + text : text))
              }
            />
          </div>
        )}

        <label className="block text-xs text-fg-dim mb-1">Subtareas</label>
        <div className="space-y-2 mb-2">
          {subtasks.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="checkbox"
                className="accent-green-500 w-4 h-4"
                checked={s.done}
                onChange={(e) =>
                  setSubtasks((prev) => prev.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))
                }
              />
              <input
                className={inputCls + " flex-1"}
                value={s.text}
                placeholder="Paso..."
                onChange={(e) =>
                  setSubtasks((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                }
              />
              <button
                className="text-fg-dim hover:text-red-400 px-2 transition"
                onClick={() => setSubtasks((prev) => prev.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          className="btn-ghost text-sm px-3 py-1.5"
          onClick={() => setSubtasks((prev) => [...prev, { text: "", done: false }])}
        >
          + Añadir subtarea
        </button>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary px-5 py-2 text-sm" disabled={!title.trim() || invalidMeetingTime} onClick={submit}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
