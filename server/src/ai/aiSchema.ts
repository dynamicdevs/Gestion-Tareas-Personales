import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CATEGORIES, PRIORITIES, TYPES, STATES, MODALITIES, RUBRIC_KINDS } from "../validation.js";

// Schema REDUCIDO que la IA debe devolver. Plano y con pocos enums = más fiable
// el constrained decoding de Ollama. Las fechas vienen como texto literal
// (duePhrase); el backend las resuelve a ISO.
export const aiExtractionSchema = z.object({
  // create_task = crear/actualizar borrador; chat = conversar/explicar/preguntar;
  // cancel = descartar borrador; confirm = el usuario pidió crear/guardar el borrador;
  // query = consultar/resumir los ítems existentes; create_project = crear un proyecto/curso;
  // create_rubric = crear una plantilla de rúbrica INDEPENDIENTE (asociada a un proyecto, no a una reunión).
  intent: z.enum(["create_task", "chat", "cancel", "confirm", "query", "create_project", "create_rubric"]),
  // Respuesta en lenguaje natural para mostrar al usuario.
  reply: z.string(),
  // Solo intent="query": filtros para acotar la consulta sobre los ítems. Vacío = todo.
  query: z
    .object({
      category: z.enum([...CATEGORIES, ""]).default(""),
      priority: z.enum([...PRIORITIES, ""]).default(""),
      type: z.enum([...TYPES, ""]).default(""),
      state: z.enum([...STATES, ""]).default(""),
      // Filtro temporal por palabra clave (ver answerQuery): hoy / esta semana (7 días) /
      // semana próxima / este mes / vencidas. "" = sin filtro temporal.
      timeframe: z.enum(["hoy", "semana", "semana_proxima", "mes", "vencidas", ""]).default(""),
      // Rango explícito cuando el usuario nombra fechas concretas ("del 29 al 4 de julio").
      // Fechas literales tal cual las dice el usuario; el backend las resuelve a ISO.
      dateFrom: z.string().default(""),
      dateTo: z.string().default(""),
    })
    .nullable()
    .default(null),
  // Solo intent="create_project": datos del proyecto/curso a crear.
  project: z
    .object({
      name: z.string().default(""),
      category: z.enum(CATEGORIES).default("Trabajo"),
    })
    .nullable()
    .default(null),
  // Solo intent="create_rubric": plantilla de rúbrica independiente. Se asocia por
  // nombre a un proyecto (projectPhrase), NUNCA a una reunión.
  rubric: z
    .object({
      name: z.string().default(""),
      objective: z.string().default(""),
      projectPhrase: z.string().default(""),
      items: z
        .array(
          z.object({
            title: z.string(),
            kind: z.enum(RUBRIC_KINDS).default("punto"),
          })
        )
        .default([]),
    })
    .nullable()
    .default(null),
  // Datos del ítem (null si intent = "chat"). Todos los campos opcionales con
  // default: el modelo a veces devuelve un task parcial (ej. solo projectPhrase
  // al editar); el normalize y el router completan el resto desde el borrador previo.
  task: z
    .object({
      title: z.string().default(""),
      notes: z.string().default(""),
      type: z.enum(TYPES).default("tarea"),
      category: z.enum(CATEGORIES).default("Trabajo"),
      priority: z.enum(PRIORITIES).default("media"),
      tags: z.array(z.string()).default([]),
      duePhrase: z.string().default(""),
      startTime: z.string().default(""),
      endTime: z.string().default(""),
      modality: z.enum([...MODALITIES, ""]).default(""),
      endPhrase: z.string().default(""),
      projectPhrase: z.string().default(""),
      // Solo reuniones: objetivo del orden del día, o "".
      rubricObjective: z.string().default(""),
      // Solo reuniones: puntos del orden del día que mencione el usuario.
      rubricItems: z
        .array(
          z.object({
            title: z.string(),
            kind: z.enum(RUBRIC_KINDS).default("punto"),
          })
        )
        .default([]),
    })
    .nullable(),
});

export type AiExtraction = z.infer<typeof aiExtractionSchema>;

// JSON Schema para pasar como `format` a ollama.chat().
export const aiResponseFormat = zodToJsonSchema(aiExtractionSchema, {
  $refStrategy: "none",
});
