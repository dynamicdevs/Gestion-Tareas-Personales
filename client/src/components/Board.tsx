import { useState } from "react";
import { STATES, STATE_META, type State, type Task, type Project } from "../types";
import BoardCard from "./BoardCard";

interface Props {
  tasks: Task[];
  projects: Project[];
  onChangeState: (task: Task, state: State) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onAdd: (state: State) => void;
}

// Acento de cada columna (cabecera y borde superior).
const colMeta: Record<State, { dot: string; bar: string }> = {
  pendiente: { dot: "bg-slate-400", bar: "from-slate-400/60" },
  curso: { dot: "bg-yellow-400", bar: "from-yellow-400/70" },
  hecha: { dot: "bg-green-400", bar: "from-green-400/70" },
};

export default function Board({ tasks, projects, onChangeState, onEdit, onDelete, onAdd }: Props) {
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [overCol, setOverCol] = useState<State | null>(null);
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;

  function handleDrop(state: State) {
    if (dragTask && dragTask.state !== state) {
      onChangeState(dragTask, state);
    }
    setDragTask(null);
    setOverCol(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {STATES.map((state) => {
        const colTasks = tasks.filter((t) => t.state === state);
        const isOver = overCol === state;
        return (
          <div
            key={state}
            onDragOver={(e) => {
              e.preventDefault();
              if (overCol !== state) setOverCol(state);
            }}
            onDragLeave={(e) => {
              // Solo limpiar si el cursor sale realmente de la columna
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            onDrop={() => handleDrop(state)}
            className={`glass rounded-2xl p-3 flex flex-col transition-colors ${
              isOver ? "ring-2 ring-accent/60 bg-accent/5" : ""
            }`}
          >
            {/* Cabecera de columna */}
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${colMeta[state].dot}`} />
                <h3 className="font-semibold text-fg text-sm">{STATE_META[state].label}</h3>
                <span className="text-xs text-fg-dim bg-surface-soft px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>
              <button
                className="text-fg-dim hover:text-accent text-lg leading-none transition"
                title="Añadir tarea aquí"
                onClick={() => onAdd(state)}
              >
                ＋
              </button>
            </div>

            {/* Tarjetas */}
            <div className="flex flex-col gap-2.5 min-h-[120px] flex-1">
              {colTasks.length === 0 ? (
                <div className="flex-1 grid place-items-center text-xs text-fg-dim border-2 border-dashed border-line/20 rounded-xl py-8">
                  {isOver ? "Suelta aquí" : "Sin tareas"}
                </div>
              ) : (
                colTasks.map((task) => (
                  <BoardCard
                    key={task.id}
                    task={task}
                    projectName={projectName(task.projectId)}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDragStart={setDragTask}
                    onDragEnd={() => {
                      setDragTask(null);
                      setOverCol(null);
                    }}
                    dragging={dragTask?.id === task.id}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
