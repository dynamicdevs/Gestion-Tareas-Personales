import { CATEGORY_META, STATE_META, TYPE_META, MODALITY_META, type Task } from "../types";
import { daysUntil, fmtDate, fmtMeetingRange } from "../utils";

interface Props {
  task: Task;
  onToggleDone: (task: Task) => void;
  onToggleSubtask: (task: Task, subId: string, done: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

const prioBorder: Record<string, string> = {
  urgente: "border-l-red-500",
  alta: "border-l-orange-500",
  media: "border-l-yellow-500",
  baja: "border-l-green-500",
};

const stateBadge: Record<string, string> = {
  pendiente: "bg-fg-dim/20 text-fg-dim",
  curso: "bg-yellow-500/20 text-yellow-400",
  hecha: "bg-green-500/20 text-green-400",
};

export default function TaskCard({ task, onToggleDone, onToggleSubtask, onEdit, onDelete }: Props) {
  const done = task.state === "hecha";
  const subDone = task.subtasks.filter((s) => s.done).length;
  const subTotal = task.subtasks.length;
  const pct = subTotal ? Math.round((subDone / subTotal) * 100) : 0;

  // Texto base de la fecha según el tipo.
  const baseDateText = (() => {
    if (!task.due) return "";
    if (task.type === "reunion") return fmtMeetingRange(task.due, task.endDate);
    if (task.type === "evento" && task.endDate) return `${fmtDate(task.due)} – ${fmtDate(task.endDate)}`;
    return fmtDate(task.due);
  })();

  let fechaBadge = null;
  if (task.due) {
    const d = daysUntil(task.due)!;
    let cls = "bg-surface-soft text-fg-dim";
    let txt = `📅 ${baseDateText}`;
    if (!done && d < 0) {
      cls = "bg-red-500/20 text-red-400 font-semibold";
      txt = `⚠ ${baseDateText} (${-d}d tarde)`;
    } else if (!done && d <= 3) {
      cls = "bg-yellow-500/20 text-yellow-400";
      txt = `📅 ${baseDateText}${d === 0 ? " (hoy)" : ` (${d}d)`}`;
    }
    fechaBadge = <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{txt}</span>;
  }

  return (
    <div
      className={`surface border-l-4 ${prioBorder[task.priority]} rounded-2xl p-4 transition hover:shadow-xl hover:shadow-black/20 ${
        done ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="w-5 h-5 mt-0.5 accent-green-500 cursor-pointer flex-shrink-0"
          checked={done}
          onChange={() => onToggleDone(task)}
        />
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-fg ${done ? "line-through" : ""}`}>{task.title}</div>
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            {task.type !== "tarea" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                {TYPE_META[task.type].icon} {TYPE_META[task.type].label}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
              {CATEGORY_META[task.category].icon} {CATEGORY_META[task.category].label}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${stateBadge[task.state]}`}>
              {STATE_META[task.state].label}
            </span>
            {task.type === "reunion" && task.modality && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-soft text-fg-dim font-medium">
                {MODALITY_META[task.modality].icon} {MODALITY_META[task.modality].label}
              </span>
            )}
            {fechaBadge}
            {task.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400">
                #{tag}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button className="text-fg-dim hover:bg-surface-soft rounded-lg px-2 py-1 transition" onClick={() => onEdit(task)}>
            ✏️
          </button>
          <button className="text-fg-dim hover:bg-surface-soft rounded-lg px-2 py-1 transition" onClick={() => onDelete(task)}>
            🗑️
          </button>
        </div>
      </div>

      {subTotal > 0 && (
        <>
          <div className="pl-8 mt-3 space-y-1">
            {task.subtasks.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-fg-dim cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-green-500"
                  checked={s.done}
                  onChange={(e) => onToggleSubtask(task, s.id, e.target.checked)}
                />
                <span className={s.done ? "line-through" : ""}>{s.text}</span>
              </label>
            ))}
          </div>
          <div className="h-1.5 bg-surface-soft rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundImage: "linear-gradient(to right, rgb(var(--accent)), rgb(var(--accent-2)))" }}
            />
          </div>
        </>
      )}

      {task.notes && <div className="pl-8 mt-2 text-sm text-fg-dim whitespace-pre-wrap">📝 {task.notes}</div>}
    </div>
  );
}
