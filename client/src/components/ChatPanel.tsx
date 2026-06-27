import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  CATEGORY_META,
  TYPE_META,
  RUBRIC_KIND_META,
  type ChatMessage,
  type TaskInput,
  type Project,
} from "../types";
import { fmtDate } from "../utils";

interface Props {
  open: boolean;
  projects: Project[];
  onClose: () => void;
  onCreate: (draft: TaskInput) => Promise<void>;
  onEdit: (draft: TaskInput) => void;
}

const PRIO_LABEL: Record<string, string> = { urgente: "🔥 Urgente", alta: "Alta", media: "Media", baja: "Baja" };

// Tarjeta de borrador de tarea propuesto por la IA.
function DraftCard({
  draft,
  onConfirm,
  onEdit,
  created,
}: {
  draft: TaskInput;
  onConfirm: () => void;
  onEdit: () => void;
  created: boolean;
}) {
  return (
    <div className="surface rounded-xl p-3 mt-2 border border-accent/30">
      <div className="text-sm font-semibold text-fg">{draft.title}</div>
      <div className="flex flex-wrap gap-1.5 mt-2 text-[11px]">
        <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent">
          {CATEGORY_META[draft.category].icon} {CATEGORY_META[draft.category].label}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-surface-soft text-fg-dim">{PRIO_LABEL[draft.priority]}</span>
        {draft.type !== "tarea" && (
          <span className="px-1.5 py-0.5 rounded bg-surface-soft text-fg-dim">{TYPE_META[draft.type].label}</span>
        )}
        {draft.due && (
          <span className="px-1.5 py-0.5 rounded bg-surface-soft text-fg-dim">🗓 {fmtDate(draft.due)}</span>
        )}
        {draft.tags.map((t) => (
          <span key={t} className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400">#{t}</span>
        ))}
      </div>
      {draft.notes && <div className="text-xs text-fg-dim mt-2">📝 {draft.notes}</div>}

      {/* Rúbrica generada (orden del día) */}
      {draft.rubric && (draft.rubric.objective || draft.rubric.items.length > 0) && (
        <div className="mt-2 rounded-lg bg-surface-soft/60 p-2">
          <div className="text-[11px] font-semibold text-fg-dim mb-1">📋 Rúbrica</div>
          {draft.rubric.objective && (
            <div className="text-[11px] text-fg-dim mb-1">🎯 {draft.rubric.objective}</div>
          )}
          {draft.rubric.items.map((it, i) => (
            <div key={i} className="text-[11px] text-fg flex items-start gap-1">
              <span>{RUBRIC_KIND_META[it.kind].icon}</span>
              <span>{it.title}</span>
            </div>
          ))}
        </div>
      )}

      {created ? (
        <div className="text-xs text-green-400 mt-3 font-medium">✅ Tarea creada</div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button className="btn-primary px-3 py-1.5 text-xs flex-1" onClick={onConfirm}>
            ✓ Confirmar
          </button>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={onEdit}>
            ✏️ Editar
          </button>
        </div>
      )}
    </div>
  );
}

const SUGGESTIONS = [
  "Recordame llamar al cliente mañana, urgente",
  "Entregar el informe el viernes",
  "Estudiar para el examen la semana que viene",
];

export default function ChatPanel({ open, projects, onClose, onCreate, onEdit }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Ids (índice) de mensajes cuyo borrador ya fue creado.
  const [createdIdx, setCreatedIdx] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setLoading(true);

    // Último borrador propuesto que aún NO fue confirmado ni descartado: se manda
    // como contexto para que la IA lo edite en vez de crear uno nuevo.
    let pendingDraft: TaskInput | null = null;
    let pendingIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].draft) {
        if (!createdIdx.has(i)) {
          pendingDraft = messages[i].draft!;
          pendingIdx = i;
        }
        break;
      }
    }

    try {
      const res = await api.aiChat(
        history.map((m) => ({ role: m.role, content: m.content })),
        pendingDraft,
        projects.map((p) => ({ id: p.id, name: p.name, category: p.category }))
      );
      if (res.kind === "draft") {
        setMessages((prev) => [...prev, { role: "assistant", content: res.text, draft: res.draft }]);
      } else if (res.kind === "confirm") {
        // El usuario pidió confirmar: creamos el borrador pendiente automáticamente.
        if (pendingDraft && pendingIdx >= 0) {
          await onCreate(pendingDraft);
          setCreatedIdx((prev) => new Set(prev).add(pendingIdx));
          setMessages((prev) => [...prev, { role: "assistant", content: res.text }]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "No hay ningún borrador pendiente para confirmar." },
          ]);
        }
      } else if (res.kind === "cancel") {
        // Descartar el borrador pendiente (marcándolo como "ya resuelto").
        if (pendingIdx >= 0) setCreatedIdx((prev) => new Set(prev).add(pendingIdx));
        setMessages((prev) => [...prev, { role: "assistant", content: res.text }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: res.text }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Ups, hubo un problema al contactar con el asistente." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmDraft(idx: number, draft: TaskInput) {
    await onCreate(draft);
    setCreatedIdx((prev) => new Set(prev).add(idx));
  }

  // Limpia la conversación y vuelve al estado inicial.
  function reset() {
    setMessages([]);
    setCreatedIdx(new Set());
    setInput("");
    setLoading(false);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-[55] transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />
      {/* Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md glass border-l border-line/30 z-[56] flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-line/30">
          <h2 className="font-bold text-fg flex items-center gap-2">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-2 text-on-accent">
              🤖
            </span>
            Asistente
          </h2>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                className="btn-ghost h-8 px-2.5 grid place-items-center text-xs"
                title="Nueva conversación"
                onClick={reset}
              >
                🗑 Limpiar
              </button>
            )}
            <button
              className="btn-ghost w-8 h-8 grid place-items-center"
              title="Cerrar"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </header>

        {/* Mensajes */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-fg-dim py-8">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm mb-4">
                Decime qué querés anotar y te armo la tarea.
                <br />
                Probá con:
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="btn-ghost text-xs px-3 py-2 text-left"
                    onClick={() => send(s)}
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={m.role === "user" ? "max-w-[85%]" : "max-w-[90%]"}>
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-accent text-on-accent rounded-br-sm"
                      : "bg-surface-soft text-fg rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
                {m.draft && (
                  <DraftCard
                    draft={m.draft}
                    created={createdIdx.has(i)}
                    onConfirm={() => confirmDraft(i, m.draft!)}
                    onEdit={() => onEdit(m.draft!)}
                  />
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-soft text-fg-dim rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm">
                Pensando…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-line/30 flex gap-2">
          <input
            className="field-input flex-1"
            placeholder="Escribe un mensaje…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            disabled={loading}
          />
          <button
            className="btn-primary px-4 py-2 text-sm"
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
          >
            ➤
          </button>
        </div>
      </aside>
    </>
  );
}
