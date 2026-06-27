import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RUBRIC_KINDS } from "../validation.js";
import { chatJson, chatFreeform, type ChatMsg } from "./ollamaClient.js";

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
