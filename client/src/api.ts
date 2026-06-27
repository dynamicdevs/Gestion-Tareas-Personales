import type {
  Task,
  TaskInput,
  Project,
  Category,
  RubricTemplate,
  RubricTemplateFull,
  RubricInput,
  ChatMessage,
  AiChatResponse,
} from "./types";

const BASE = "/api/tasks";
const PROJECTS = "/api/projects";
const RUBRICS = "/api/rubrics";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  list: () => fetch(BASE).then((r) => handle<Task[]>(r)),

  create: (data: TaskInput) =>
    fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<Task>(r)),

  update: (id: string, data: TaskInput) =>
    fetch(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<Task>(r)),

  patch: (id: string, data: Partial<Task>) =>
    fetch(`${BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<Task>(r)),

  toggleSubtask: (taskId: string, subId: string, done: boolean) =>
    fetch(`${BASE}/${taskId}/subtasks/${subId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }).then((r) => handle<Task>(r)),

  remove: (id: string) => fetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => handle<void>(r)),

  // ---- Proyectos / cursos ----
  listProjects: () => fetch(PROJECTS).then((r) => handle<Project[]>(r)),

  createProject: (name: string, category: Category) =>
    fetch(PROJECTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category }),
    }).then((r) => handle<Project>(r)),

  removeProject: (id: string) => fetch(`${PROJECTS}/${id}`, { method: "DELETE" }).then((r) => handle<void>(r)),

  // ---- Plantillas de rúbrica ----
  listRubrics: () => fetch(RUBRICS).then((r) => handle<RubricTemplate[]>(r)),

  getRubric: (id: string) => fetch(`${RUBRICS}/${id}`).then((r) => handle<RubricTemplateFull>(r)),

  createRubric: (data: RubricInput & { projectId: string | null }) =>
    fetch(RUBRICS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<RubricTemplateFull>(r)),

  updateRubric: (id: string, data: RubricInput & { projectId: string | null }) =>
    fetch(`${RUBRICS}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => handle<RubricTemplateFull>(r)),

  removeRubric: (id: string) => fetch(`${RUBRICS}/${id}`, { method: "DELETE" }).then((r) => handle<void>(r)),

  // ---- Chatbot de IA ----
  // Envía el historial (solo role/content) + el borrador no confirmado en curso (si lo hay).
  aiChat: (
    messages: { role: "user" | "assistant"; content: string }[],
    currentDraft?: TaskInput | null,
    projects?: { id: string; name: string; category: string }[]
  ) =>
    fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, currentDraft: currentDraft ?? null, projects: projects ?? [] }),
    }).then(async (r) => {
      // El endpoint devuelve siempre JSON (incluso en errores controlados).
      const data = (await r.json().catch(() => null)) as AiChatResponse | null;
      if (data) return data;
      return { kind: "error", text: "No se pudo contactar con el asistente." } as AiChatResponse;
    }),
};

export type { ChatMessage };
