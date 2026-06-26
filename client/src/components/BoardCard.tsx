import { CATEGORY_META, TYPE_META, MODALITY_META, type Task } from "../types";
import { daysUntil, fmtDate, fmtMeetingRange } from "../utils";

interface Props {
  task: Task;
  projectName: string | null;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
  dragging: boolean;
}

const prioDot: Record<string, string> = {
  urgente: "bg-red-500 urgent-dot",
  alta: "bg-orange-500",
  media: "bg-yellow-500",
  baja: "bg-green-500",
};
const prioLabel: Record<string, string> = { urgente: "Urgente", alta: "Alta", media: "Media", baja: "Baja" };

export default function BoardCard({ task, projectName, onEdit, onDelete, onDragStart, onDragEnd, dragging }: Props) {
  const subDone = task.subtasks.filter((s) => s.done).length;
  const subTotal = task.subtasks.length;
  const pct = subTotal ? Math.round((subDone / subTotal) * 100) : 0;
  const done = task.state === "hecha";
  const urgent = task.priority === "urgente" && !done;

  let fecha = null;
  if (task.due) {
    const d = daysUntil(task.due)!;
    let cls = "text-fg-dim";
    if (!done && d < 0) cls = "text-red-400 font-semibold";
    else if (!done && d <= 3) cls = "text-yellow-400";

    let txt: string;
    if (task.type === "reunion") {
      txt = `🗓 ${fmtMeetingRange(task.due, task.endDate)}`;
    } else if (task.type === "evento" && task.endDate) {
      txt = `🗓 ${fmtDate(task.due)} – ${fmtDate(task.endDate)}`;
    } else {
      txt = `🗓 ${fmtDate(task.due)}`;
    }
    const suffix = !done && d < 0 ? ` · ${-d}d tarde` : !done && d === 0 ? " · hoy" : "";

    fecha = <span className={`inline-flex items-center gap-1 ${cls}`}>{txt}{suffix}</span>;
  }

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      className={`surface rounded-xl p-3 cursor-grab active:cursor-grabbing group transition
        hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20
        ${urgent ? "ring-1 ring-red-500/50 bg-red-500/[0.04]" : ""}
        ${dragging ? "opacity-40 rotate-2 scale-95" : ""}`}
    >
      {/* Prioridad + categoría */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
            urgent ? "text-red-400" : "text-fg-dim font-medium"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${prioDot[task.priority]}`} />
          {urgent && "🔥 "}
          {prioLabel[task.priority]}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
          {CATEGORY_META[task.category].icon}
        </span>
      </div>

      {/* Tipo (reunión/evento) + modalidad */}
      {task.type !== "tarea" && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
            {TYPE_META[task.type].icon} {TYPE_META[task.type].label}
          </span>
          {task.type === "reunion" && task.modality && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-soft text-fg-dim font-medium">
              {MODALITY_META[task.modality].icon} {MODALITY_META[task.modality].label}
            </span>
          )}
          {task.rubric && task.rubric.items.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-soft text-fg-dim font-medium">
              📋 {task.rubric.items.filter((it) => it.done).length}/{task.rubric.items.length}
            </span>
          )}
        </div>
      )}

      {/* Título */}
      <div className={`text-sm font-semibold text-fg leading-snug ${done ? "line-through opacity-70" : ""}`}>
        {task.title}
      </div>

      {/* Proyecto / curso */}
      {projectName && (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-fg-dim">
          📁 {projectName}
        </div>
      )}

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Progreso subtareas */}
      {subTotal > 0 && (
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[10px] text-fg-dim mb-1">
            <span>✓ {subDone}/{subTotal}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1 bg-surface-soft rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundImage: "linear-gradient(to right, rgb(var(--accent)), rgb(var(--accent-2)))" }}
            />
          </div>
        </div>
      )}

      {/* Footer: fecha + borrar */}
      <div className="flex items-center justify-between mt-2.5 text-[11px]">
        <span>{fecha}</span>
        <button
          className="opacity-0 group-hover:opacity-100 text-fg-dim hover:text-red-400 transition"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
