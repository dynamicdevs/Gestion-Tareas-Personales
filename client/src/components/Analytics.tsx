import { useMemo, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_META,
  STATE_META,
  type Project,
  type Task,
  type Category,
  type State,
} from "../types";
import { dayKey } from "../utils";

interface Props {
  projects: Project[];
  tasks: Task[];
}

// Paleta para barras/segmentos (cian de marca + tonos complementarios).
const PALETTE = ["#06D6E8", "#22d3ee", "#7dd3fc", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#fb7185"];
const STATE_COLOR: Record<State, string> = {
  pendiente: "#94a3b8",
  curso: "#fbbf24",
  hecha: "#34d399",
};

const RANGES = [
  { id: 7, label: "7 días" },
  { id: 14, label: "14 días" },
  { id: 30, label: "30 días" },
] as const;

// Dashboard de estadísticas: tareas por proyecto + tareas completadas por día.
export default function Analytics({ projects, tasks }: Props) {
  const [range, setRange] = useState<number>(14);
  const [cat, setCat] = useState<Category | "all">("all");

  const scoped = useMemo(
    () => (cat === "all" ? tasks : tasks.filter((t) => t.category === cat)),
    [tasks, cat]
  );

  // ---- Tareas por proyecto (barras horizontales) ----
  const perProject = useMemo(() => {
    const rows = projects
      .filter((p) => cat === "all" || p.category === cat)
      .map((p) => {
        const list = scoped.filter((t) => t.projectId === p.id);
        return {
          name: p.name,
          category: p.category,
          total: list.length,
          done: list.filter((t) => t.state === "hecha").length,
        };
      });
    // Tareas sin proyecto.
    const orphan = scoped.filter((t) => !t.projectId);
    if (orphan.length) {
      rows.push({
        name: "Sin proyecto",
        category: (cat === "all" ? "Trabajo" : cat) as Category,
        total: orphan.length,
        done: orphan.filter((t) => t.state === "hecha").length,
      });
    }
    return rows.sort((a, b) => b.total - a.total);
  }, [projects, scoped, cat]);

  const maxPerProject = Math.max(1, ...perProject.map((r) => r.total));

  // ---- Tareas completadas por día (usa updatedAt de las hechas) ----
  const completedSeries = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { key: string; label: string; count: number }[] = [];
    const counts: Record<string, number> = {};
    for (const t of scoped) {
      if (t.state !== "hecha") continue;
      const k = dayKey(new Date(t.updatedAt));
      counts[k] = (counts[k] || 0) + 1;
    }
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const k = dayKey(d);
      days.push({
        key: k,
        label: d.toLocaleDateString("es", { day: "numeric", month: "short" }),
        count: counts[k] || 0,
      });
    }
    return days;
  }, [scoped, range]);

  const totalCompletedInRange = completedSeries.reduce((a, d) => a + d.count, 0);

  // ---- Distribución por estado (donut) ----
  const byState = useMemo(() => {
    return (Object.keys(STATE_META) as State[]).map((s) => ({
      state: s,
      label: STATE_META[s].label,
      count: scoped.filter((t) => t.state === s).length,
      color: STATE_COLOR[s],
    }));
  }, [scoped]);

  const totalScoped = scoped.length;

  return (
    <div>
      <header className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-fg flex items-center gap-2">
            <span className="text-accent">📈</span> Estadísticas de tareas
          </h2>
          <p className="text-sm text-fg-dim mt-1">
            Visualiza cuántas tareas tienes por proyecto y cuántas completas cada día.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="field-input cursor-pointer"
            value={cat}
            onChange={(e) => setCat(e.target.value as Category | "all")}
          >
            <option value="all">Todos los apartados</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon="📊" label="Tareas (apartado)" value={totalScoped} color="text-accent" />
        <Kpi
          icon="✅"
          label="Completadas"
          value={scoped.filter((t) => t.state === "hecha").length}
          color="text-green-400"
        />
        <Kpi
          icon="⚙️"
          label="En curso"
          value={scoped.filter((t) => t.state === "curso").length}
          color="text-yellow-400"
        />
        <Kpi icon="🗂️" label="Proyectos" value={perProject.filter((r) => r.name !== "Sin proyecto").length} color="text-fg" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tareas por proyecto */}
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold text-fg mb-4">Tareas por proyecto</h3>
          {perProject.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              {perProject.map((r, i) => {
                const color = PALETTE[i % PALETTE.length];
                const w = (r.total / maxPerProject) * 100;
                const donePct = r.total ? (r.done / r.total) * 100 : 0;
                return (
                  <div key={r.name + i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-fg truncate pr-2">{r.name}</span>
                      <span className="text-fg-dim flex-shrink-0">
                        {r.done}/{r.total}
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-surface-soft overflow-hidden relative">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${w}%`, backgroundColor: color, opacity: 0.35 }}
                      />
                      {/* Porción hecha, sólida */}
                      <div
                        className="h-full rounded-full transition-all absolute top-0 left-0"
                        style={{ width: `${(w * donePct) / 100}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Distribución por estado (donut) */}
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold text-fg mb-4">Distribución por estado</h3>
          {totalScoped === 0 ? (
            <Empty />
          ) : (
            <div className="flex items-center gap-6">
              <Donut data={byState.map((s) => ({ value: s.count, color: s.color }))} total={totalScoped} />
              <div className="space-y-2">
                {byState.map((s) => (
                  <div key={s.state} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="text-fg-dim">{s.label}</span>
                    <span className="text-fg font-semibold ml-auto">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tareas completadas por día */}
      <div className="glass rounded-2xl p-5 mt-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="font-semibold text-fg">
            Tareas completadas por día
            <span className="text-fg-dim font-normal text-sm ml-2">
              · {totalCompletedInRange} en {range} días
            </span>
          </h3>
          <div className="glass rounded-xl p-1 flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  range === r.id ? "bg-accent text-on-accent" : "text-fg-dim hover:text-fg"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <AreaChart series={completedSeries} />
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-2xl px-5 py-4 flex items-center gap-4">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-fg-dim">{label}</div>
      </div>
    </div>
  );
}

function Empty() {
  return <div className="text-center text-sm text-fg-dim py-8">No hay datos para mostrar.</div>;
}

// Donut SVG con segmentos por estado.
function Donut({ data, total }: { data: { value: number; color: string }[]; total: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d, i) => {
      const frac = d.value / total;
      const seg = (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={d.color}
          strokeWidth="14"
          strokeDasharray={`${frac * c} ${c}`}
          strokeDashoffset={-offset}
          transform="rotate(-90 50 50)"
        />
      );
      offset += frac * c;
      return seg;
    });
  return (
    <svg viewBox="0 0 100 100" className="w-32 h-32 flex-shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--surface-soft))" strokeWidth="14" />
      {segments}
      <text x="50" y="48" textAnchor="middle" className="fill-fg" style={{ fontSize: 18, fontWeight: 700 }}>
        {total}
      </text>
      <text x="50" y="62" textAnchor="middle" className="fill-fg-dim" style={{ fontSize: 8 }}>
        tareas
      </text>
    </svg>
  );
}

// Gráfico de área + línea para la serie de tareas completadas por día.
function AreaChart({ series }: { series: { key: string; label: string; count: number }[] }) {
  const W = 720;
  const H = 200;
  const padX = 28;
  const padY = 24;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const max = Math.max(1, ...series.map((d) => d.count));
  const n = series.length;

  const x = (i: number) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padY + innerH - (v / max) * innerH;

  const linePts = series.map((d, i) => `${x(i)},${y(d.count)}`).join(" ");
  const areaPts = `${padX},${padY + innerH} ${linePts} ${padX + innerW},${padY + innerH}`;

  // Etiquetas del eje X: como mucho ~7 para no saturar.
  const labelStep = Math.ceil(n / 7);

  // Líneas de cuadrícula horizontales (0, mitad, max).
  const gridVals = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" style={{ height: 200 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06D6E8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#06D6E8" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Cuadrícula + etiquetas del eje Y */}
        {gridVals.map((v) => (
          <g key={v}>
            <line
              x1={padX}
              x2={padX + innerW}
              y1={y(v)}
              y2={y(v)}
              stroke="rgb(var(--border))"
              strokeOpacity="0.4"
              strokeDasharray="3 4"
            />
            <text x={padX - 6} y={y(v) + 3} textAnchor="end" className="fill-fg-dim" style={{ fontSize: 9 }}>
              {v}
            </text>
          </g>
        ))}

        {/* Área */}
        <polygon points={areaPts} fill="url(#areaGrad)" />
        {/* Línea */}
        <polyline points={linePts} fill="none" stroke="#06D6E8" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Puntos + etiquetas X */}
        {series.map((d, i) => (
          <g key={d.key}>
            {d.count > 0 && <circle cx={x(i)} cy={y(d.count)} r="3.5" fill="#06D6E8" />}
            {i % labelStep === 0 && (
              <text
                x={x(i)}
                y={H - 6}
                textAnchor="middle"
                className="fill-fg-dim"
                style={{ fontSize: 9 }}
              >
                {d.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
