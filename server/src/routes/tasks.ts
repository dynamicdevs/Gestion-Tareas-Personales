import { Router } from "express";
import { prisma } from "../db.js";
import { taskInputSchema } from "../validation.js";

export const tasksRouter = Router();

// Devuelve una tarea con sus relaciones, aplanando tags a string[].
function serialize(task: any) {
  return {
    ...task,
    tags: task.tags?.map((t: any) => t.name) ?? [],
    subtasks: (task.subtasks ?? []).sort((a: any, b: any) => a.order - b.order),
    rubric: task.rubric
      ? { ...task.rubric, items: [...task.rubric.items].sort((a: any, b: any) => a.order - b.order) }
      : null,
  };
}

const include = {
  subtasks: true,
  tags: true,
  rubric: { include: { items: true } },
} as const;

// GET /api/tasks  -> lista (con filtros opcionales por query)
tasksRouter.get("/", async (req, res) => {
  const { category, state, projectId } = req.query as Record<string, string | undefined>;
  const where: any = {};
  if (category) where.category = category;
  if (state) where.state = state;
  if (projectId) where.projectId = projectId;

  const tasks = await prisma.task.findMany({
    where,
    include,
    orderBy: { createdAt: "desc" },
  });
  res.json(tasks.map(serialize));
});

// GET /api/tasks/:id
tasksRouter.get("/:id", async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include });
  if (!task) return res.status(404).json({ error: "Tarea no encontrada" });
  res.json(serialize(task));
});

// Conecta/crea tags por nombre y prepara subtareas con orden.
function buildRelations(data: { tags: string[]; subtasks: { text: string; done: boolean }[] }) {
  return {
    tags: {
      connectOrCreate: data.tags.map((name) => ({
        where: { name },
        create: { name },
      })),
    },
    subtasks: {
      create: data.subtasks.map((s, i) => ({ text: s.text, done: s.done, order: i })),
    },
  };
}

// Construye el create anidado de la rúbrica-instancia (o undefined si no hay).
function buildRubric(rubric: any) {
  if (!rubric) return undefined;
  return {
    create: {
      name: rubric.name ?? "",
      objective: rubric.objective ?? "",
      sourceId: rubric.sourceId ?? null,
      items: {
        create: (rubric.items ?? []).map((it: any, i: number) => ({
          title: it.title,
          kind: it.kind,
          done: it.done,
          notes: it.notes,
          responsible: it.responsible,
          order: i,
        })),
      },
    },
  };
}

// POST /api/tasks
tasksRouter.post("/", async (req, res) => {
  const parsed = taskInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const rel = buildRelations(d);

  const task = await prisma.task.create({
    data: {
      title: d.title,
      notes: d.notes,
      type: d.type,
      category: d.category,
      priority: d.priority,
      state: d.state,
      due: d.due ? new Date(d.due) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
      modality: d.modality ?? null,
      projectId: d.projectId ?? null,
      tags: rel.tags,
      subtasks: rel.subtasks,
      rubric: buildRubric(d.rubric),
    },
    include,
  });
  res.status(201).json(serialize(task));
});

// PUT /api/tasks/:id  -> reemplaza la tarea completa (incluye subtareas y tags)
tasksRouter.put("/:id", async (req, res) => {
  const parsed = taskInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }
  const exists = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });

  const d = parsed.data;
  const rel = buildRelations(d);

  // Borramos subtareas y rúbrica previas y recreamos (modelo simple y predecible).
  await prisma.subtask.deleteMany({ where: { taskId: req.params.id } });
  await prisma.meetingRubric.deleteMany({ where: { taskId: req.params.id } });

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      title: d.title,
      notes: d.notes,
      type: d.type,
      category: d.category,
      priority: d.priority,
      state: d.state,
      due: d.due ? new Date(d.due) : null,
      endDate: d.endDate ? new Date(d.endDate) : null,
      modality: d.modality ?? null,
      projectId: d.projectId ?? null,
      tags: { set: [], ...rel.tags }, // limpia y reconecta
      subtasks: rel.subtasks,
      rubric: buildRubric(d.rubric),
    },
    include,
  });
  res.json(serialize(task));
});

// PATCH /api/tasks/:id  -> actualización parcial rápida (ej: cambiar estado)
tasksRouter.patch("/:id", async (req, res) => {
  const exists = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });

  const allowed: any = {};
  for (const key of ["title", "notes", "category", "priority", "state"]) {
    if (req.body[key] !== undefined) allowed[key] = req.body[key];
  }
  if (req.body.due !== undefined) allowed.due = req.body.due ? new Date(req.body.due) : null;
  if (req.body.endDate !== undefined) allowed.endDate = req.body.endDate ? new Date(req.body.endDate) : null;
  // Permite asignar/quitar el proyecto. Validamos que exista (y, si la tarea no cambia
  // de categoría, que el proyecto sea de la misma categoría) para no romper la coherencia.
  if (req.body.projectId !== undefined) {
    const pid = req.body.projectId || null;
    if (pid) {
      const project = await prisma.project.findUnique({ where: { id: pid } });
      if (!project) return res.status(400).json({ error: "Proyecto no encontrado" });
      const targetCategory = allowed.category ?? exists.category;
      if (project.category !== targetCategory) {
        return res.status(400).json({ error: "El proyecto no pertenece al apartado de la tarea" });
      }
    }
    allowed.projectId = pid;
  }

  const task = await prisma.task.update({ where: { id: req.params.id }, data: allowed, include });
  res.json(serialize(task));
});

// PATCH /api/tasks/:id/subtasks/:subId  -> marcar subtarea
tasksRouter.patch("/:id/subtasks/:subId", async (req, res) => {
  const sub = await prisma.subtask.findUnique({ where: { id: req.params.subId } });
  if (!sub || sub.taskId !== req.params.id) {
    return res.status(404).json({ error: "Subtarea no encontrada" });
  }
  await prisma.subtask.update({
    where: { id: req.params.subId },
    data: { done: Boolean(req.body.done) },
  });
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include });
  res.json(serialize(task));
});

// DELETE /api/tasks/:id
tasksRouter.delete("/:id", async (req, res) => {
  const exists = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Tarea no encontrada" });
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
