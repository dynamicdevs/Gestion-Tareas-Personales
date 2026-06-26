import { z } from "zod";

export const CATEGORIES = ["Trabajo", "Personal", "Estudios"] as const;
export const PRIORITIES = ["urgente", "alta", "media", "baja"] as const;
export const STATES = ["pendiente", "curso", "hecha"] as const;
export const TYPES = ["tarea", "reunion", "evento"] as const;
export const MODALITIES = ["presencial", "remoto"] as const;
export const RUBRIC_KINDS = ["punto", "acuerdo", "siguiente_paso"] as const;

const subtaskSchema = z.object({
  text: z.string().min(1, "La subtarea no puede estar vacía"),
  done: z.boolean().default(false),
});

// Item de rúbrica. En plantilla solo se usan title/kind; en instancia, todos.
const rubricItemSchema = z.object({
  title: z.string().min(1, "El punto no puede estar vacío").max(300),
  kind: z.enum(RUBRIC_KINDS).default("punto"),
  done: z.boolean().default(false),
  notes: z.string().max(3000).default(""),
  responsible: z.string().max(120).default(""),
});

// Rúbrica instancia (anidada en una reunión).
export const meetingRubricSchema = z.object({
  name: z.string().max(160).default(""),
  objective: z.string().max(3000).default(""),
  sourceId: z.string().nullable().optional(),
  items: z.array(rubricItemSchema).default([]),
});

// Plantilla de rúbrica.
export const rubricTemplateInputSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(160),
  objective: z.string().max(3000).default(""),
  projectId: z.string().nullable().optional(),
  items: z.array(rubricItemSchema).default([]),
});

// Schema base para crear/editar una tarea.
export const taskInputSchema = z.object({
  title: z.string().min(1, "El título es obligatorio").max(300),
  notes: z.string().max(5000).default(""),
  type: z.enum(TYPES).default("tarea"),
  category: z.enum(CATEGORIES).default("Trabajo"),
  priority: z.enum(PRIORITIES).default("media"),
  state: z.enum(STATES).default("pendiente"),
  // ISO date string o null
  due: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  modality: z.enum(MODALITIES).nullable().optional(),
  projectId: z.string().nullable().optional(),
  tags: z.array(z.string().min(1)).default([]),
  subtasks: z.array(subtaskSchema).default([]),
  rubric: meetingRubricSchema.nullable().optional(),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

export const projectInputSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(120),
  category: z.enum(CATEGORIES),
});
