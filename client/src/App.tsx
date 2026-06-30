import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Task, TaskInput } from "./types";
import { daysUntil } from "./utils";
import Sidebar, { type Section } from "./components/Sidebar";
import TaskCard from "./components/TaskCard";
import TaskModal from "./components/TaskModal";
import ProjectModal from "./components/ProjectModal";
import Board from "./components/Board";
import Calendar from "./components/Calendar";
import RubricManager from "./components/RubricManager";
import ProjectsManager from "./components/ProjectsManager";
import Analytics from "./components/Analytics";
import Faq from "./components/Faq";
import ChatPanel from "./components/ChatPanel";
import ToastStack, { type Toast } from "./components/ToastStack";
import { useMeetingReminders } from "./useMeetingReminders";
import { playChime } from "./chime";
import { useTheme } from "./useTheme";
import { useConfirm } from "./confirm";
import { projectTerm, type State, type Project, type Category, type RubricTemplate } from "./types";

const prioOrder: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 };

export default function App() {
  const { theme, toggle } = useTheme();
  const confirm = useConfirm();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [rubricTemplates, setRubricTemplates] = useState<RubricTemplate[]>([]);
  const [section, setSection] = useState<Section>("tasks");
  const [activeCategory, setActiveCategory] = useState<Category>("Trabajo");
  const [activeProject, setActiveProject] = useState<string>(""); // "" = todos los proyectos
  const [hideDone, setHideDone] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("fecha");
  const [filterPrio, setFilterPrio] = useState("");
  const [view, setView] = useState<"board" | "list" | "cal">(
    () => (localStorage.getItem("dd_view") as "board" | "list" | "cal") || "board"
  );

  function changeView(v: "board" | "list" | "cal") {
    setView(v);
    localStorage.setItem("dd_view", v);
  }

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [prefillState, setPrefillState] = useState<State | null>(null);
  // Para agendar desde el calendario: tipo reunión + fecha/hora preseleccionada.
  const [prefillMeeting, setPrefillMeeting] = useState<string | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  // Borrador de la IA que se está editando en el TaskModal (null = no hay).
  const [draftForModal, setDraftForModal] = useState<import("./types").TaskInput | null>(null);

  // Recordatorios de reunión: avisa a 30/15/5 min con popup + campanita.
  // Vigila TODAS las reuniones (no solo las del apartado visible).
  useMeetingReminders(tasks, (e) => {
    setToasts((prev) => [...prev, { id: e.id, title: e.title, minutesLeft: e.minutesLeft, due: e.due }]);
    playChime();
  });

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // Al clicar el toast, abrimos la reunión para editarla.
  function openToastTask(id: string) {
    const taskId = id.split(":")[0];
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setEditing(task);
      setModalOpen(true);
    }
    dismissToast(id);
  }

  async function reload() {
    try {
      const [t, p, r] = await Promise.all([api.list(), api.listProjects(), api.listRubrics()]);
      setTasks(t);
      setProjects(p);
      setRubricTemplates(r);
      setError(null);
    } catch (e: any) {
      setError(e.message || "No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  // Al cambiar de apartado, limpiamos el proyecto seleccionado y volvemos a la sección de tareas.
  function selectCategory(c: Category) {
    setActiveCategory(c);
    setActiveProject("");
    setSection("tasks");
  }

  // Proyectos del apartado actual.
  const categoryProjects = projects.filter((p) => p.category === activeCategory);

  async function createProject(name: string) {
    const created = await api.createProject(name, activeCategory);
    setProjects((prev) => [...prev, created]);
    setActiveProject(created.id);
    setProjectModalOpen(false);
  }

  async function deleteActiveProject() {
    const proj = projects.find((p) => p.id === activeProject);
    if (!proj) return;
    const term = projectTerm(proj.category).toLowerCase();
    const ok = await confirm({
      title: `Eliminar ${term}`,
      message: `¿Eliminar el ${term} "${proj.name}"? Las tareas no se borran, solo quedan sin ${term}.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    await api.removeProject(proj.id);
    setActiveProject("");
    reload();
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSave(data: TaskInput) {
    if (editing) await api.update(editing.id, data);
    else await api.create(data);
    setModalOpen(false);
    setEditing(null);
    setPrefillState(null);
    setPrefillMeeting(null);
    setDraftForModal(null);
    reload();
  }

  // Confirmar un borrador del chat: crea la tarea directamente.
  async function createFromChat(draft: TaskInput) {
    await api.create(draft);
    reload();
  }

  // Editar un borrador del chat antes de guardar: abre el modal precargado.
  function editFromChat(draft: TaskInput) {
    setEditing(null);
    setDraftForModal(draft);
    setModalOpen(true);
  }

  async function toggleDone(task: Task) {
    await api.patch(task.id, { state: task.state === "hecha" ? "pendiente" : "hecha" });
    reload();
  }

  // Cambia el estado al soltar una tarjeta en otra columna del tablero.
  // Optimista: actualiza la UI al instante y luego sincroniza con el servidor.
  async function changeState(task: Task, state: State) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, state } : t)));
    try {
      await api.patch(task.id, { state });
    } catch {
      reload(); // si falla, recargamos el estado real
    }
  }

  // Reprograma una reunión (mover o cambiar duración) desde el calendario. Optimista.
  async function rescheduleMeeting(task: Task, dueIso: string, endIso: string) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, due: dueIso, endDate: endIso } : t)));
    try {
      await api.patch(task.id, { due: dueIso, endDate: endIso });
    } catch {
      reload();
    }
  }

  async function toggleSubtask(task: Task, subId: string, done: boolean) {
    await api.toggleSubtask(task.id, subId, done);
    reload();
  }

  async function handleDelete(task: Task) {
    const ok = await confirm({
      title: "Eliminar tarea",
      message: `¿Eliminar "${task.title}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    await api.remove(task.id);
    reload();
  }

  // Estadísticas del apartado activo (respeta también el proyecto seleccionado).
  const scope = tasks.filter(
    (t) => t.category === activeCategory && (!activeProject || t.projectId === activeProject)
  );
  const stats = {
    total: scope.length,
    done: scope.filter((t) => t.state === "hecha").length,
    soon: scope.filter((t) => {
      const d = daysUntil(t.due);
      return t.state !== "hecha" && d !== null && d >= 0 && d <= 3;
    }).length,
    overdue: scope.filter((t) => {
      const d = daysUntil(t.due);
      return t.state !== "hecha" && d !== null && d < 0;
    }).length,
  };

  const visible = useMemo(() => {
    const q = search.toLowerCase();
    const list = tasks.filter((t) => {
      if (t.category !== activeCategory) return false;
      if (activeProject && t.projectId !== activeProject) return false;
      if (filterPrio && t.priority !== filterPrio) return false;
      if (hideDone && t.state === "hecha") return false;
      if (q) {
        const hay = (t.title + " " + t.notes + " " + t.tags.join(" ")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "prioridad") return prioOrder[a.priority] - prioOrder[b.priority];
      if (sortBy === "creada") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      // fecha límite
      if (!a.due && !b.due) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (!a.due) return 1;
      if (!b.due) return -1;
      return a.due.localeCompare(b.due);
    });
    return list;
  }, [tasks, activeCategory, activeProject, filterPrio, hideDone, search, sortBy]);

  const selectCls = "field-input cursor-pointer";

  return (
    <div className="min-h-screen text-fg">
      <header className="glass sticky top-0 z-20 px-6 py-4 flex items-center justify-between flex-wrap gap-3 border-b border-line/40">
        <div className="flex items-center gap-3">
          <span
            className="grid place-items-center w-10 h-10 rounded-xl text-on-accent text-lg"
            style={{
              backgroundImage: "linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))",
              boxShadow: "0 8px 22px -6px rgb(var(--accent) / 0.6)",
            }}
          >
            ▶
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase leading-none mb-1">
              Dynamic Devs
            </span>
            <h1 className="text-lg font-bold text-fg leading-none">Gestión de Tareas Personales</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn-ghost w-10 h-10 grid place-items-center text-lg"
            title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            onClick={toggle}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <span className="text-lg leading-none">＋</span> Nueva tarea
          </button>
        </div>
      </header>

      <div className="flex" style={{ minHeight: "calc(100vh - 73px)" }}>
        <Sidebar
          tasks={tasks}
          activeCategory={activeCategory}
          section={section}
          onCategory={selectCategory}
          onProjects={() => setSection("projects")}
          onAnalytics={() => setSection("analytics")}
          onRubrics={() => setSection("rubrics")}
          onFaq={() => setSection("faq")}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-500/15 border border-red-500/40 text-red-300 rounded-xl p-4 mb-5">
              ⚠ {error}. ¿Está corriendo el servidor? (npm run dev)
            </div>
          )}

          {section === "projects" ? (
            <ProjectsManager projects={projects} tasks={tasks} onChanged={reload} />
          ) : section === "analytics" ? (
            <Analytics projects={projects} tasks={tasks} />
          ) : section === "rubrics" ? (
            <RubricManager projects={projects} onChanged={reload} />
          ) : section === "faq" ? (
            <Faq />
          ) : (
          <>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { num: stats.total, lbl: "Tareas", icon: "📊", grad: "from-accent/20 to-accent-2/5", color: "text-accent" },
              { num: stats.done, lbl: "Completadas", icon: "✅", grad: "from-green-500/20 to-emerald-500/5", color: "text-green-400" },
              { num: stats.soon, lbl: "Vencen pronto", icon: "⏳", grad: "from-yellow-500/20 to-amber-500/5", color: "text-yellow-400" },
              { num: stats.overdue, lbl: "Vencidas", icon: "🔥", grad: "from-red-500/20 to-rose-500/5", color: "text-red-400" },
            ].map((s) => (
              <div
                key={s.lbl}
                className={`glass rounded-2xl px-5 py-4 bg-gradient-to-br ${s.grad} flex items-center gap-4 transition hover:-translate-y-0.5`}
              >
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.num}</div>
                  <div className="text-xs text-fg-dim">{s.lbl}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex gap-3 mb-6 flex-wrap items-center">
            {/* Selector de vista Tablero / Lista */}
            <div className="glass rounded-xl p-1 flex gap-1">
              {([
                { id: "board", label: "Tablero", icon: "▦" },
                { id: "list", label: "Lista", icon: "☰" },
                { id: "cal", label: "Calendario", icon: "📅" },
              ] as const).map((v) => (
                <button
                  key={v.id}
                  onClick={() => changeView(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${
                    view === v.id ? "bg-accent text-on-accent shadow" : "text-fg-dim hover:text-fg"
                  }`}
                >
                  <span>{v.icon}</span> {v.label}
                </button>
              ))}
            </div>

            <input
              className="field-input flex-1 min-w-[160px]"
              placeholder="🔍 Buscar tareas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {view === "list" && (
              <select className={selectCls} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="fecha">Ordenar: fecha límite</option>
                <option value="prioridad">Ordenar: prioridad</option>
                <option value="creada">Ordenar: más recientes</option>
              </select>
            )}
            <select className={selectCls} value={filterPrio} onChange={(e) => setFilterPrio(e.target.value)}>
              <option value="">Toda prioridad</option>
              <option value="urgente">🔥 Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {/* Segunda fila: proyectos/cursos + ocultar completadas */}
          <div className="flex gap-3 mb-6 flex-wrap items-center">
            <span className="text-sm text-fg-dim">{projectTerm(activeCategory, true)}:</span>
            <select
              className={selectCls + " min-w-[180px]"}
              value={activeProject}
              onChange={(e) => setActiveProject(e.target.value)}
            >
              <option value="">Todos ({projectTerm(activeCategory, true).toLowerCase()})</option>
              {categoryProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.taskCount})
                </option>
              ))}
            </select>
            <button className="btn-ghost px-3 py-2 text-sm" onClick={() => setProjectModalOpen(true)}>
              ＋ Nuevo {projectTerm(activeCategory).toLowerCase()}
            </button>
            {activeProject && (
              <button
                className="text-sm text-fg-dim hover:text-red-400 transition px-2"
                onClick={deleteActiveProject}
                title={`Eliminar ${projectTerm(activeCategory).toLowerCase()}`}
              >
                🗑 Eliminar
              </button>
            )}

            <label className="ml-auto flex items-center gap-2 text-sm text-fg-dim cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-accent w-4 h-4"
                checked={hideDone}
                onChange={(e) => setHideDone(e.target.checked)}
              />
              Ocultar completadas
            </label>
          </div>

          {/* Contenido: Tablero o Lista */}
          {loading ? (
            <div className="text-center text-fg-dim py-16">Cargando...</div>
          ) : view === "cal" ? (
            <Calendar
              tasks={visible}
              onSelectTask={(t) => {
                setEditing(t);
                setModalOpen(true);
              }}
              onScheduleAt={(date) => {
                setEditing(null);
                setPrefillMeeting(date.toISOString());
                setModalOpen(true);
              }}
              onReschedule={rescheduleMeeting}
            />
          ) : view === "board" ? (
            <Board
              tasks={visible}
              projects={projects}
              onChangeState={changeState}
              onEdit={(t) => {
                setEditing(t);
                setModalOpen(true);
              }}
              onDelete={handleDelete}
              onAdd={(state) => {
                setEditing(null);
                setPrefillState(state);
                setModalOpen(true);
              }}
            />
          ) : visible.length === 0 ? (
            <div className="text-center text-fg-dim py-16">
              <div className="text-5xl mb-3">🗒️</div>
              No hay tareas aquí.
              <br />
              Crea una con "+ Nueva tarea".
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((task, i) => (
                <div key={task.id} className="animate-in" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <TaskCard
                    task={task}
                    onToggleDone={toggleDone}
                    onToggleSubtask={toggleSubtask}
                    onEdit={(t) => {
                      setEditing(t);
                      setModalOpen(true);
                    }}
                    onDelete={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}
          </>
          )}
        </main>
      </div>

      {modalOpen && (
        <TaskModal
          task={editing}
          draft={draftForModal}
          defaultCategory={draftForModal ? draftForModal.category : activeCategory}
          defaultState={prefillState ?? "pendiente"}
          defaultProjectId={editing ? editing.projectId : activeProject || null}
          defaultType={prefillMeeting ? "reunion" : "tarea"}
          defaultDue={prefillMeeting}
          projects={projects}
          rubricTemplates={rubricTemplates}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
            setPrefillState(null);
            setPrefillMeeting(null);
            setDraftForModal(null);
          }}
          onSave={handleSave}
        />
      )}

      {projectModalOpen && (
        <ProjectModal
          category={activeCategory}
          onClose={() => setProjectModalOpen(false)}
          onCreate={createProject}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} onOpen={openToastTask} />

      {/* Botón flotante del asistente IA */}
      {!chatOpen && (
        <button
          className="fixed bottom-6 right-6 z-[54] w-14 h-14 rounded-full grid place-items-center text-2xl text-on-accent shadow-xl transition hover:scale-105"
          style={{
            backgroundImage: "linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent-2)))",
            boxShadow: "0 10px 30px -6px rgb(var(--accent) / 0.6)",
          }}
          title="Asistente IA"
          onClick={() => setChatOpen(true)}
        >
          🤖
        </button>
      )}

      <ChatPanel
        open={chatOpen}
        projects={projects}
        tasks={tasks}
        rubrics={rubricTemplates}
        onClose={() => setChatOpen(false)}
        onCreate={createFromChat}
        onEdit={(d) => {
          setChatOpen(false);
          editFromChat(d);
        }}
        onProjectCreated={reload}
      />
    </div>
  );
}
