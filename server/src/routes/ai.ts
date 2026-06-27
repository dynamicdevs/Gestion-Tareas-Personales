import { Router } from "express";
import { z } from "zod";
import { taskInputSchema } from "../validation.js";
import { extractWithOllama, chatFreeform, OllamaError } from "../ai/ollamaClient.js";
import { resolvePhraseToISO, applyTimeToISO } from "../ai/dateResolver.js";

export const aiRouter = Router();

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .min(1),
  // Borrador propuesto en el turno anterior y aún NO confirmado. Permite editarlo
  // en vez de crear uno nuevo cuando el usuario pide cambios ("que sea alta").
  currentDraft: taskInputSchema.nullable().optional(),
  // Proyectos/cursos existentes, para que la IA pueda asignar uno por nombre.
  projects: z
    .array(z.object({ id: z.string(), name: z.string(), category: z.string() }))
    .optional()
    .default([]),
});

// Construye el system prompt con la fecha actual, los proyectos y el borrador en curso.
function buildSystemPrompt(
  now: Date,
  currentDraft: unknown,
  projects: { id: string; name: string; category: string }[]
): string {
  const fecha = now.toLocaleDateString("es", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const lines = [
    "Eres un asistente que ayuda a crear tareas, reuniones y eventos en un gestor personal.",
    `Hoy es ${fecha}.`,
    "",
    "Responde ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, sin ```.",
    "Forma EXACTA del JSON:",
    "{",
    '  "intent": "create_task" | "chat",',
    '  "reply": "<mensaje breve en español>",',
    '  "task": {',
    '    "title": "<frase corta>",',
    '    "notes": "<detalles o vacío>",',
    '    "type": "tarea" | "reunion" | "evento",',
    '    "category": "Trabajo" | "Personal" | "Estudios",',
    '    "priority": "urgente" | "alta" | "media" | "baja",',
    '    "tags": ["palabra1"],',
    '    "duePhrase": "<fecha literal o vacío>",',
    '    "startTime": "<HH:mm o vacío>",',
    '    "endTime": "<HH:mm o vacío>",',
    '    "modality": "presencial" | "remoto" | "",',
    '    "endPhrase": "<fecha fin literal para eventos, o vacío>",',
    '    "projectPhrase": "<nombre del proyecto/curso mencionado, o vacío>",',
    '    "rubricObjective": "<objetivo de la reunión si se menciona, o vacío>",',
    '    "rubricItems": [{ "title": "<punto>", "kind": "punto" | "acuerdo" | "siguiente_paso" }]',
    "  } | null",
    "}",
    "",
    "Reglas:",
    "- intent: 'create_task' para crear/editar el ítem; 'confirm' si el usuario pide guardarlo/crearlo ('confirmá', 'dale', 'sí creala'); 'cancel' si quiere descartar; 'chat' para preguntas/explicaciones.",
    "- IMPORTANTE: si el usuario describe algo para hacer/recordar/agendar (aunque sea breve, como 'preparar la presentación' o 'reunión el viernes'), USA intent='create_task' y arma el borrador con lo que tengas. NO pidas más datos: lo que falte queda con valores por defecto y el usuario lo completa en la tarjeta. Solo el TÍTULO es imprescindible.",
    "- Usa intent='chat' SOLO si: el usuario hace una pregunta, saluda, agradece, o pide algo que no podés hacer (invitar personas, adjuntos, integraciones externas). En ese último caso explicá con amabilidad qué sí podés hacer.",
    "- Nunca devuelvas un intent fuera de los cuatro indicados.",
    "- type: 'reunion' si menciona reunión/junta/meeting/llamada con hora; 'evento' si dura varios días (vacaciones, viaje, conferencia); si no, 'tarea'.",
    "- priority EXACTA: 'urgente', 'alta', 'media' o 'baja' (nunca en inglés).",
    "- category EXACTA: 'Trabajo', 'Personal' o 'Estudios'; por defecto 'Trabajo'.",
    "- NO calcules fechas: copia la expresión literal en duePhrase ('mañana', 'el lunes 29', 'el viernes').",
    "- startTime/endTime en formato 24h 'HH:mm' (ej. '10:00', '15:30'). Si no hay hora, vacío.",
    "- modality solo para reuniones: 'presencial' o 'remoto' si se menciona; si no, vacío.",
    "- projectPhrase: si el usuario menciona un proyecto/curso ('para el proyecto Foundry'), copia su nombre; si no, vacío.",
    "- RÚBRICA (solo reuniones): si el usuario menciona puntos del orden del día, una minuta, temas a tratar, acuerdos o próximos pasos, ponelos en rubricItems. Clasificá cada punto: 'acuerdo' si es una decisión/acuerdo, 'siguiente_paso' si es una acción a futuro, 'punto' para temas a tratar. Si no menciona puntos, dejá rubricItems vacío. rubricObjective solo si menciona el objetivo de la reunión.",
    "- No inventes campos ni valores de intent fuera de los indicados.",
  ];

  if (projects.length > 0) {
    lines.push(
      "",
      "Proyectos/cursos existentes (usa projectPhrase con el nombre que mejor coincida):",
      projects.map((p) => `- ${p.name} (${p.category})`).join("\n")
    );
  }

  // Si hay un borrador en curso, instruir a EDITARLO en vez de crear otro.
  if (currentDraft) {
    lines.push(
      "",
      "IMPORTANTE: ya hay un borrador propuesto (aún no confirmado):",
      JSON.stringify(currentDraft),
      "Si el usuario pide un cambio (prioridad, fecha, título, tipo, etc.), DEVUELVE EL MISMO borrador con ese único cambio aplicado, manteniendo el resto igual. No empieces de cero.",
      "Convierte sus campos al formato de salida: due ISO → deja duePhrase vacío si no cambia la fecha (el sistema conserva la fecha previa cuando duePhrase está vacío)."
    );
  }
  lines.push("", "Responde 'reply' siempre en español, breve y amable.");
  return lines.join("\n");
}

// POST /api/ai/chat
aiRouter.post("/chat", async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ kind: "error", text: "Petición inválida." });
  }

  const now = new Date();
  const prev = parsed.data.currentDraft ?? null;
  const projects = parsed.data.projects;

  // Atajo determinista: si hay un borrador pendiente y el último mensaje del usuario
  // es claramente confirmar o cancelar, lo resolvemos sin depender del modelo (más fiable).
  const stripAccents = (s: string) =>
    Array.from(s.toLowerCase().normalize("NFD"))
      .filter((ch) => {
        const c = ch.charCodeAt(0);
        return c < 0x0300 || c > 0x036f;
      })
      .join("");
  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user");
  if (prev && lastUser) {
    const m = stripAccents(lastUser.content).trim();
    // Confirmaciones cortas e inequívocas (evita falsos positivos con frases largas).
    if (/^(si|s[ií]|dale|ok|oka?y?|listo|perfecto|confirm[ao]r?l?[ao]?|cre[ao]l?[ao]|guard[ao]l?[ao]|hazlo|hacelo|adelante|de una|va|vale)[\s!.]*$/.test(m)) {
      return res.json({ kind: "confirm", text: "¡Listo, lo creo!" });
    }
    if (/^(no,?\s*)?(cancel[ao]r?l?[ao]?|descart[ao]l?[ao]?|olvid[ao]l?[ao]?|borr[ao]l?[ao]?|dej[ao]l?[ao]?|anul[ao]r?l?[ao]?)[\s!.]*(todo|eso|esto|la|el)?[\s!.]*$/.test(m)) {
      return res.json({ kind: "cancel", text: "Listo, descarté el borrador." });
    }
  }

  const messages = [
    { role: "system" as const, content: buildSystemPrompt(now, prev, projects) },
    ...parsed.data.messages,
  ];

  try {
    let extraction;
    try {
      extraction = await extractWithOllama(messages);
    } catch (e) {
      // Si la extracción estructurada falla, NO rompemos: respondemos en modo
      // conversación libre para que el asistente siempre diga algo con sentido.
      if (e instanceof OllamaError && e.kind === "invalid") {
        const text = await chatFreeform([
          {
            role: "system",
            content:
              "Eres un asistente de un gestor de tareas. Responde breve y amable en español. Si el usuario pidió algo que no podés hacer directamente (minutas, invitar gente, adjuntos), explicá qué sí podés hacer (crear tareas, reuniones y eventos) y cómo lograr el resto editando el ítem.",
          },
          ...parsed.data.messages,
        ]);
        return res.json({ kind: "message", text: text || "¿Podés reformularlo?" });
      }
      throw e;
    }

    // El usuario pidió confirmar/crear el borrador en curso.
    if (extraction.intent === "confirm") {
      if (prev) {
        return res.json({ kind: "confirm", text: extraction.reply || "¡Listo, lo creo!" });
      }
      return res.json({ kind: "message", text: extraction.reply || "No hay ningún borrador para confirmar." });
    }

    // Cancelar/descartar el borrador.
    if (extraction.intent === "cancel") {
      return res.json({ kind: "cancel", text: extraction.reply || "Listo, descarté el borrador." });
    }

    if (extraction.intent !== "create_task" || !extraction.task) {
      return res.json({ kind: "message", text: extraction.reply || "¿En qué te ayudo?" });
    }

    const t = extraction.task;

    // Resolver fecha. Si el usuario está editando y no dio fecha nueva, conservar la del borrador previo.
    let due: string | null = resolvePhraseToISO(t.duePhrase, now);
    if (!due && prev?.due) due = prev.due;

    const type = t.type || "tarea";
    let endDate: string | null = null;
    let modality: string | null = null;

    if (type === "reunion") {
      // Aplicar hora de inicio a la fecha.
      if (due && t.startTime) due = applyTimeToISO(due, t.startTime);
      else if (!due && prev?.type === "reunion" && prev.due) due = prev.due;
      // Hora de fin → endDate el mismo día.
      if (due && t.endTime) endDate = applyTimeToISO(due, t.endTime);
      else if (prev?.endDate) endDate = prev.endDate;
      modality = t.modality || prev?.modality || null;
    } else if (type === "evento") {
      const end = resolvePhraseToISO(t.endPhrase, now);
      endDate = end ?? prev?.endDate ?? null;
    }

    // Resolver el proyecto por nombre (coincidencia tolerante: ignora acentos y mayúsculas).
    // Quitamos los diacríticos combinantes (rango U+0300–U+036F) por código, sin regex
    // de rango, para no depender de la codificación del archivo fuente.
    const norm = (s: string) =>
      Array.from(s.toLowerCase().normalize("NFD"))
        .filter((ch) => {
          const c = ch.charCodeAt(0);
          return c < 0x0300 || c > 0x036f;
        })
        .join("")
        .trim();
    let projectId: string | null = prev?.projectId ?? null;
    let projectNotFound: string | null = null;
    const phrase = norm(t.projectPhrase || "");
    if (phrase) {
      const phraseWords = phrase.split(/\s+/).filter((w) => w.length >= 3);
      const match = projects.find((p) => {
        const n = norm(p.name);
        if (n === phrase || n.includes(phrase) || phrase.includes(n)) return true;
        // Coincidencia por palabras significativas (robusta ante acentos/parciales).
        const nWords = n.split(/\s+/);
        return phraseWords.some((w) => nWords.some((nw) => nw === w || nw.startsWith(w) || w.startsWith(nw)));
      });
      if (match) projectId = match.id;
      else projectNotFound = t.projectPhrase.trim();
    }

    // Al editar (hay prev), un campo que vuelve en su valor por defecto suele
    // significar "no lo cambié"; preferimos el del borrador previo. Si no hay prev,
    // usamos lo que devolvió el modelo.
    const pick = <T,>(modelVal: T, def: T, prevVal: T | undefined): T => {
      if (!prev) return modelVal;
      return modelVal === def && prevVal !== undefined ? prevVal : modelVal;
    };

    const finalType = pick(type, "tarea", prev?.type) as typeof type;
    const finalTags = t.tags && t.tags.length ? t.tags.filter((x) => x.trim()) : prev?.tags ?? [];

    // Rúbrica: solo en reuniones. Si la IA extrajo puntos u objetivo, la armamos;
    // si no y estamos editando una reunión que ya tenía rúbrica, la conservamos.
    let rubric: any = null;
    if (finalType === "reunion") {
      const items = (t.rubricItems ?? []).map((it) => ({
        title: it.title,
        kind: it.kind,
        done: false,
        notes: "",
        responsible: "",
      }));
      if (items.length > 0 || t.rubricObjective.trim()) {
        rubric = {
          name: t.title || prev?.title || "",
          objective: t.rubricObjective.trim(),
          sourceId: null,
          items,
        };
      } else if (prev?.rubric) {
        rubric = prev.rubric;
      }
    }

    const draftCandidate = {
      title: t.title || prev?.title || "",
      notes: t.notes || prev?.notes || "",
      type: finalType,
      category: pick(t.category, "Trabajo", prev?.category),
      priority: pick(t.priority, "media", prev?.priority),
      state: "pendiente",
      due,
      endDate,
      modality,
      projectId,
      tags: finalTags,
      subtasks: [],
      rubric,
    };

    const validated = taskInputSchema.safeParse(draftCandidate);
    if (!validated.success) {
      return res.json({
        kind: "message",
        text: "Entendí tu mensaje pero no pude armar el ítem. ¿Podés reformularlo?",
      });
    }

    let text = extraction.reply || "Te propongo esto:";
    if (projectNotFound) {
      text += ` (No encontré un proyecto llamado "${projectNotFound}", lo dejo sin proyecto.)`;
    }

    return res.json({ kind: "draft", text, draft: validated.data });
  } catch (err) {
    if (err instanceof OllamaError) {
      return res.status(err.kind === "down" ? 503 : 200).json({ kind: "error", text: err.message });
    }
    console.error("Error inesperado en /api/ai/chat:", err);
    return res.status(500).json({ kind: "error", text: "Error inesperado de la IA." });
  }
});
