import ollama from "ollama";
import { aiExtractionSchema, aiResponseFormat, type AiExtraction } from "./aiSchema.js";
import { CATEGORIES, PRIORITIES, TYPES, MODALITIES, RUBRIC_KINDS } from "../validation.js";

// Extrae el primer objeto JSON de un texto (quita ```json fences y prosa alrededor).
function extractJson(raw: string): string {
  let s = raw.trim();
  s = s.replace(/```(?:json)?/gi, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

// Convierte cualquier valor a string seguro ("" si null/undefined/no-string).
function str(v: any): string {
  return typeof v === "string" ? v : "";
}

// Normaliza valores frecuentes que el modelo equivoca antes de validar con zod.
// Es deliberadamente tolerante: el modelo inventa intents, mete null en strings, etc.
function normalize(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  // intent: el modelo inventa valores ("update", "cancelar_todo", "edit"...).
  // Los mapeamos a nuestro enum: create_task | chat | cancel | confirm.
  const rawIntent = str(obj.intent).toLowerCase();
  if (/cancel|descart|borr|olvid|anul/.test(rawIntent)) {
    obj.intent = "cancel";
  } else if (/confirm|guard|cre[ae]r?l|s[ií]\b|dale/.test(rawIntent)) {
    obj.intent = "confirm";
  } else if (obj.task && typeof obj.task === "object") {
    // create/update/edit/lo-que-sea con datos de tarea → tratamos como create_task.
    obj.intent = "create_task";
  } else if (rawIntent === "create_task") {
    obj.intent = "create_task";
  } else {
    obj.intent = "chat";
  }

  obj.reply = str(obj.reply);
  if (obj.task === undefined) obj.task = null;

  const t = obj.task;
  if (t && typeof t === "object") {
    // Mapear nombres alternativos que el modelo a veces usa.
    if (!str(t.title) && str(t.titulo)) t.title = t.titulo;
    if (!str(t.notes)) t.notes = str(t.description) || str(t.descripcion) || str(t.notas);
    if (!str(t.duePhrase)) t.duePhrase = str(t.due_date) || str(t.fecha) || str(t.when) || str(t.date);

    // Tipo: tarea | reunion | evento (traducir sinónimos).
    const typeMap: Record<string, string> = {
      task: "tarea", meeting: "reunion", reunión: "reunion", event: "evento",
    };
    if (typeof t.type === "string") {
      const ty = t.type.toLowerCase();
      t.type = (TYPES as readonly string[]).includes(ty) ? ty : typeMap[ty] ?? "tarea";
    } else {
      t.type = "tarea";
    }

    // Prioridad: traducir inglés / sinónimos a los valores válidos.
    const prioMap: Record<string, string> = {
      urgent: "urgente", high: "alta", medium: "media", normal: "media", low: "baja",
    };
    if (typeof t.priority === "string") {
      const p = t.priority.toLowerCase();
      t.priority = (PRIORITIES as readonly string[]).includes(p) ? p : prioMap[p] ?? "media";
    } else {
      t.priority = "media";
    }

    // Categoría: capitalizar / validar.
    if (typeof t.category === "string") {
      const found = (CATEGORIES as readonly string[]).find(
        (c) => c.toLowerCase() === t.category.toLowerCase()
      );
      t.category = found ?? "Trabajo";
    } else {
      t.category = "Trabajo";
    }

    // Modalidad: presencial | remoto | "".
    if (typeof t.modality === "string") {
      const m = t.modality.toLowerCase();
      const mMap: Record<string, string> = { presential: "presencial", "in-person": "presencial", remote: "remoto", online: "remoto" };
      t.modality = (MODALITIES as readonly string[]).includes(m) ? m : mMap[m] ?? "";
    } else {
      t.modality = "";
    }

    t.title = str(t.title);
    t.notes = str(t.notes);
    t.duePhrase = str(t.duePhrase);
    t.startTime = str(t.startTime) || str(t.start_time) || str(t.hora);
    t.endTime = str(t.endTime) || str(t.end_time);
    t.endPhrase = str(t.endPhrase) || str(t.end_date);
    t.projectPhrase = str(t.projectPhrase) || str(t.project) || str(t.proyecto);
    if (!Array.isArray(t.tags)) t.tags = [];
    t.tags = t.tags.filter((x: any) => typeof x === "string" && x.trim());

    // Rúbrica (solo reuniones).
    t.rubricObjective = str(t.rubricObjective) || str(t.objective) || str(t.objetivo);
    const kindMap: Record<string, string> = {
      acuerdo: "acuerdo", agreement: "acuerdo",
      siguiente_paso: "siguiente_paso", "próximo_paso": "siguiente_paso", proximo_paso: "siguiente_paso",
      next_step: "siguiente_paso", accion: "siguiente_paso", "acción": "siguiente_paso",
      punto: "punto", topic: "punto", tema: "punto",
    };
    if (!Array.isArray(t.rubricItems)) t.rubricItems = [];
    t.rubricItems = t.rubricItems
      .map((it: any) => {
        const title = typeof it === "string" ? it : str(it?.title) || str(it?.text) || str(it?.name);
        const rawKind = (typeof it === "object" ? str(it?.kind) || str(it?.type) : "").toLowerCase();
        const kind = (RUBRIC_KINDS as readonly string[]).includes(rawKind) ? rawKind : kindMap[rawKind] ?? "punto";
        return { title, kind };
      })
      .filter((it: any) => it.title.trim());
  }
  return obj;
}

const MODEL = "minimax-m3:cloud";
const TIMEOUT_MS = 45000;

export class OllamaError extends Error {
  constructor(public kind: "down" | "timeout" | "invalid", message: string) {
    super(message);
  }
}

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

// Llama a Ollama pidiendo salida estructurada y valida el JSON con zod.
// Reintenta una vez si el JSON no cumple el schema. Lanza OllamaError en fallos.
export async function extractWithOllama(messages: ChatMsg[]): Promise<AiExtraction> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let raw: string;
    try {
      const res = await ollama.chat({
        model: MODEL,
        messages,
        format: aiResponseFormat as any,
        options: { temperature: 0.2 },
        // @ts-expect-error: la firma acepta signal en runtime para abortar.
        signal: controller.signal,
      });
      raw = res.message.content;
    } catch (err: any) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        throw new OllamaError("timeout", "La IA tardó demasiado en responder.");
      }
      const msg = String(err?.message || err);
      if (/ECONNREFUSED|fetch failed|connect/i.test(msg)) {
        throw new OllamaError("down", "No pude conectar con la IA (¿está corriendo Ollama?).");
      }
      throw new OllamaError("down", "Error al llamar a la IA: " + msg);
    } finally {
      clearTimeout(timer);
    }

    // Validar el JSON devuelto (tolerante: limpia fences y normaliza valores).
    try {
      const obj = normalize(JSON.parse(extractJson(raw)));
      const parsed = aiExtractionSchema.parse(obj);
      return parsed;
    } catch {
      if (attempt === 0) {
        // Reintento con un empujón extra al modelo.
        messages = [
          ...messages,
          { role: "system", content: "Tu respuesta anterior no cumplió el formato JSON requerido. Devuelve SOLO el JSON válido según el esquema." },
        ];
        continue;
      }
      throw new OllamaError("invalid", "La IA devolvió una respuesta no válida.");
    }
  }
  // Inalcanzable, pero TS lo pide.
  throw new OllamaError("invalid", "La IA devolvió una respuesta no válida.");
}

// Llamada genérica con structured output: devuelve el JSON parseado (sin validar
// contra un schema concreto; el llamador valida). Tolerante a fences/prosa.
export async function chatJson(messages: ChatMsg[], format: unknown): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await ollama.chat({
      model: MODEL,
      messages,
      format: format as any,
      options: { temperature: 0.3 },
      // @ts-expect-error: signal aceptado en runtime.
      signal: controller.signal,
    });
    return JSON.parse(extractJson(res.message.content));
  } catch (err: any) {
    if (controller.signal.aborted) throw new OllamaError("timeout", "La IA tardó demasiado.");
    const msg = String(err?.message || err);
    if (/ECONNREFUSED|fetch failed|connect/i.test(msg)) {
      throw new OllamaError("down", "No pude conectar con la IA (¿está corriendo Ollama?).");
    }
    if (err instanceof SyntaxError) throw new OllamaError("invalid", "La IA devolvió una respuesta no válida.");
    throw new OllamaError("down", "Error al llamar a la IA: " + msg);
  } finally {
    clearTimeout(timer);
  }
}

// Chat en texto libre (sin structured output). Se usa como fallback cuando la
// extracción estructurada falla: así el asistente SIEMPRE responde algo con sentido.
export async function chatFreeform(messages: ChatMsg[]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await ollama.chat({
      model: MODEL,
      messages,
      options: { temperature: 0.4 },
      // @ts-expect-error: signal aceptado en runtime.
      signal: controller.signal,
    });
    return res.message.content.trim();
  } catch (err: any) {
    if (controller.signal.aborted) throw new OllamaError("timeout", "La IA tardó demasiado.");
    const msg = String(err?.message || err);
    if (/ECONNREFUSED|fetch failed|connect/i.test(msg)) {
      throw new OllamaError("down", "No pude conectar con la IA (¿está corriendo Ollama?).");
    }
    throw new OllamaError("down", "Error al llamar a la IA: " + msg);
  } finally {
    clearTimeout(timer);
  }
}
