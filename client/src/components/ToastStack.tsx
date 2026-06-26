import { useEffect } from "react";
import { fmtTime } from "../utils";

export interface Toast {
  id: string;
  title: string;
  minutesLeft: number;
  due: string;
}

interface Props {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  onOpen: (id: string) => void;
}

// Color/urgencia según cuánto falta.
function tone(min: number) {
  if (min <= 5) return "border-red-500/60 bg-red-500/10";
  if (min <= 15) return "border-yellow-500/60 bg-yellow-500/10";
  return "border-accent/60 bg-accent/10";
}

function ToastItem({ toast, onDismiss, onOpen }: { toast: Toast; onDismiss: (id: string) => void; onOpen: (id: string) => void }) {
  // Se auto-descarta a los 25 segundos.
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 25000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`glass border ${tone(toast.minutesLeft)} rounded-2xl p-4 w-80 shadow-2xl animate-in cursor-pointer`}
      onClick={() => onOpen(toast.id)}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-fg text-sm">
            Quedan {toast.minutesLeft} minutos para la reunión
          </div>
          <div className="text-sm text-fg-dim truncate mt-0.5">👥 {toast.title}</div>
          <div className="text-xs text-fg-dim mt-1">🕐 Empieza a las {fmtTime(toast.due)}</div>
        </div>
        <button
          className="text-fg-dim hover:text-fg text-lg leading-none"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(toast.id);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function ToastStack({ toasts, onDismiss, onOpen }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-3">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} onOpen={onOpen} />
      ))}
    </div>
  );
}
