import { useEffect, useState } from "react";
import { api } from "../api";
import {
  CATEGORY_META,
  RUBRIC_KIND_META,
  type Project,
  type RubricTemplate,
  type MinuteInput,
  type RubricItemInput,
} from "../types";
import { toDateInput, fromDateInput, fmtDate } from "../utils";
import RubricEditor from "./RubricEditor";
import { useConfirm } from "../confirm";
import { downloadActaPdf } from "../actaPdf";

interface Props {
  projects: Project[];
  onChanged: () => void; // recarga global
}

type EditorState = {
  id: string | null; // null = nueva
  name: string;
  objective: string;
  meetingDate: string; // valor de <input type="date"> (YYYY-MM-DD) o ""
  people: string;
  projectId: string | null;
  items: RubricItemInput[];
};

const empty: EditorState = {
  id: null,
  name: "",
  objective: "",
  meetingDate: "",
  people: "",
  projectId: null,
  items: [],
};

// Gestor de actas de reunión (sección de la barra lateral). Las actas son
// entidades independientes: nombre, fecha, personas involucradas y puntos.
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
      meetingDate: toDateInput(full.meetingDate),
      people: full.people ?? "",
      projectId: full.projectId,
      // Normalizamos: las actas creadas por IA pueden traer items sin notes/responsible/done.
      items: full.items.map((it) => ({
        title: it.title ?? "",
        kind: it.kind ?? "punto",
        done: it.done ?? false,
        notes: it.notes ?? "",
        responsible: it.responsible ?? "",
      })),
    });
  }

  async function save() {
    if (!editor || !editor.name.trim()) return;
    const payload: MinuteInput = {
      name: editor.name.trim(),
      objective: editor.objective,
      meetingDate: fromDateInput(editor.meetingDate),
      people: editor.people,
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
      title: "Eliminar acta",
      message: "¿Eliminar esta acta? Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      danger: true,
    });
    if (!ok) return;
    await api.removeRubric(id);
    await reload();
    onChanged();
  }

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? null;

  // Descarga el acta como PDF. Desde la lista hay que traer el acta completa (con puntos).
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  async function downloadFromList(id: string) {
    setDownloadingId(id);
    try {
      const full = await api.getRubric(id);
      downloadActaPdf(full, projectName(full.projectId));
    } catch (err) {
      console.error("[acta-pdf] no se pudo preparar el acta:", err);
      alert("No se pudo generar el PDF del acta. Revisa la consola (F12) para más detalle.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Descarga el acta que se está editando, usando los datos actuales del formulario
  // (incluye cambios aún no guardados).
  function downloadFromEditor() {
    if (!editor) return;
    downloadActaPdf(
      {
        id: editor.id ?? "draft",
        name: editor.name.trim(),
        objective: editor.objective,
        meetingDate: fromDateInput(editor.meetingDate),
        people: editor.people,
        projectId: editor.projectId,
        items: editor.items
          .filter((it) => it.title.trim())
          .map((it, i) => ({ ...it, id: `${i}`, order: i })),
      },
      projectName(editor.projectId)
    );
  }

  // Cuenta de personas involucradas (líneas no vacías).
  const countPeople = (people: string) => people.split(/\n/).map((s) => s.trim()).filter(Boolean).length;

  // --- Vista editor ---
  if (editor) {
    return (
      <div className="max-w-2xl">
        <button className="text-sm text-fg-dim hover:text-fg mb-4" onClick={() => setEditor(null)}>
          ‹ Volver a las actas
        </button>
        <div className="glass rounded-2xl p-5">
          <h2 className="text-lg font-bold text-fg mb-4 flex items-center gap-2">
            <span className="text-accent">📝</span>
            {editor.id ? "Editar acta" : "Nueva acta"}
          </h2>

          <label className="block text-xs text-fg-dim mb-1">Nombre del acta *</label>
          <input
            className="field-input mb-4"
            value={editor.name}
            onChange={(e) => setEditor({ ...editor, name: e.target.value })}
            placeholder="ej: Daily 30 jun, Revisión de sprint..."
          />

          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-fg-dim mb-1">📅 Fecha de la reunión</label>
              <input
                type="date"
                className="field-input"
                value={editor.meetingDate}
                onChange={(e) => setEditor({ ...editor, meetingDate: e.target.value })}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-fg-dim mb-1">Proyecto (opcional)</label>
              <select
                className="field-input cursor-pointer"
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
            </div>
          </div>

          <label className="block text-xs text-fg-dim mb-1">👥 Personas involucradas (una por línea)</label>
          <textarea
            className="field-input mb-4 resize-y"
            rows={3}
            value={editor.people}
            onChange={(e) => setEditor({ ...editor, people: e.target.value })}
            placeholder={"ej:\nMauricio (PM)\nAna (Frontend)\nCarlos (Backend)"}
          />

          <RubricEditor
            mode="template"
            objective={editor.objective}
            items={editor.items}
            onObjectiveChange={(v) => setEditor({ ...editor, objective: v })}
            onItemsChange={(items) => setEditor({ ...editor, items })}
          />

          <div className="flex justify-end gap-3 mt-6 flex-wrap">
            <button
              className="btn-ghost px-4 py-2 text-sm disabled:opacity-50"
              title="Descargar el acta en PDF (con los datos actuales del formulario)"
              disabled={!editor.name.trim()}
              onClick={downloadFromEditor}
            >
              ⬇ Descargar PDF
            </button>
            <button className="btn-ghost px-4 py-2 text-sm" onClick={() => setEditor(null)}>
              Cancelar
            </button>
            <button className="btn-primary px-5 py-2 text-sm" disabled={!editor.name.trim()} onClick={save}>
              Guardar acta
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Lista de actas ---
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-fg">Actas</h2>
          <p className="text-sm text-fg-dim">Registro de tus reuniones: fecha, asistentes y puntos tratados.</p>
        </div>
        <button className="btn-primary px-4 py-2 text-sm" onClick={() => setEditor({ ...empty, items: [] })}>
          + Nueva acta
        </button>
      </div>

      {loading ? (
        <div className="text-center text-fg-dim py-16">Cargando...</div>
      ) : list.length === 0 ? (
        <div className="text-center text-fg-dim py-16">
          <div className="text-5xl mb-3">📝</div>
          Aún no tienes actas.
          <br />
          Crea una con "+ Nueva acta".
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => {
            const people = countPeople(t.people);
            return (
              <div key={t.id} className="surface rounded-2xl p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-fg">{t.name}</div>
                  {t.meetingDate && (
                    <span className="text-[11px] text-fg-dim whitespace-nowrap mt-0.5">
                      📅 {fmtDate(t.meetingDate)}
                    </span>
                  )}
                </div>
                {t.objective && <div className="text-sm text-fg-dim mt-1 line-clamp-2">{t.objective}</div>}
                <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-surface-soft text-fg-dim">
                    {RUBRIC_KIND_META.punto.icon} {t.itemCount} puntos
                  </span>
                  {people > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-surface-soft text-fg-dim">
                      👥 {people} {people === 1 ? "persona" : "personas"}
                    </span>
                  )}
                  {projectName(t.projectId) && (
                    <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent">📁 {projectName(t.projectId)}</span>
                  )}
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-line/15">
                  <button className="btn-ghost px-3 py-1.5 text-xs flex-1" onClick={() => openEdit(t.id)}>
                    ✏️ Editar
                  </button>
                  <button
                    className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-50"
                    title="Descargar acta en PDF"
                    disabled={downloadingId === t.id}
                    onClick={() => downloadFromList(t.id)}
                  >
                    {downloadingId === t.id ? "…" : "⬇ PDF"}
                  </button>
                  <button className="text-fg-dim hover:text-red-400 px-2 text-sm" onClick={() => remove(t.id)}>
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
