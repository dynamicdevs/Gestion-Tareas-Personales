export const CATEGORIES = ["Trabajo", "Personal", "Estudios"] as const;
export const PRIORITIES = ["urgente", "alta", "media", "baja"] as const;
export const STATES = ["pendiente", "curso", "hecha"] as const;
export const TYPES = ["tarea", "reunion", "evento"] as const;
export const MODALITIES = ["presencial", "remoto"] as const;
export const RUBRIC_KINDS = ["punto", "acuerdo", "siguiente_paso"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type State = (typeof STATES)[number];
export type TaskType = (typeof TYPES)[number];
export type Modality = (typeof MODALITIES)[number];
export type RubricKind = (typeof RUBRIC_KINDS)[number];

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  category: Category;
  taskCount: number;
}

// ---- Rúbricas ----

export interface RubricItemInput {
  title: string;
  kind: RubricKind;
  done: boolean;
  notes: string;
  responsible: string;
}

export interface MeetingRubricItem extends RubricItemInput {
  id: string;
  order: number;
}

export interface MeetingRubric {
  id: string;
  name: string;
  objective: string;
  sourceId: string | null;
  items: MeetingRubricItem[];
}

// Para el formulario (instancia o plantilla): mismos campos, sin ids.
export interface RubricInput {
  name: string;
  objective: string;
  sourceId: string | null;
  items: RubricItemInput[];
}

// Resumen de plantilla (lista).
export interface RubricTemplate {
  id: string;
  name: string;
  objective: string;
  projectId: string | null;
  itemCount: number;
}

// Plantilla completa con items.
export interface RubricTemplateFull {
  id: string;
  name: string;
  objective: string;
  projectId: string | null;
  items: (RubricItemInput & { id: string; order: number })[];
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  type: TaskType;
  category: Category;
  priority: Priority;
  state: State;
  due: string | null;
  endDate: string | null;
  modality: Modality | null;
  projectId: string | null;
  tags: string[];
  subtasks: Subtask[];
  rubric: MeetingRubric | null;
  createdAt: string;
  updatedAt: string;
}

// Datos del formulario al crear/editar (sin ids generados por el servidor).
export interface TaskInput {
  title: string;
  notes: string;
  type: TaskType;
  category: Category;
  priority: Priority;
  state: State;
  due: string | null;
  endDate: string | null;
  modality: Modality | null;
  projectId: string | null;
  tags: string[];
  subtasks: { text: string; done: boolean }[];
  rubric: RubricInput | null;
}

export const CATEGORY_META: Record<Category, { label: string; icon: string }> = {
  Trabajo: { label: "Trabajo", icon: "💼" },
  Personal: { label: "Proyectos personales", icon: "🚀" },
  Estudios: { label: "Estudios", icon: "🎓" },
};

export const STATE_META: Record<State, { label: string }> = {
  pendiente: { label: "Pendiente" },
  curso: { label: "En curso" },
  hecha: { label: "Hecha" },
};

export const PRIORITY_META: Record<Priority, { label: string }> = {
  urgente: { label: "Urgente" },
  alta: { label: "Alta" },
  media: { label: "Media" },
  baja: { label: "Baja" },
};

export const TYPE_META: Record<TaskType, { label: string; icon: string }> = {
  tarea: { label: "Tarea", icon: "📋" },
  reunion: { label: "Reunión", icon: "👥" },
  evento: { label: "Evento", icon: "📅" },
};

export const MODALITY_META: Record<Modality, { label: string; icon: string }> = {
  presencial: { label: "Presencial", icon: "📍" },
  remoto: { label: "Remoto", icon: "💻" },
};

export const RUBRIC_KIND_META: Record<RubricKind, { label: string; icon: string }> = {
  punto: { label: "Punto a tratar", icon: "•" },
  acuerdo: { label: "Acuerdo", icon: "✅" },
  siguiente_paso: { label: "Próximo paso", icon: "➡️" },
};

// En Estudios los "proyectos" se llaman "cursos".
export function projectTerm(category: Category, plural = false): string {
  if (category === "Estudios") return plural ? "Cursos" : "Curso";
  return plural ? "Proyectos" : "Proyecto";
}

// ---- Chatbot de IA ----

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  draft?: TaskInput; // si el asistente propuso una tarea
}

// Respuesta del endpoint /api/ai/chat (discriminada por kind).
export type AiChatResponse =
  | { kind: "message"; text: string }
  | { kind: "draft"; text: string; draft: TaskInput }
  | { kind: "cancel"; text: string }
  | { kind: "confirm"; text: string }
  | { kind: "error"; text: string };
