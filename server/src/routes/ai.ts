import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { taskInputSchema, RUBRIC_KINDS } from "../validation.js";
import { extractWithOllama, chatFreeform, OllamaError } from "../ai/ollamaClient.js";
import { suggestRubricItems, generateMinutes, parsePointsFromText } from "../ai/rubricAi.js";
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
  // Ítems existentes (resumen ligero), para que la IA pueda responder consultas
  // del tipo "¿qué tengo esta semana?" o "pendientes urgentes de Trabajo".
  tasks: z
    .array(
      z.object({
        title: z.string(),
        type: z.string(),
        category: z.string(),
        priority: z.string(),
        state: z.string(),
        due: z.string().nullable().optional(),
        projectId: z.string().nullable().optional(),
      })
    )
    .optional()
    .default([]),
  // Plantillas de rúbrica existentes (resumen), para responder "¿qué rúbricas tengo?".
  rubrics: z
    .array(z.object({ name: z.string(), itemCount: z.number().optional().default(0) }))
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
    '  "intent": "create_task" | "chat" | "confirm" | "cancel" | "query" | "create_project" | "create_rubric",',
    '  "reply": "<mensaje breve en español>",',
    '  "query": { "category": "Trabajo"|"Personal"|"Estudios"|"", "priority": "urgente"|"alta"|"media"|"baja"|"", "type": "tarea"|"reunion"|"evento"|"", "state": "pendiente"|"curso"|"hecha"|"", "timeframe": "hoy"|"semana"|"semana_proxima"|"mes"|"vencidas"|"", "dateFrom": "<fecha literal o vacío>", "dateTo": "<fecha literal o vacío>" } | null,',
    '  "project": { "name": "<nombre del proyecto/curso>", "category": "Trabajo"|"Personal"|"Estudios" } | null,',
    '  "rubric": { "name": "<nombre de la plantilla>", "objective": "<objetivo o vacío>", "projectPhrase": "<proyecto al que pertenece, o vacío>", "items": [{ "title": "<punto>", "kind": "punto"|"acuerdo"|"siguiente_paso" }] } | null,',
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
    "- intent: 'create_task' para crear/editar el ítem; 'confirm' si el usuario pide guardarlo/crearlo ('confirmá', 'dale', 'sí creala'); 'cancel' si quiere descartar; 'query' si pregunta por lo que YA tiene anotado; 'create_project' si pide crear un proyecto o curso; 'chat' para el resto de preguntas/explicaciones.",
    "- IMPORTANTE: si el usuario describe algo para hacer/recordar/agendar (aunque sea breve, como 'preparar la presentación' o 'reunión el viernes'), USA intent='create_task' y arma el borrador con lo que tengas. NO pidas más datos: lo que falte queda con valores por defecto y el usuario lo completa en la tarjeta. Solo el TÍTULO es imprescindible.",
    "- CONSULTAS (intent='query'): si el usuario PREGUNTA por sus ítems existentes, SIEMPRE usa intent='query'. Esto incluye '¿qué tengo esta semana?', 'qué tengo pendiente', 'mis pendientes', 'qué hay vencido', 'qué reuniones tengo hoy', 'mostrame mis tareas', 'y qué más tengo', y CUALQUIER variante de preguntar por lo anotado. Rellena 'query' con los filtros que correspondan (deja en '' los que no apliquen; para 'pendiente' usa state='pendiente').",
    "- CRÍTICO: en una consulta NUNCA escribas títulos de ítems, fechas ni listas en 'reply'. JAMÁS inventes tareas. El sistema agrega los datos REALES por su cuenta. En 'reply' pon SOLO una frase introductoria breve y genérica ('Esto es lo que tienes:'). Si dudas entre 'query' y 'chat' para una pregunta sobre lo que tiene el usuario, elige SIEMPRE 'query'.",
    "- RÚBRICAS: si el usuario pregunta por sus rúbricas ('¿tengo rúbricas?', '¿qué rúbricas tengo?'), usa intent='query'. El sistema responde con la lista real de rúbricas; tú solo clasifica la intención, NO enumeres ni inventes rúbricas en 'reply'.",
    "- timeframe (uno solo): 'hoy'; 'semana' = esta semana / próximos 7 días; 'semana_proxima' = la semana que viene / la siguiente; 'mes' = este mes; 'vencidas' = atrasado/vencido. Si el usuario NO precisa fecha, deja timeframe=''.",
    "- dateFrom/dateTo: SOLO si el usuario nombra fechas concretas o un rango ('del 29 al 4 de julio', 'entre el lunes y el viernes', 'el 30 de junio'). Copia las fechas LITERALES (no las calcules); para un día único pon la misma fecha en ambos. Si usas dateFrom/dateTo, deja timeframe=''.",
    "- CREAR PROYECTO (intent='create_project'): si el usuario pide explícitamente crear un proyecto o curso ('creá un proyecto llamado Foundry', 'nuevo curso de inglés en Estudios'), usa intent='create_project' y rellena 'project' con name y category. Para CURSOS la category es 'Estudios'. No lo confundas con asignar una tarea a un proyecto (eso es create_task con projectPhrase).",
    "- CREAR RÚBRICA (intent='create_rubric'): si el usuario pide crear una RÚBRICA ('crea una rúbrica para daily standup', 'nueva rúbrica de revisión de sprint para el proyecto Foundry'), usa intent='create_rubric' y rellena 'rubric' (name, objective, projectPhrase si menciona un proyecto, items con sus puntos clasificados). IMPORTANTE: una rúbrica es INDEPENDIENTE y se asocia a un PROYECTO, NUNCA crea una reunión. NO uses create_task ni type='reunion' para esto. Si no menciona puntos, deja items vacío (el usuario los añadirá).",
    "- Usa intent='chat' SOLO si: el usuario saluda, agradece, o pide algo que no puedes hacer (invitar personas, adjuntos, integraciones externas). En ese último caso explica con amabilidad qué sí puedes hacer.",
    "- Nunca devuelvas un intent fuera de los siete indicados. Pon 'query', 'project' y 'rubric' en null salvo que uses esos intents.",
    "- type: 'reunion' si menciona reunión/junta/meeting/llamada con hora; 'evento' si dura varios días (vacaciones, viaje, conferencia); si no, 'tarea'.",
    "- priority EXACTA: 'urgente', 'alta', 'media' o 'baja' (nunca en inglés).",
    "- category EXACTA: 'Trabajo', 'Personal' o 'Estudios'; por defecto 'Trabajo'.",
    "- NO calcules fechas: copia la expresión literal en duePhrase ('mañana', 'el lunes 29', 'el viernes').",
    "- startTime/endTime en formato 24h 'HH:mm' (ej. '10:00', '15:30'). Si no hay hora, vacío.",
    "- modality solo para reuniones: 'presencial' o 'remoto' si se menciona; si no, vacío.",
    "- projectPhrase: si el usuario menciona un proyecto/curso ('para el proyecto Foundry'), copia su nombre; si no, vacío.",
    "- RÚBRICA (solo reuniones): si el usuario menciona puntos del orden del día, una minuta, temas a tratar, acuerdos o próximos pasos, ponlos en rubricItems. Clasifica cada punto: 'acuerdo' si es una decisión/acuerdo, 'siguiente_paso' si es una acción a futuro, 'punto' para temas a tratar. Si no menciona puntos, deja rubricItems vacío. rubricObjective solo si menciona el objetivo de la reunión.",
    "- No inventes campos ni valores de intent fuera de los indicados.",
    "- IMPORTANTE: el texto de 'reply' SIEMPRE en español NEUTRO (usa 'tú', nunca 'vos' ni formas como 'tenés', 'podés', 'creá').",
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
  lines.push("", "Responde 'reply' siempre en español NEUTRO (con 'tú', nunca 'vos'), breve y amable.");
  return lines.join("\n");
}

// Tipo del resumen ligero de ítem que envía el cliente para responder consultas.
type TaskLite = {
  title: string;
  type: string;
  category: string;
  priority: string;
  state: string;
  due?: string | null;
  projectId?: string | null;
};

type QueryFilters = {
  category: string;
  priority: string;
  type: string;
  state: string;
  timeframe: string;
  dateFrom: string;
  dateTo: string;
};

const PRIO_ICON: Record<string, string> = { urgente: "🔥", alta: "↑", media: "•", baja: "↓" };
const TYPE_ICON: Record<string, string> = { tarea: "📋", reunion: "👥", evento: "📅" };

// Infiere filtros de consulta a partir del texto del usuario (ya en minúsculas y sin
// acentos). Es la red de seguridad cuando el modelo no entrega 'query': preferimos
// filtros aproximados sobre datos reales antes que dejar que el modelo invente.
function inferQueryFilters(text: string): QueryFilters {
  const f: QueryFilters = {
    category: "", priority: "", type: "", state: "", timeframe: "", dateFrom: "", dateTo: "",
  };
  if (/\bpendient/.test(text)) f.state = "pendiente";
  if (/\b(vencid|atrasad)/.test(text)) f.timeframe = "vencidas";
  else if (/\bhoy\b/.test(text)) f.timeframe = "hoy";
  else if (/\b(proxima|siguiente|que viene)\b.*\bsemana\b|\bsemana\b.*\b(proxima|siguiente|que viene)\b/.test(text)) f.timeframe = "semana_proxima";
  else if (/\b(esta|la)\s+semana\b/.test(text)) f.timeframe = "semana";
  else if (/\b(este|el)\s+mes\b/.test(text)) f.timeframe = "mes";
  if (/\breunion/.test(text)) f.type = "reunion";
  else if (/\bevento/.test(text)) f.type = "evento";
  else if (/\btarea/.test(text)) f.type = "tarea";
  if (/\burgent/.test(text)) f.priority = "urgente";
  if (/\btrabajo\b/.test(text)) f.category = "Trabajo";
  else if (/\bpersonal\b/.test(text)) f.category = "Personal";
  else if (/\bestudio/.test(text)) f.category = "Estudios";
  return f;
}

// Construye una respuesta de texto a partir de los ítems existentes aplicando los
// filtros de la consulta. Todo el cómputo es determinista (no depende del modelo),
// así las cifras y listados son siempre fieles a los datos.
function answerQuery(tasks: TaskLite[], q: QueryFilters | null, now: Date): string {
  const f = q ?? { category: "", priority: "", type: "", state: "", timeframe: "", dateFrom: "", dateTo: "" };

  const DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Resolver una ventana temporal [from, to) según timeframe o rango explícito.
  // Si hay dateFrom/dateTo, tienen prioridad sobre timeframe.
  let from: Date | null = null;
  let to: Date | null = null;
  let overdue = false;

  const fromISO = resolvePhraseToISO(f.dateFrom, now);
  const toISO = resolvePhraseToISO(f.dateTo, now);
  if (fromISO || toISO) {
    from = fromISO ? new Date(fromISO) : startOfToday;
    // El rango es inclusivo en el día final: sumamos un día para usar < to.
    to = toISO ? new Date(new Date(toISO).getTime() + DAY) : null;
  } else if (f.timeframe === "vencidas") {
    overdue = true;
  } else if (f.timeframe === "hoy") {
    from = startOfToday;
    to = new Date(startOfToday.getTime() + DAY);
  } else if (f.timeframe === "semana") {
    from = startOfToday;
    to = new Date(startOfToday.getTime() + 7 * DAY);
  } else if (f.timeframe === "semana_proxima") {
    from = new Date(startOfToday.getTime() + 7 * DAY);
    to = new Date(startOfToday.getTime() + 14 * DAY);
  } else if (f.timeframe === "mes") {
    from = startOfToday;
    to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  const matches = tasks.filter((t) => {
    if (f.category && t.category !== f.category) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.type && t.type !== f.type) return false;
    if (f.state && t.state !== f.state) return false;
    const d = t.due ? new Date(t.due) : null;
    if (overdue) {
      if (!d || t.state === "hecha" || d >= startOfToday) return false;
    } else if (from || to) {
      if (!d) return false;
      if (from && d < from) return false;
      if (to && d >= to) return false;
    }
    return true;
  });

  if (matches.length === 0) {
    // Si filtró por tipo y no hubo resultados, comprobamos si hay OTROS ítems en el
    // mismo rango temporal: así evitamos el confuso "no hay nada" cuando en realidad
    // sí tiene cosas, solo que no de ese tipo (p. ej. pide "reuniones" y solo hay tareas).
    const TYPE_LABEL: Record<string, string> = { tarea: "tareas", reunion: "reuniones", evento: "eventos" };
    if (f.type) {
      const otrosEnRango = tasks.filter((t) => {
        const d = t.due ? new Date(t.due) : null;
        if (overdue) return d && t.state !== "hecha" && d < startOfToday;
        if (from || to) return d && (!from || d >= from) && (!to || d < to);
        return true;
      });
      if (otrosEnRango.length > 0) {
        const tipos = [...new Set(otrosEnRango.map((t) => TYPE_LABEL[t.type] ?? t.type))].join(" y ");
        return `No tienes ${TYPE_LABEL[f.type] ?? f.type} en ese período, pero sí ${otrosEnRango.length} ítem(s) de otro tipo (${tipos}). Pregúntame sin filtrar por tipo para verlos.`;
      }
    }
    return "No encontré ningún ítem que coincida con esa consulta. 🎉";
  }

  // Ordenar por fecha (los sin fecha al final).
  matches.sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  });

  const fmt = (iso?: string | null) => {
    if (!iso) return "sin fecha";
    return new Date(iso).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });
  };

  const MAX = 12;
  const shown = matches.slice(0, MAX);
  const lines = shown.map(
    (t) =>
      `${TYPE_ICON[t.type] ?? "•"} ${PRIO_ICON[t.priority] ?? ""} ${t.title} — ${fmt(t.due)}`.replace(/\s+/g, " ").trim()
  );
  let out = `Tienes ${matches.length} ${matches.length === 1 ? "ítem" : "ítems"}:\n` + lines.join("\n");
  if (matches.length > MAX) out += `\n…y ${matches.length - MAX} más.`;
  return out;
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

  // ¿El último mensaje del usuario pide claramente ver/listar lo que tiene anotado?
  // Lo calculamos ANTES de llamar al modelo: si la extracción estructurada falla
  // (o el modelo clasifica mal), NO debemos caer en texto libre porque alucinaría
  // ítems inexistentes; respondemos con los datos reales y filtros inferidos.
  const lastUserText = lastUser ? stripAccents(lastUser.content) : "";

  // ¿El mensaje pide CREAR algo? (para no confundir "creá una rúbrica" con "¿tengo rúbricas?")
  const looksLikeCreate = /\b(cre[ao]|nuev[ao]|arm[ao]|agreg[ao]|añad[ao]|anad[ao]|haz|hac[ea])\b/.test(lastUserText);

  // Pregunta específica sobre RÚBRICAS / plantillas (datos distintos a las tareas).
  // Tiene prioridad: si no la separáramos, "tengo rúbricas?" listaría tareas por error.
  // Excluimos las peticiones de creación.
  const looksLikeRubricQuery = !looksLikeCreate && /\b(rubrica|plantilla|orden del dia|minuta)/.test(lastUserText);

  const looksLikeQuery =
    !looksLikeRubricQuery &&
    !looksLikeCreate &&
    (/\b(que|cuant[ao]s?)\b.*\b(teng[ao]|hay|tien[eo]|pendient|qued[ao]|vencid|atrasad|reunion|tarea|evento|agenda|programad)/.test(
      lastUserText
    ) ||
      /\b(mis|mi)\s+(pendient|tarea|reunion|evento|agenda)/.test(lastUserText) ||
      /\b(pendient|vencid|atrasad)[eao]s?\b/.test(lastUserText) ||
      /\b(mostr[ao]|list[ao]|ver|muestrame|ensename)\b.*\b(tarea|reunion|evento|pendient|agenda|teng[ao])/.test(
        lastUserText
      ));

  // Respuesta sobre rúbricas a partir de los datos reales (nunca inventada).
  const answerRubrics = (): string => {
    const rs = parsed.data.rubrics;
    if (rs.length === 0) {
      return "No tienes ninguna rúbrica creada todavía. Puedes crear una desde la sección 📋 Rúbricas, o pedirme aquí que arme una (por ejemplo: \"crea una rúbrica de daily standup para el proyecto Foundry\").";
    }
    const lines = rs.map((r) => `📋 ${r.name}${r.itemCount ? ` (${r.itemCount} puntos)` : ""}`);
    return `Tienes ${rs.length} ${rs.length === 1 ? "rúbrica" : "rúbricas"}:\n` + lines.join("\n");
  };

  // Compone una consulta de datos reales con filtros inferidos del texto.
  const fallbackQueryResponse = () =>
    res.json({ kind: "message", text: answerQuery(parsed.data.tasks, inferQueryFilters(lastUserText), now) });

  try {
    let extraction;
    try {
      extraction = await extractWithOllama(messages);
    } catch (e) {
      // Si la extracción estructurada falla, NO rompemos.
      if (e instanceof OllamaError && e.kind === "invalid") {
        // Si pedía VER sus ítems/rúbricas (looksLike* ya excluyen las creaciones),
        // responder con DATOS REALES en lugar de texto libre que alucinaría.
        if (looksLikeRubricQuery) return res.json({ kind: "message", text: answerRubrics() });
        if (looksLikeQuery) return fallbackQueryResponse();
        const text = await chatFreeform([
          {
            role: "system",
            content:
              "Eres un asistente de un gestor de tareas. Responde breve y amable en español NEUTRO (usa 'tú', nunca 'vos'). Si el usuario pidió algo que no puedes hacer directamente (minutas, invitar gente, adjuntos), explica qué sí puedes hacer (crear tareas, reuniones y eventos) y cómo lograr el resto editando el ítem. NUNCA inventes ni enumeres tareas, fechas o ítems concretos del usuario: no tienes acceso a su lista.",
          },
          ...parsed.data.messages,
        ]);
        return res.json({ kind: "message", text: text || "¿Puedes reformularlo?" });
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

    // Pregunta sobre rúbricas/plantillas: respondemos con la lista real de rúbricas.
    if (looksLikeRubricQuery && (extraction.intent === "query" || extraction.intent === "chat")) {
      return res.json({ kind: "message", text: answerRubrics() });
    }

    // Consulta/resumen sobre los ítems existentes. La respuesta se compone con los
    // datos reales que envió el cliente, no con lo que "imagine" el modelo. La red de
    // seguridad looksLikeQuery fuerza este camino aunque el modelo clasifique 'chat'.
    if (extraction.intent === "query" || (looksLikeQuery && extraction.intent === "chat")) {
      const intro = extraction.intent === "query" ? extraction.reply?.trim() : "";
      // Si el modelo no dejó filtros (p. ej. clasificó mal como 'chat'), los inferimos
      // del texto del usuario para no perder la intención (pendiente, vencidas, tipo…).
      const filters = extraction.query ?? inferQueryFilters(lastUserText);
      const summary = answerQuery(parsed.data.tasks, filters, now);
      const text = intro && intro.length <= 80 ? `${intro}\n\n${summary}` : summary;
      return res.json({ kind: "message", text });
    }

    // Crear un proyecto/curso por lenguaje natural.
    if (extraction.intent === "create_project") {
      const name = (extraction.project?.name || "").trim();
      const category = extraction.project?.category || "Trabajo";
      if (!name) {
        return res.json({ kind: "message", text: "¿Cómo quieres que se llame el proyecto?" });
      }
      // Evitar duplicados (mismo nombre + categoría, sin distinguir acentos/mayúsculas).
      const norm = (s: string) =>
        Array.from(s.toLowerCase().normalize("NFD"))
          .filter((ch) => {
            const c = ch.charCodeAt(0);
            return c < 0x0300 || c > 0x036f;
          })
          .join("")
          .trim();
      const existing = await prisma.project.findMany({ where: { category } });
      const dup = existing.find((p) => norm(p.name) === norm(name));
      const termino = category === "Estudios" ? "curso" : "proyecto";
      if (dup) {
        return res.json({
          kind: "project_created",
          text: `Ya existe un ${termino} llamado "${dup.name}" en ${category}.`,
          project: { id: dup.id, name: dup.name, category: dup.category },
        });
      }
      const created = await prisma.project.create({ data: { name, category } });
      return res.json({
        kind: "project_created",
        text: extraction.reply || `Creé el ${termino} "${created.name}" en ${category}.`,
        project: { id: created.id, name: created.name, category: created.category },
      });
    }

    // Crear una RÚBRICA: arrancamos el asistente SECUENCIAL paso a paso. Pre-cargamos
    // lo que el usuario ya haya mencionado (nombre, proyecto, puntos) para saltar pasos.
    if (extraction.intent === "create_rubric") {
      const r = extraction.rubric;
      const norm = (s: string) =>
        Array.from(s.toLowerCase().normalize("NFD"))
          .filter((ch) => {
            const c = ch.charCodeAt(0);
            return c < 0x0300 || c > 0x036f;
          })
          .join("")
          .trim();

      let projectId: string | null = null;
      let projectName: string | null = null;
      const phrase = norm(r?.projectPhrase || "");
      if (phrase) {
        const phraseWords = phrase.split(/\s+/).filter((w) => w.length >= 3);
        const match = projects.find((p) => {
          const n = norm(p.name);
          if (n === phrase || n.includes(phrase) || phrase.includes(n)) return true;
          const nWords = n.split(/\s+/);
          return phraseWords.some((w) => nWords.some((nw) => nw === w || nw.startsWith(w) || w.startsWith(nw)));
        });
        if (match) {
          projectId = match.id;
          projectName = match.name;
        }
      }

      const draft = {
        name: (r?.name || "").trim(),
        objective: r?.objective || "",
        projectId,
        projectName,
        pendingProjectName: null,
        items: (r?.items ?? []).map((it) => ({ title: it.title, kind: it.kind })),
      };

      // Determinar el primer paso pendiente para no preguntar lo que ya sabemos.
      let startStep: string;
      if (!draft.name) startStep = "name";
      else if (!draft.projectId && !draft.projectName) startStep = "project";
      else startStep = "objective";

      const intro = "Perfecto, te ayudo a armar la rúbrica paso a paso. 📋";
      return res.json({ kind: "rubric_flow", text: intro, flow: { step: startStep, draft } });
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
        text: "Entendí tu mensaje pero no pude armar el ítem. ¿Puedes reformularlo?",
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

// Maneja errores de Ollama de forma uniforme para los endpoints de rúbrica.
function handleAiError(err: unknown, res: any, ctx: string) {
  if (err instanceof OllamaError) {
    return res.status(err.kind === "down" ? 503 : 200).json({ error: err.message });
  }
  console.error(`Error inesperado en ${ctx}:`, err);
  return res.status(500).json({ error: "Error inesperado de la IA." });
}

const suggestReqSchema = z.object({
  title: z.string().min(1),
  objective: z.string().default(""),
});

// POST /api/ai/suggest-rubric -> sugiere puntos del orden del día.
aiRouter.post("/suggest-rubric", async (req, res) => {
  const parsed = suggestReqSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Falta el título de la reunión." });
  }
  try {
    const items = await suggestRubricItems(parsed.data.title, parsed.data.objective);
    res.json({ items });
  } catch (err) {
    handleAiError(err, res, "/api/ai/suggest-rubric");
  }
});

const minutesReqSchema = z.object({
  title: z.string().min(1),
  objective: z.string().default(""),
  items: z
    .array(
      z.object({
        title: z.string(),
        kind: z.string().default("punto"),
        notes: z.string().default(""),
        responsible: z.string().default(""),
        done: z.boolean().default(false),
      })
    )
    .default([]),
});

// POST /api/ai/minutes -> genera el acta a partir de los puntos tratados.
aiRouter.post("/minutes", async (req, res) => {
  const parsed = minutesReqSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos de la reunión inválidos." });
  }
  try {
    const text = await generateMinutes(parsed.data.title, parsed.data.objective, parsed.data.items);
    res.json({ text });
  } catch (err) {
    handleAiError(err, res, "/api/ai/minutes");
  }
});

// ===================== Asistente SECUENCIAL de rúbricas =====================
// Flujo determinista paso a paso (el backend controla el orden). La IA solo se usa
// para partir el texto del usuario en puntos individuales. Los pasos son:
//   name -> project -> objective -> points -> agreements -> nextSteps -> confirm
// El usuario puede "saltar" pasos opcionales, "editar <paso>" para volver, o
// "confirmar" al final para crear la rúbrica.

const RUBRIC_STEPS = ["name", "project", "objective", "points", "agreements", "nextSteps", "confirm"] as const;
type RubricStep = (typeof RUBRIC_STEPS)[number];

const rubricDraftSchema = z.object({
  name: z.string().default(""),
  objective: z.string().default(""),
  projectId: z.string().nullable().default(null),
  projectName: z.string().nullable().default(null),
  // Nombre de un proyecto inexistente que el asistente ofreció crear (pendiente de confirmar).
  pendingProjectName: z.string().nullable().default(null),
  items: z
    .array(z.object({ title: z.string(), kind: z.enum(RUBRIC_KINDS) }))
    .default([]),
});
// Tipo concreto (no z.infer, que con tantos .default vuelve los campos opcionales).
type RubricItem = { title: string; kind: (typeof RUBRIC_KINDS)[number] };
type RubricDraft = {
  name: string;
  objective: string;
  projectId: string | null;
  projectName: string | null;
  pendingProjectName: string | null;
  items: RubricItem[];
};

const rubricFlowSchema = z.object({
  step: z.enum(RUBRIC_STEPS).default("name"),
  draft: rubricDraftSchema.default({}),
  message: z.string().default(""),
  projects: z
    .array(z.object({ id: z.string(), name: z.string(), category: z.string() }))
    .default([]),
});

const stripA = (s: string) =>
  Array.from(s.toLowerCase().normalize("NFD"))
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c < 0x0300 || c > 0x036f;
    })
    .join("")
    .trim();

const isSkip = (m: string) => /^(no|nada|ningun[oa]?|sin|salt[ao]r?|omitir|paso|siguiente|ninguno mas|listo|nada mas|no hay)\b/.test(stripA(m));
const isConfirm = (m: string) => /^(si|s[ií]|dale|ok|oka?y?|confirm|cre[ao]|guard|list[oa]|perfecto|adelante|va|vale|hazlo|hacelo)\b/.test(stripA(m));
const isCancel = (m: string) => /^(cancel|descart|olvid|dejalo|anul|para|stop|abort)/.test(stripA(m));

// Detecta "editar/cambiar <campo>" y devuelve el paso al que volver, o null.
function detectEdit(m: string): RubricStep | null {
  const s = stripA(m);
  if (!/\b(edit|cambi|corregi|modific|volver|atras|rehacer)/.test(s)) return null;
  if (/\bnombre\b/.test(s)) return "name";
  if (/\bproyect|curso\b/.test(s)) return "project";
  if (/\bobjetiv|descripci/.test(s)) return "objective";
  if (/\bpunto/.test(s)) return "points";
  if (/\bacuerdo/.test(s)) return "agreements";
  if (/\b(proximo|siguiente)/.test(s)) return "nextSteps";
  return null;
}

// Texto de la pregunta para cada paso.
function promptFor(step: RubricStep, draft: RubricDraft): { reply: string } {
  switch (step) {
    case "name":
      return { reply: "1) ¿Cómo se va a llamar la rúbrica?" };
    case "project":
      return { reply: "2) ¿A qué proyecto pertenece? Escribe el nombre, o di 'ninguno' para dejarla general." };
    case "objective":
      return { reply: "3) ¿De qué trata? Cuéntame el objetivo o una breve descripción (o 'saltar')." };
    case "points":
      return { reply: "4) Dime los puntos a tratar (puedes poner varios separados por comas). Cuando termines, escribe 'listo'." };
    case "agreements":
      return { reply: "5) ¿Hay acuerdos esperados para esta reunión? Escríbelos, o 'no' si no aplica." };
    case "nextSteps":
      return { reply: "6) ¿Próximos pasos / acciones de seguimiento? Escríbelos, o 'no' si no aplica." };
    case "confirm":
      return { reply: summarize(draft) + "\n\n¿La creo? (sí / editar <campo> / cancelar)" };
  }
}

// Resumen legible del borrador en curso.
function summarize(d: RubricDraft): string {
  const lines = ["Esto es lo que tengo:", "", `📋 Nombre: ${d.name || "—"}`];
  lines.push(`📁 Proyecto: ${d.projectName || "ninguno (general)"}`);
  if (d.objective) lines.push(`🎯 Descripción: ${d.objective}`);
  const byKind = (k: string) => d.items.filter((i) => i.kind === k);
  const fmt = (icon: string, label: string, arr: { title: string }[]) =>
    arr.length ? `\n${icon} ${label}:\n` + arr.map((i) => `   • ${i.title}`).join("\n") : "";
  lines.push(fmt("•", "Puntos a tratar", byKind("punto")));
  lines.push(fmt("✅", "Acuerdos", byKind("acuerdo")));
  lines.push(fmt("➡️", "Próximos pasos", byKind("siguiente_paso")));
  return lines.filter(Boolean).join("\n");
}

// POST /api/ai/rubric-flow -> avanza un paso del asistente secuencial de rúbricas.
aiRouter.post("/rubric-flow", async (req, res) => {
  const parsed = rubricFlowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Petición inválida." });

  let step: RubricStep = parsed.data.step;
  const draft: RubricDraft = parsed.data.draft as RubricDraft;
  const { message, projects } = parsed.data;
  const msg = message.trim();

  try {
    // Cancelar en cualquier momento.
    if (msg && isCancel(msg)) {
      return res.json({ step, draft, reply: "Listo, cancelé la creación de la rúbrica.", cancelled: true });
    }

    // Editar un paso anterior (vuelve a preguntarlo).
    const editTo = msg ? detectEdit(msg) : null;
    if (editTo) {
      step = editTo;
      return res.json({ step, draft, ...promptFor(step, draft) });
    }

    // Mensaje vacío = arranque: pedimos el primer paso pendiente.
    if (!msg) {
      return res.json({ step, draft, ...promptFor(step, draft) });
    }

    // Procesar la respuesta SEGÚN el paso actual, luego avanzar.
    switch (step) {
      case "name": {
        draft.name = msg.slice(0, 160);
        step = "project";
        break;
      }
      case "project": {
        // ¿Veníamos de ofrecer crear un proyecto inexistente?
        if (draft.pendingProjectName) {
          if (isConfirm(msg)) {
            // Crear el proyecto (categoría Trabajo por defecto) y asignarlo.
            const created = await prisma.project.create({
              data: { name: draft.pendingProjectName, category: "Trabajo" },
            });
            draft.projectId = created.id;
            draft.projectName = created.name;
            draft.pendingProjectName = null;
            step = "objective";
            break;
          }
          if (isSkip(msg) || /^no\b/.test(stripA(msg))) {
            // No crearlo: la rúbrica queda sin proyecto.
            draft.pendingProjectName = null;
            draft.projectId = null;
            draft.projectName = null;
            step = "objective";
            break;
          }
          // Cualquier otra cosa: lo tratamos como un NUEVO intento de nombre (sigue abajo).
          draft.pendingProjectName = null;
        }

        if (isSkip(msg)) {
          draft.projectId = null;
          draft.projectName = null;
        } else {
          const phrase = stripA(msg);
          const words = phrase.split(/\s+/).filter((w) => w.length >= 3);
          const match = projects.find((p) => {
            const n = stripA(p.name);
            if (n === phrase || n.includes(phrase) || phrase.includes(n)) return true;
            const nw = n.split(/\s+/);
            return words.some((w) => nw.some((x) => x === w || x.startsWith(w) || w.startsWith(x)));
          });
          if (match) {
            draft.projectId = match.id;
            draft.projectName = match.name;
          } else {
            // Proyecto no existe: ofrecemos crearlo antes de seguir.
            draft.pendingProjectName = msg.trim();
            return res.json({
              step: "project",
              draft,
              reply: `No encontré un proyecto llamado "${msg.trim()}". ¿Quieres que lo cree? (sí / no para dejarla sin proyecto)`,
              offerCreateProject: msg.trim(),
            });
          }
        }
        step = "objective";
        break;
      }
      case "objective": {
        if (!isSkip(msg)) draft.objective = msg.slice(0, 3000);
        step = "points";
        break;
      }
      case "points": {
        if (!isSkip(msg)) {
          const titles = await parsePointsFromText(msg);
          draft.items.push(...titles.map((t) => ({ title: t, kind: "punto" as const })));
        }
        step = "agreements";
        break;
      }
      case "agreements": {
        if (!isSkip(msg)) {
          const titles = await parsePointsFromText(msg);
          draft.items.push(...titles.map((t) => ({ title: t, kind: "acuerdo" as const })));
        }
        step = "nextSteps";
        break;
      }
      case "nextSteps": {
        if (!isSkip(msg)) {
          const titles = await parsePointsFromText(msg);
          draft.items.push(...titles.map((t) => ({ title: t, kind: "siguiente_paso" as const })));
        }
        step = "confirm";
        break;
      }
      case "confirm": {
        if (isConfirm(msg)) {
          if (!draft.name.trim()) {
            step = "name";
            return res.json({ step, draft, reply: "Necesito un nombre primero. ¿Cómo se va a llamar?" });
          }
          // Verificar que el proyecto siga existiendo (evita violar la FK).
          let projectId = draft.projectId;
          if (projectId) {
            const exists = await prisma.project.findUnique({ where: { id: projectId } });
            if (!exists) projectId = null;
          }
          const created = await prisma.rubricTemplate.create({
            data: {
              name: draft.name.trim(),
              objective: draft.objective,
              projectId,
              items: { create: draft.items.map((it, i) => ({ title: it.title, kind: it.kind, order: i })) },
            },
          });
          return res.json({
            step: "confirm",
            draft,
            reply: `¡Listo! Creé la rúbrica "${created.name}"${draft.projectName ? ` para ${draft.projectName}` : ""}. La verás en la sección 📋 Rúbricas.`,
            done: true,
            createdId: created.id,
          });
        }
        // No entendido en confirm: re-mostrar resumen.
        return res.json({ step, draft, reply: summarize(draft) + "\n\n¿La creo? (sí / editar <campo> / cancelar)" });
      }
    }

    return res.json({ step, draft, ...promptFor(step, draft) });
  } catch (err) {
    handleAiError(err, res, "/api/ai/rubric-flow");
  }
});
