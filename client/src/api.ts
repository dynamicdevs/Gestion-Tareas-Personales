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
    projects?: { id: string; name: string; category: string }[],
    tasks?: {
      title: string;
      type: string;
      category: string;
      priority: string;
      state: string;
      due: string | null;
      projectId: string | null;
    }[],
    rubrics?: { name: string; itemCount: number }[]
  ) =>
    fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        currentDraft: currentDraft ?? null,
        projects: projects ?? [],
        tasks: tasks ?? [],
        rubrics: rubrics ?? [],
      }),
    }).then(async (r) => {
      // El endpoint devuelve siempre JSON (incluso en errores controlados).
      const data = (await r.json().catch(() => null)) as AiChatResponse | null;
      if (data) return data;
      return { kind: "error", text: "No se pudo contactar con el asistente." } as AiChatResponse;
    }),

  // Asistente secuencial de rúbricas: envía el estado actual + el mensaje del usuario.
  aiRubricFlow: (payload: {
    step: string;
    draft: unknown;
    message: string;
    projects: { id: string; name: string; category: string }[];
  }) =>
    fetch("/api/ai/rubric-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => handle<import("./types").RubricFlowResponse>(r)),

  // Sugiere puntos de rúbrica para una reunión.
  aiSuggestRubric: (title: string, objective: string) =>
    fetch("/api/ai/suggest-rubric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, objective }),
    }).then((r) => handle<{ items: { title: string; kind: string }[] }>(r)),

  // Genera el acta de la reunión a partir de los puntos tratados.
  aiMinutes: (payload: {
    title: string;
    objective: string;
    items: { title: string; kind: string; notes: string; responsible: string; done: boolean }[];
  }) =>
    fetch("/api/ai/minutes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => handle<{ text: string }>(r)),
};

export type { ChatMessage };
