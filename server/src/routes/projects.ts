import { Router } from "express";
import { prisma } from "../db.js";
import { projectInputSchema } from "../validation.js";

export const projectsRouter = Router();

// GET /api/projects  -> lista (opcionalmente filtrada por categoría)
projectsRouter.get("/", async (req, res) => {
  const { category } = req.query as Record<string, string | undefined>;
  const where = category ? { category } : {};
  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
  res.json(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      taskCount: p._count.tasks,
      finishedAt: p.finishedAt ? p.finishedAt.toISOString() : null,
    }))
  );
});

// POST /api/projects
projectsRouter.post("/", async (req, res) => {
  const parsed = projectInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }
  const project = await prisma.project.create({ data: parsed.data });
  res.status(201).json({ ...project, taskCount: 0, finishedAt: null });
});

// PATCH /api/projects/:id  -> renombrar y/o cambiar estado finalizado/activo.
// body: { name?: string, finished?: boolean }
projectsRouter.patch("/:id", async (req, res) => {
  const exists = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Proyecto no encontrado" });

  const data: { name?: string; finishedAt?: Date | null } = {};

  if (req.body.name !== undefined) {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });
    data.name = name;
  }
  // finished=true marca como finalizado (con fecha actual); false lo reabre.
  if (req.body.finished !== undefined) {
    data.finishedAt = req.body.finished ? new Date() : null;
  }

  const project = await prisma.project.update({ where: { id: req.params.id }, data });
  res.json({ ...project, finishedAt: project.finishedAt ? project.finishedAt.toISOString() : null });
});

// DELETE /api/projects/:id  -> borra el proyecto; sus tareas quedan sin proyecto (SetNull)
projectsRouter.delete("/:id", async (req, res) => {
  const exists = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Proyecto no encontrado" });
  await prisma.project.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
