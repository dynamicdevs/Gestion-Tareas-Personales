import express from "express";
import cors from "cors";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { rubricsRouter } from "./routes/rubrics.js";
import { aiRouter } from "./routes/ai.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/tasks", tasksRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/rubrics", rubricsRouter);
app.use("/api/ai", aiRouter);

// Manejo de errores no controlados de las rutas async.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.listen(PORT, () => {
  console.log(`✅ API escuchando en http://localhost:${PORT}`);
});
