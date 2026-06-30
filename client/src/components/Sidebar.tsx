import { CATEGORIES, CATEGORY_META, type Task, type Category } from "../types";

export type Section = "tasks" | "projects" | "analytics" | "rubrics" | "faq";

interface Props {
  tasks: Task[];
  activeCategory: string;
  section: Section;
  onCategory: (c: Category) => void;
  onProjects: () => void;
  onAnalytics: () => void;
  onRubrics: () => void;
  onFaq: () => void;
}

export default function Sidebar({
  tasks,
  activeCategory,
  section,
  onCategory,
  onProjects,
  onAnalytics,
  onRubrics,
  onFaq,
}: Props) {
  const itemCls = (active: boolean) =>
    `flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all ${
      active
        ? "bg-accent text-on-accent font-semibold shadow-lg shadow-accent/25"
        : "text-fg-dim hover:bg-surface-soft/70 hover:text-fg"
    }`;

  return (
    <nav className="glass w-56 border-r border-line/30 p-4 flex-shrink-0">
      <h3 className="text-[11px] uppercase tracking-wider text-fg-dim mb-2 px-2">Apartados</h3>
      <div className="space-y-1">
        {CATEGORIES.map((c) => {
          const count = tasks.filter((t) => t.category === c).length;
          const active = section === "tasks" && activeCategory === c;
          return (
            <div key={c} className={itemCls(active)} onClick={() => onCategory(c)}>
              <span>
                {CATEGORY_META[c].icon} {CATEGORY_META[c].label}
              </span>
              <span className="text-xs opacity-70">{count}</span>
            </div>
          );
        })}
      </div>

      <h3 className="text-[11px] uppercase tracking-wider text-fg-dim mb-2 mt-6 px-2">Paneles</h3>
      <div className="space-y-1">
        <div className={itemCls(section === "projects")} onClick={onProjects}>
          <span>📂 Proyectos</span>
        </div>
        <div className={itemCls(section === "analytics")} onClick={onAnalytics}>
          <span>📈 Estadísticas</span>
        </div>
      </div>

      <h3 className="text-[11px] uppercase tracking-wider text-fg-dim mb-2 mt-6 px-2">Herramientas</h3>
      <div className="space-y-1">
        <div className={itemCls(section === "rubrics")} onClick={onRubrics}>
          <span>📋 Rúbricas</span>
        </div>
        <div className={itemCls(section === "faq")} onClick={onFaq}>
          <span>❓ FAQ / Ayuda</span>
        </div>
      </div>
    </nav>
  );
}
