import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { CATEGORIES, PRIORITIES, TYPES, MODALITIES, RUBRIC_KINDS } from "../validation.js";

// Schema REDUCIDO que la IA debe devolver. Plano y con pocos enums = más fiable
// el constrained decoding de Ollama. Las fechas vienen como texto literal
// (duePhrase); el backend las resuelve a ISO.
export const aiExtractionSchema = z.object({
  // create_task = crear/actualizar borrador; chat = conversar/explicar/preguntar;
  // cancel = descartar borrador; confirm = el usuario pidió crear/guardar el borrador.
  intent: z.enum(["create_task", "chat", "cancel", "confirm"]),
  // Respuesta en lenguaje natural para mostrar al usuario.
  reply: z.string(),
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
