import { useEffect, useState } from "react";
import { api } from "../api";
import { CATEGORY_META, RUBRIC_KIND_META, type Project, type RubricTemplate, type RubricInput, type RubricItemInput } from "../types";
import RubricEditor from "./RubricEditor";
import { useConfirm } from "../confirm";

interface Props {
  projects: Project[];
  onChanged: () => void; // recarga global (para que el TaskModal vea plantillas nuevas)
}

type EditorState = {
  id: string | null; // null = nueva
  name: string;
  objective: string;
  projectId: string | null;
  items: RubricItemInput[];
};

const empty: EditorState = { id: null, name: "", objective: "", projectId: null, items: [] };

// Gestor de plantillas de rúbrica (sección de la barra lateral).
export default function RubricManager({ projects, onChanged }: Props) {
  const confirm = useConfirm();
  const [list, setList] = useState<RubricTemplate[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setList(await api.listRubrics());
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  async function openEdit(id: string) {
    const full = await api.getRubric(id);
    setEditor({
      id: full.id,
      name: full.name,
      objective: full.objective,
      projectId: full.projectId,
      items: full.items.map((it) => ({
        title: it.title,
        kind: it.kind,
        done: it.done,
        notes: it.notes,
        responsible: it.responsible,
      })),
    });
  }

  async function save() {
    if (!editor || !editor.name.trim()) return;
    const payload: RubricInput & { projectId: string | null } = {
      name: editor.name.trim(),
      objective: editor.objective,
      sourceId: null,
      projectId: editor.projectId,
      items: editor.items.filter((it) => it.title.trim()),
    };
    if (editor.id) await api.updateRubric(editor.id, payload);
    else await api.createRubric(payload);
    setEditor(null);
    await reload();
    onChanged();
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Eliminar rúbrica",
      message: "¿Eliminar esta rúbrica? Las reuniones que ya la usaron conservan su copia.",
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    await api.removeRubric(id);
    await reload();
    onChanged();
  }

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;

  // --- Vista editor ---
  if (editor) {
    return (
      <div className="max-w-2xl">
        <button className="text-sm text-fg-dim hover:text-fg mb-4" onClick={() => setEditor(null)}>
          ‹ Volver a las rúbricas
        </button>
        <div className="glass rounded-2xl p-5">
          <h2 className="text-lg font-bold text-fg mb-4 flex items-center gap-2">
            <span className="text-accent">📋</span>
            {editor.id ? "Editar rúbrica" : "Nueva rúbrica"}
          </h2>

          <label className="block text-xs text-fg-dim mb-1">Nombre de la rúbrica *</label>
          <input
            className="field-input mb-4"
            value={editor.name}
            onChange={(e) => setEditor({ ...editor, name: e.target.value })}
            placeholder="ej: Daily de equipo, Revisión de sprint..."
          />

          <label className="block text-xs text-fg-dim mb-1">Proyecto (opcional)</label>
          <select
            className="field-input mb-4 cursor-pointer"
            value={editor.projectId ?? ""}
            onChange={(e) => setEditor({ ...editor, projectId: e.target.value || null })}
          >
            <option value="">Sin proyecto (general)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {CATEGORY_META[p.category].icon} {p.name}
              </option>
            ))}
          </select>

          <RubricEditor
            mode="template"
            objective={editor.objective}
            items={editor.items}
            onObjectiveChange={(v) => setEditor({ ...editor, objective: v })}
            onItemsChange={(items) => setEditor({ ...editor, items })}
          />

          <div className="flex justify-end gap-3 mt-6">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={() => setEditor(null)}>
              Cancelar
            </button>
            <button className="btn-primary px-5 py-2 text-sm" disabled={!editor.name.trim()} onClick={save}>
              Guardar rúbrica
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Lista de plantillas ---
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-fg">Rúbricas</h2>
          <p className="text-sm text-fg-dim">Guiones reutilizables para preparar y conducir tus reuniones.</p>
        </div>
        <button className="btn-primary px-4 py-2 text-sm" onClick={() => setEditor({ ...empty, items: [] })}>
          + Nueva rúbrica
        </button>
      </div>

      {loading ? (
        <div className="text-center text-fg-dim py-16">Cargando...</div>
      ) : list.length === 0 ? (
        <div className="text-center text-fg-dim py-16">
          <div className="text-5xl mb-3">📋</div>
          Aún no tienes rúbricas.
          <br />
          Crea una con "+ Nueva rúbrica".
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <div key={t.id} className="surface rounded-2xl p-4 flex flex-col">
              <div className="font-semibold text-fg">{t.name}</div>
              {t.objective && <div className="text-sm text-fg-dim mt-1 line-clamp-2">{t.objective}</div>}
              <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-surface-soft text-fg-dim">
                  {RUBRIC_KIND_META.punto.icon} {t.itemCount} puntos
                </span>
                {projectName(t.projectId) && (
                  <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent">📁 {projectName(t.projectId)}</span>
                )}
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-line/15">
                <button className="btn-ghost px-3 py-1.5 text-xs flex-1" onClick={() => openEdit(t.id)}>
                  ✏️ Editar
                </button>
                <button className="text-fg-dim hover:text-red-400 px-2 text-sm" onClick={() => remove(t.id)}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
