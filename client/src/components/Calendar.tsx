import { useMemo, useRef, useState } from "react";
import { TYPE_META, MODALITY_META, type Task } from "../types";
import { MONTH_NAMES, monthGrid, dayKey, sameDay, eventCoversDay } from "../utils";

interface Props {
  tasks: Task[]; // ya filtradas por apartado/proyecto
  onSelectTask: (task: Task) => void;
  onScheduleAt: (date: Date) => void; // crear reunión en esa fecha+hora
  onReschedule: (task: Task, dueIso: string, endIso: string) => void; // mover/redimensionar
}

const WEEK_DAYS = ["L", "M", "X", "J", "V", "S", "D"];

const START_HOUR = 7;
const END_HOUR = 24; // exclusivo
const SLOT_MIN = 30; // granularidad de la rejilla
const PX_PER_MIN = 0.9; // altura: 30 min = 27px
const PAD_TOP = 10; // margen superior para que la primera etiqueta (07:00) no se corte
const dayStartMin = START_HOUR * 60;
const totalMin = (END_HOUR - START_HOUR) * 60;

// minutos desde medianoche de una fecha
const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

function fmtHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Drag =
  | { task: Task; mode: "move"; grabOffsetMin: number }
  | { task: Task; mode: "resize" }
  | null;

export default function Calendar({ tasks, onSelectTask, onScheduleAt, onReschedule }: Props) {
  const [refMonth, setRefMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const today = new Date();
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag>(null);
  // Posición temporal mientras se arrastra (minutos de inicio y fin).
  const [ghost, setGhost] = useState<{ start: number; end: number } | null>(null);

  const meetings = useMemo(() => tasks.filter((t) => t.type === "reunion" && t.due), [tasks]);
  const events = useMemo(() => tasks.filter((t) => t.type === "evento" && t.due), [tasks]);

  const markedDays = useMemo(() => {
    const set = new Set<string>();
    meetings.forEach((m) => set.add(dayKey(new Date(m.due!))));
    events.forEach((e) => {
      const start = new Date(e.due!);
      const end = e.endDate ? new Date(e.endDate) : start;
      const cur = new Date(start);
      while (dayKey(cur) <= dayKey(end)) {
        set.add(dayKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return set;
  }, [meetings, events]);

  const grid = monthGrid(refMonth);
  const dayMeetings = meetings.filter((m) => sameDay(new Date(m.due!), selected));
  const dayEvents = events.filter((e) => eventCoversDay(e.due!, e.endDate, selected));

  function changeMonth(delta: number) {
    setRefMonth(new Date(refMonth.getFullYear(), refMonth.getMonth() + delta, 1));
  }

  // Convierte la posición Y del puntero (px) a minutos absolutos del día, redondeado al slot.
  function yToMinutes(clientY: number): number {
    const rect = gridRef.current!.getBoundingClientRect();
    const y = clientY - rect.top - PAD_TOP;
    const raw = dayStartMin + y / PX_PER_MIN;
    const snapped = Math.round(raw / SLOT_MIN) * SLOT_MIN;
    return Math.max(dayStartMin, Math.min(snapped, END_HOUR * 60));
  }

  function meetingMinutes(m: Task) {
    const start = minutesOfDay(new Date(m.due!));
    const end = m.endDate ? minutesOfDay(new Date(m.endDate)) : start + SLOT_MIN;
    return { start, end };
  }

  // ---- Drag & resize ----
  function onPointerDownMove(e: React.PointerEvent, m: Task) {
    e.stopPropagation();
    const { start, end } = meetingMinutes(m);
    const grabAt = yToMinutes(e.clientY);
    setDrag({ task: m, mode: "move", grabOffsetMin: grabAt - start });
    setGhost({ start, end });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerDownResize(e: React.PointerEvent, m: Task) {
    e.stopPropagation();
    const { start, end } = meetingMinutes(m);
    setDrag({ task: m, mode: "resize" });
    setGhost({ start, end });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !ghost) return;
    const cursor = yToMinutes(e.clientY);
    if (drag.mode === "move") {
      const dur = ghost.end - ghost.start;
      let start = cursor - drag.grabOffsetMin;
      start = Math.max(dayStartMin, Math.min(start, END_HOUR * 60 - dur));
      setGhost({ start, end: start + dur });
    } else {
      const end = Math.max(ghost.start + SLOT_MIN, cursor);
      setGhost({ start: ghost.start, end });
    }
  }
  function onPointerUp() {
    if (drag && ghost) {
      const base = new Date(selected);
      const mk = (mins: number) => {
        const d = new Date(base);
        d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        return d.toISOString();
      };
      const orig = meetingMinutes(drag.task);
      if (ghost.start !== orig.start || ghost.end !== orig.end) {
        onReschedule(drag.task, mk(ghost.start), mk(ghost.end));
      }
    }
    setDrag(null);
    setGhost(null);
  }

  // Slots de fondo (líneas + clic para agendar)
  const slots: number[] = [];
  for (let mn = dayStartMin; mn < END_HOUR * 60; mn += SLOT_MIN) slots.push(mn);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
      {/* Mini-mes */}
      <div className="glass rounded-2xl p-4 h-fit">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-fg">
            {MONTH_NAMES[refMonth.getMonth()]} {refMonth.getFullYear()}
          </h3>
          <div className="flex gap-1">
            <button className="btn-ghost w-8 h-8 grid place-items-center" onClick={() => changeMonth(-1)}>‹</button>
            <button className="btn-ghost w-8 h-8 grid place-items-center" onClick={() => changeMonth(1)}>›</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEK_DAYS.map((d) => (
            <div key={d} className="text-center text-[11px] text-fg-dim font-medium py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.flat().map((day) => {
            const inMonth = day.getMonth() === refMonth.getMonth();
            const isSel = sameDay(day, selected);
            const isToday = sameDay(day, today);
            const marked = markedDays.has(dayKey(day));
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelected(new Date(day))}
                className={`relative aspect-square rounded-lg text-sm flex items-center justify-center transition
                  ${isSel ? "bg-accent text-on-accent font-semibold" : "hover:bg-surface-soft/70"}
                  ${!inMonth ? "text-fg-dim/40" : isToday && !isSel ? "text-accent font-bold" : "text-fg"}`}
              >
                {day.getDate()}
                {marked && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSel ? "bg-on-accent" : "bg-accent"}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Agenda del día */}
      <div className="glass rounded-2xl p-4">
        <h3 className="font-bold text-fg mb-1 capitalize">
          {selected.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
        </h3>
        <p className="text-xs text-fg-dim mb-3">
          {dayMeetings.length} reunión(es) · {dayEvents.length} evento(s)
          <span className="ml-2 opacity-70">· arrastra para mover, estira el borde para la duración</span>
        </p>

        {dayEvents.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {dayEvents.map((e) => (
              <button
                key={e.id}
                onClick={() => onSelectTask(e)}
                className="w-full text-left rounded-lg px-3 py-2 bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition"
              >
                {TYPE_META.evento.icon} {e.title}
                <span className="text-fg-dim font-normal"> · todo el día</span>
              </button>
            ))}
          </div>
        )}

        {/* Rejilla con posicionamiento absoluto */}
        <div className="flex max-h-[62vh] overflow-y-auto">
          {/* Columna de horas */}
          <div className="w-12 flex-shrink-0 relative" style={{ height: totalMin * PX_PER_MIN + PAD_TOP }}>
            {slots.filter((mn) => mn % 60 === 0).map((mn) => (
              <div
                key={mn}
                className="absolute text-xs text-fg-dim -translate-y-1/2"
                style={{ top: (mn - dayStartMin) * PX_PER_MIN + PAD_TOP }}
              >
                {fmtHM(mn)}
              </div>
            ))}
          </div>

          {/* Lienzo */}
          <div
            ref={gridRef}
            className="flex-1 relative border-l border-line/15"
            style={{ height: totalMin * PX_PER_MIN + PAD_TOP }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* Líneas de slot + zonas de clic para agendar */}
            {slots.map((mn) => (
              <div
                key={mn}
                className={`absolute left-0 right-0 ${mn % 60 === 0 ? "border-t border-line/15" : "border-t border-dashed border-line/10"} hover:bg-surface-soft/30 transition group`}
                style={{ top: (mn - dayStartMin) * PX_PER_MIN + PAD_TOP, height: SLOT_MIN * PX_PER_MIN }}
                onClick={() => {
                  const d = new Date(selected);
                  d.setHours(Math.floor(mn / 60), mn % 60, 0, 0);
                  onScheduleAt(d);
                }}
              >
                <span className="opacity-0 group-hover:opacity-100 text-[11px] text-fg-dim pl-2 transition pointer-events-none">
                  + Agendar
                </span>
              </div>
            ))}

            {/* Reuniones */}
            {dayMeetings.map((m) => {
              const isDragging = drag?.task.id === m.id;
              const mins = isDragging && ghost ? ghost : meetingMinutes(m);
              const top = (mins.start - dayStartMin) * PX_PER_MIN + PAD_TOP;
              const height = Math.max((mins.end - mins.start) * PX_PER_MIN, 20);
              return (
                <div
                  key={m.id}
                  className={`absolute left-1 right-2 rounded-lg bg-accent text-on-accent px-2 py-1 overflow-hidden shadow-md select-none ${
                    isDragging ? "opacity-90 ring-2 ring-on-accent/40 z-10 cursor-grabbing" : "cursor-grab"
                  }`}
                  style={{ top, height }}
                  onPointerDown={(e) => onPointerDownMove(e, m)}
                  onClick={(e) => {
                    // Si no hubo arrastre real, abrir para editar.
                    if (!ghost) onSelectTask(m);
                    e.stopPropagation();
                  }}
                >
                  <div className="text-xs font-semibold leading-tight truncate">
                    {TYPE_META.reunion.icon} {m.title}
                  </div>
                  <div className="text-[11px] opacity-85 leading-tight">
                    {fmtHM(mins.start)}–{fmtHM(mins.end)}
                    {m.modality && ` · ${MODALITY_META[m.modality].icon}`}
                  </div>
                  {/* Tirador de redimensionar */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize"
                    onPointerDown={(e) => onPointerDownResize(e, m)}
                  >
                    <div className="mx-auto w-8 h-0.5 bg-on-accent/50 rounded-full mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
