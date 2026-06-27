import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RUBRIC_KINDS } from "../validation.js";
import { chatJson, chatFreeform, type ChatMsg } from "./ollamaClient.js";
// parsePointsFromText reusa chatJson; no requiere imports adicionales.

// --- Sugerir orden del día ---

const suggestSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      kind: z.enum(RUBRIC_KINDS),
    })
  ),
});
const suggestFormat = zodToJsonSchema(suggestSchema, { $refStrategy: "none" });

export interface SuggestedItem {
  title: string;
  kind: (typeof RUBRIC_KINDS)[number];
}

// Genera 3-6 puntos sugeridos para una reunión según su título/objetivo.
export async function suggestRubricItems(title: string, objective: string): Promise<SuggestedItem[]> {
  const messages: ChatMsg[] = [
    {
      role: "system",
      content: [
        "Eres un asistente que prepara el orden del día de reuniones.",
        "Devuelve SOLO un JSON con la forma: { \"items\": [{ \"title\": \"...\", \"kind\": \"punto\" | \"acuerdo\" | \"siguiente_paso\" }] }.",
        "Genera entre 3 y 6 puntos relevantes y concretos para la reunión indicada.",
        "Clasifica cada uno: 'punto' (tema a tratar), 'acuerdo' (decisión a tomar), 'siguiente_paso' (acción de seguimiento).",
        "Escribe los títulos en español, breves y accionables. No inventes nombres de personas ni datos específicos.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `Reunión: "${title}".${objective ? ` Objetivo: ${objective}.` : ""} Sugiere el orden del día.`,
    },
  ];

  const raw = await chatJson(messages, suggestFormat);
  const parsed = suggestSchema.safeParse({
    items: Array.isArray(raw?.items)
      ? raw.items.map((it: any) => ({
          title: typeof it?.title === "string" ? it.title : String(it ?? ""),
          kind: (RUBRIC_KINDS as readonly string[]).includes(it?.kind) ? it.kind : "punto",
        }))
      : [],
  });
  if (!parsed.success) return [];
  return parsed.data.items.filter((i) => i.title.trim()).slice(0, 6);
}

// --- Parsear puntos dictados por el usuario (para el asistente secuencial) ---

const parseSchema = z.object({
  items: z.array(z.object({ title: z.string() })),
});
const parseFormat = zodToJsonSchema(parseSchema, { $refStrategy: "none" });

// Convierte texto libre del usuario en una lista de títulos de puntos. Útil cuando
// dicta varios en un mensaje ("revisar avances, ver bloqueos y definir prioridades").
// `kind` se asigna fuera según el paso del flujo (punto/acuerdo/siguiente_paso).
export async function parsePointsFromText(text: string): Promise<string[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Atajo determinista: si el usuario ya separó por comas / "y" / saltos de línea,
  // partimos sin molestar al modelo (más rápido y fiable).
  const quick = trimmed
    .split(/\n|,|;| y | e |·|•|\d+[).]\s/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  if (quick.length >= 2) return quick.slice(0, 12);

  const messages: ChatMsg[] = [
    {
      role: "system",
      content: [
        "Extraes los puntos individuales de un texto para una rúbrica de reunión.",
        'Devuelve SOLO un JSON: { "items": [{ "title": "..." }] }.',
        "Cada title es un punto breve y accionable, en español. No inventes puntos que no estén en el texto.",
        "Si el texto es un único punto, devuelve un solo item.",
      ].join("\n"),
    },
    { role: "user", content: trimmed },
  ];
  try {
    const raw = await chatJson(messages, parseFormat);
    const items = Array.isArray(raw?.items) ? raw.items : [];
    return items
      .map((it: any) => (typeof it === "string" ? it : String(it?.title ?? "")).trim())
      .filter((s: string) => s.length >= 2)
      .slice(0, 12);
  } catch {
    // Si la IA falla, usamos el texto completo como un único punto.
    return [trimmed];
  }
}

// --- Generar acta ---

interface MinuteItem {
  title: string;
  kind: string;
  notes?: string;
  responsible?: string;
  done?: boolean;
}

// Genera el acta (resumen + acuerdos + próximos pasos) a partir de los puntos tratados.
export async function generateMinutes(
  title: string,
  objective: string,
  items: MinuteItem[]
): Promise<string> {
  const itemsText = items
    .map((it, i) => {
      const estado = it.done ? "[tratado]" : "[pendiente]";
      const resp = it.responsible ? ` (responsable: ${it.responsible})` : "";
      const notas = it.notes ? ` — Notas: ${it.notes}` : "";
      return `${i + 1}. ${estado} ${it.title}${resp}${notas}`;
    })
    .join("\n");

  const messages: ChatMsg[] = [
    {
      role: "system",
      content: [
        "Eres un asistente que redacta actas de reunión en español.",
        "A partir de los puntos tratados y sus notas, escribe un acta breve y clara con esta estructura en markdown:",
        "**Resumen** (2-3 líneas), **Acuerdos** (lista) y **Próximos pasos** (lista con responsable si se indica).",
        "Si no hay información suficiente para alguna sección, omítela. No inventes datos que no estén en las notas.",
      ].join("\n"),
    },
    {
      role: "user",
      content: `Reunión: "${title}".${objective ? ` Objetivo: ${objective}.` : ""}\n\nPuntos:\n${itemsText}\n\nRedacta el acta.`,
    },
  ];

  return chatFreeform(messages);
}
