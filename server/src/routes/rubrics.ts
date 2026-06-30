import { Router } from "express";
import { prisma } from "../db.js";
import { rubricTemplateInputSchema } from "../validation.js";

export const rubricsRouter = Router();

const include = { items: true } as const;

function serialize(t: any) {
  return {
    ...t,
    meetingDate: t.meetingDate ? new Date(t.meetingDate).toISOString() : null,
    items: (t.items ?? []).sort((a: any, b: any) => a.order - b.order),
  };
}

// Crea los items de la plantilla con su orden. Solo title/kind son relevantes en plantillas.
function buildItems(items: { title: string; kind: string }[]) {
  return { create: items.map((it, i) => ({ title: it.title, kind: it.kind, order: i })) };
}

// GET /api/rubrics?projectId=...  -> lista de actas (con conteo de puntos)
rubricsRouter.get("/", async (req, res) => {
  const { projectId } = req.query as Record<string, string | undefined>;
  const where = projectId ? { projectId } : {};
  const templates = await prisma.rubricTemplate.findMany({
    where,
    orderBy: [{ meetingDate: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { items: true } } },
  });
  res.json(
    templates.map((t) => ({
      id: t.id,
      name: t.name,
      objective: t.objective,
      meetingDate: t.meetingDate ? t.meetingDate.toISOString() : null,
      people: t.people,
      projectId: t.projectId,
      itemCount: t._count.items,
    }))
  );
});

// GET /api/rubrics/:id  -> plantilla completa con items
rubricsRouter.get("/:id", async (req, res) => {
  const t = await prisma.rubricTemplate.findUnique({ where: { id: req.params.id }, include });
  if (!t) return res.status(404).json({ error: "Rúbrica no encontrada" });
  res.json(serialize(t));
});

// POST /api/rubrics
rubricsRouter.post("/", async (req, res) => {
  const parsed = rubricTemplateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }
  const d = parsed.data;
  const t = await prisma.rubricTemplate.create({
    data: {
      name: d.name,
      objective: d.objective,
      meetingDate: d.meetingDate ? new Date(d.meetingDate) : null,
      people: d.people ?? "",
      projectId: d.projectId ?? null,
      items: buildItems(d.items),
    },
    include,
  });
  res.status(201).json(serialize(t));
});

// PUT /api/rubrics/:id  -> reemplaza (borra items y recrea, patrón de subtasks)
rubricsRouter.put("/:id", async (req, res) => {
  const parsed = rubricTemplateInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }
  const exists = await prisma.rubricTemplate.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Rúbrica no encontrada" });

  const d = parsed.data;
  await prisma.rubricTemplateItem.deleteMany({ where: { templateId: req.params.id } });
  const t = await prisma.rubricTemplate.update({
    where: { id: req.params.id },
    data: {
      name: d.name,
      objective: d.objective,
      meetingDate: d.meetingDate ? new Date(d.meetingDate) : null,
      people: d.people ?? "",
      projectId: d.projectId ?? null,
      items: buildItems(d.items),
    },
    include,
  });
  res.json(serialize(t));
});

// DELETE /api/rubrics/:id  (las instancias ya copiadas en reuniones sobreviven)
rubricsRouter.delete("/:id", async (req, res) => {
  const exists = await prisma.rubricTemplate.findUnique({ where: { id: req.params.id } });
  if (!exists) return res.status(404).json({ error: "Rúbrica no encontrada" });
  await prisma.rubricTemplate.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
