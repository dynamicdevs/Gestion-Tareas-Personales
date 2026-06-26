import { useEffect, useRef } from "react";
import type { Task } from "./types";

// Hitos de aviso (minutos antes de la reunión).
const MILESTONES = [30, 15, 5] as const;

export interface ReminderEvent {
  id: string; // único: taskId + hito
  taskId: string;
  title: string;
  minutesLeft: number; // 30 | 15 | 5
  due: string;
}

// Vigila las reuniones y llama a onRemind cuando faltan 30, 15 o 5 minutos.
// Cada hito se dispara una sola vez por reunión (mientras la pestaña esté abierta).
export function useMeetingReminders(tasks: Task[], onRemind: (e: ReminderEvent) => void) {
  // Claves ya avisadas ("taskId:30"), persistentes durante la sesión.
  const firedRef = useRef<Set<string>>(new Set());
  // Mantenemos onRemind fresco sin reiniciar el intervalo.
  const cbRef = useRef(onRemind);
  cbRef.current = onRemind;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    function check() {
      const now = Date.now();
      for (const t of tasksRef.current) {
        if (t.type !== "reunion" || !t.due || t.state === "hecha") continue;
        const start = new Date(t.due).getTime();
        const minsLeft = (start - now) / 60000;
        if (minsLeft < 0) continue; // ya empezó/pasó

        for (const m of MILESTONES) {
          // Ventana: entre m y m-1 minutos antes -> dispara el hito m.
          if (minsLeft <= m && minsLeft > m - 1) {
            const key = `${t.id}:${m}`;
            if (!firedRef.current.has(key)) {
              firedRef.current.add(key);
              cbRef.current({
                id: key,
                taskId: t.id,
                title: t.title,
                minutesLeft: m,
                due: t.due,
              });
            }
          }
        }
      }
    }

    check(); // comprobación inmediata al montar
    const interval = setInterval(check, 20000); // cada 20s
    return () => clearInterval(interval);
  }, []);
}
