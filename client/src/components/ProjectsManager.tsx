import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { CATEGORIES, CATEGORY_META, projectTerm, type Project, type Task } from "../types";
import { useConfirm } from "../confirm";

// Auto-scroll al arrastrar: si el cursor está cerca del borde superior/inferior
// del contenedor con scroll (el <main>), lo desplazamos solo para alcanzar
// proyectos que están fuera de la pantalla.
const EDGE = 90; // px desde el borde donde empieza a desplazar
const MAX_SPEED = 18; // px por frame

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el;
  while (node && node !== document.body) {
    const oy = getComputedStyle(node).overflowY;
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

interface Props {
  projects: Project[];
  tasks: Task[];
  onChanged: () => void;
}

// Editor de nombres de proyectos + dashboard agrupado por apartado
// (Trabajo / Proyectos personales / Estudios) con la cantidad de tareas.
// Permite arrastrar las tareas sin proyecto sobre la tarjeta de un proyecto
// para asociarlas (si el proyecto es de otro apartado, la tarea cambia de apartado).
export default function ProjectsManager({ projects, tasks, onChanged }: Props) {
  const confirm = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);

  // Drag & drop: tarea que se arrastra + id del proyecto sobre el que se está.
  const [dragTask, setDragTask] = useState<Task | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Auto-scroll durante el arrastre.
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const speedRef = useRef(0);

  function autoScrollLoop() {
    const el = scrollerRef.current;
    if (el && speedRef.current !== 0) {
      el.scrollTop += speedRef.current;
    }
    rafRef.current = requestAnimationFrame(autoScrollLoop);
  }

  function startAutoScroll() {
    scrollerRef.current = findScrollParent(rootRef.current) ?? document.scrollingElement as HTMLElement;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(autoScrollLoop);
  }

  function stopAutoScroll() {
    speedRef.current = 0;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  // Ajusta la velocidad de scroll según la posición del cursor (llamado en onDragOver).
  function updateAutoScroll(clientY: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const top = rect.top;
    const bottom = rect.bottom;
    if (clientY < top + EDGE) {
      const intensity = (top + EDGE - clientY) / EDGE; // 0..1
      speedRef.current = -Math.ceil(intensity * MAX_SPEED);
    } else if (clientY > bottom - EDGE) {
      const intensity = (clientY - (bottom - EDGE)) / EDGE;
      speedRef.current = Math.ceil(intensity * MAX_SPEED);
    } else {
      speedRef.current = 0;
    }
  }

  // Seguridad: si el componente se desmonta a mitad de arrastre, paramos el loop.
  useEffect(() => stopAutoScroll, []);

  // Cantidad de tareas hechas por proyecto (taskCount viene del servidor = total).
  const doneByProject = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of tasks) {
      if (t.projectId && t.state === "hecha") m[t.projectId] = (m[t.projectId] || 0) + 1;
    }
    return m;
  }, [tasks]);

  // Tareas sin proyecto, agrupadas por apartado.
  const orphansByCategory = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!t.projectId) (m[t.category] ??= []).push(t);
    }
    return m;
  }, [tasks]);

  const totalOrphans = useMemo(
    () => Object.values(orphansByCategory).reduce((a, l) => a + l.length, 0),
    [orphansByCategory]
  );

  // Asocia una tarea a un proyecto. Si el proyecto es de otro apartado, la tarea
  // cambia de apartado (mandamos category junto al projectId).
  async function assignProject(task: Task, project: Project) {
    if (task.projectId === project.id) return;
    setAssigningId(task.id);
    try {
      const payload =
        task.category === project.category
          ? { projectId: project.id }
          : { projectId: project.id, category: project.category };
      await api.patch(task.id, payload);
      onChanged();
    } finally {
      setAssigningId(null);
    }
  }

  function handleDrop(project: Project) {
    const t = dragTask;
    setDragTask(null);
    setDropTargetId(null);
    stopAutoScroll();
    if (t) assignProject(t, project);
  }

  function startEdit(p: Project) {
    setEditingId(p.id);
    setDraftName(p.name);
  }

  async function saveEdit(p: Project) {
    // Guard: al abrir el diálogo el input pierde el foco y dispara onBlur otra vez.
    if (saving) return;
    const name = draftName.trim();
    if (!name || name === p.name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    try {
      const term = projectTerm(p.category).toLowerCase();
      const ok = await confirm({
        title: `Renombrar ${term}`,
        message: `¿Cambiar el nombre de "${p.name}" a "${name}"? Las ${p.taskCount} tareas asociadas se conservan.`,
        confirmText: "Renombrar",
      });
      // Si cancela, dejamos el input abierto para que corrija o pulse Esc.
      if (!ok) return;
      await api.renameProject(p.id, name);
      setEditingId(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Project) {
    const term = projectTerm(p.category).toLowerCase();
    const tareas =
      p.taskCount === 0
        ? "No tiene tareas asociadas."
        : `Sus ${p.taskCount} tarea${p.taskCount === 1 ? "" : "s"} NO se borran: quedan sin ${term} y seguirás viéndolas en su apartado.`;
    const ok = await confirm({
      title: `Eliminar ${term}`,
      message: `¿Seguro que quieres eliminar el ${term} "${p.name}"? ${tareas} Esta acción no se puede deshacer.`,
      confirmText: `Sí, eliminar ${term}`,
      danger: true,
    });
    if (!ok) return;
    await api.removeProject(p.id);
    onChanged();
  }

  const totalProjects = projects.length;
  const totalTasksInProjects = projects.reduce((acc, p) => acc + p.taskCount, 0);
  const dragging = dragTask !== null;

  return (
    <div
      ref={rootRef}
      onDragOver={(e) => {
        // Mientras se arrastra, vigilamos la posición vertical para auto-scroll.
        if (dragging) updateAutoScroll(e.clientY);
      }}
    >
      <header className="mb-6">
        <h2 className="text-xl font-bold text-fg flex items-center gap-2">
          <span className="text-accent">📂</span> Editor de proyectos
        </h2>
        <p className="text-sm text-fg-dim mt-1">
          Renombra tus proyectos, mira cuántas tareas tiene cada uno y arrastra las tareas sueltas sobre
          un proyecto para asociarlas.
        </p>
      </header>

      {/* Resumen global */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <SummaryCard icon="📁" label="Proyectos / cursos" value={totalProjects} color="text-accent" />
        <SummaryCard icon="📊" label="Tareas en proyectos" value={totalTasksInProjects} color="text-fg" />
        <SummaryCard
          icon="✅"
          label="Tareas completadas"
          value={Object.values(doneByProject).reduce((a, b) => a + b, 0)}
          color="text-green-400"
        />
      </div>

      {/* Grupos por apartado */}
      <div className="space-y-8">
        {CATEGORIES.map((cat) => {
          const items = projects.filter((p) => p.category === cat);
          const tasksInCat = items.reduce((acc, p) => acc + p.taskCount, 0);
          return (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{CATEGORY_META[cat].icon}</span>
                <h3 className="font-semibold text-fg">{CATEGORY_META[cat].label}</h3>
                <span className="text-xs text-fg-dim">
                  · {items.length} {projectTerm(cat, items.length !== 1).toLowerCase()} · {tasksInCat} tareas
                </span>
              </div>

              {items.length === 0 ? (
                <div className="glass rounded-xl px-4 py-6 text-center text-sm text-fg-dim">
                  No hay {projectTerm(cat, true).toLowerCase()} en este apartado todavía.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => {
                    const done = doneByProject[p.id] || 0;
                    const pct = p.taskCount ? Math.round((done / p.taskCount) * 100) : 0;
                    const isEditing = editingId === p.id;
                    const isOver = dropTargetId === p.id;
                    // El destino cambiaría el apartado de la tarea arrastrada.
                    const crossSection = dragging && dragTask!.category !== p.category;
                    return (
                      <div
                        key={p.id}
                        onDragOver={(e) => {
                          if (!dragging) return;
                          e.preventDefault();
                          if (dropTargetId !== p.id) setDropTargetId(p.id);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDropTargetId((cur) => (cur === p.id ? null : cur));
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDrop(p);
                        }}
                        className={`glass rounded-2xl p-4 flex flex-col gap-3 transition ${
                          isOver
                            ? "ring-2 ring-accent/70 bg-accent/10 -translate-y-0.5"
                            : dragging
                            ? "ring-1 ring-accent/25 hover:-translate-y-0.5"
                            : "hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {isEditing ? (
                            <input
                              autoFocus
                              className="field-input text-sm"
                              value={draftName}
                              disabled={saving}
                              onChange={(e) => setDraftName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(p);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              onBlur={() => saveEdit(p)}
                            />
                          ) : (
                            <span className="font-medium text-fg break-words flex-1">{p.name}</span>
                          )}
                          {!isEditing && !dragging && (
                            <div className="flex gap-1 flex-shrink-0">
                              <button
                                className="text-fg-dim hover:text-accent transition text-sm"
                                title="Renombrar"
                                onClick={() => startEdit(p)}
                              >
                                ✏️
                              </button>
                              <button
                                className="text-fg-dim hover:text-red-400 transition text-sm"
                                title="Eliminar"
                                onClick={() => remove(p)}
                              >
                                🗑
                              </button>
                            </div>
                          )}
                        </div>

                        {isOver ? (
                          <div className="text-xs text-accent font-medium py-1">
                            ⬇ Soltar para asociar
                            {crossSection && ` (pasará a ${CATEGORY_META[p.category].label})`}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 text-xs text-fg-dim">
                              <span className="text-fg font-semibold text-base">{p.taskCount}</span>
                              <span>tareas</span>
                              <span className="ml-auto">
                                {done}/{p.taskCount} hechas
                              </span>
                            </div>

                            {/* Barra de progreso */}
                            <div className="h-1.5 rounded-full bg-surface-soft overflow-hidden">
                              <div
                                className="h-full rounded-full bg-accent transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Tareas sin proyecto: arrastrar sobre un proyecto para asociarlas */}
      <section className="mt-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🗂️</span>
          <h3 className="font-semibold text-fg">Tareas sin proyecto</h3>
          <span className="text-xs text-fg-dim">· {totalOrphans} en total</span>
        </div>
        <p className="text-sm text-fg-dim mb-3">
          Arrastra cualquier tarea y suéltala sobre la tarjeta de un proyecto de arriba para asociarla.
          Si el proyecto es de otro apartado, la tarea se moverá a ese apartado.
        </p>

        {totalOrphans === 0 ? (
          <div className="glass rounded-xl px-4 py-6 text-center text-sm text-fg-dim">
            🎉 Todas tus tareas están asociadas a un proyecto.
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const orphans = orphansByCategory[cat] || [];
              if (orphans.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-2 text-sm">
                    <span>{CATEGORY_META[cat].icon}</span>
                    <span className="font-medium text-fg">{CATEGORY_META[cat].label}</span>
                    <span className="text-xs text-fg-dim">· {orphans.length}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {orphans.map((t) => {
                      const isAssigning = assigningId === t.id;
                      return (
                        <div
                          key={t.id}
                          draggable={!isAssigning}
                          onDragStart={() => {
                            setDragTask(t);
                            startAutoScroll();
                          }}
                          onDragEnd={() => {
                            setDragTask(null);
                            setDropTargetId(null);
                            stopAutoScroll();
                          }}
                          title="Arrastra sobre un proyecto para asociarla"
                          className={`glass rounded-xl px-3 py-2 flex items-center gap-2 text-sm select-none cursor-grab active:cursor-grabbing transition ${
                            dragTask?.id === t.id ? "opacity-40" : "hover:ring-1 hover:ring-accent/40"
                          }`}
                        >
                          <span className="text-fg-dim">⠿</span>
                          <span className="text-fg break-words max-w-[240px]">
                            {t.state === "hecha" && <span className="text-green-400 mr-1">✓</span>}
                            {t.title}
                          </span>
                          {isAssigning && <span className="text-xs text-accent">…</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass rounded-2xl px-5 py-4 flex items-center gap-4">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-fg-dim">{label}</div>
      </div>
    </div>
  );
}
