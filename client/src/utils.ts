// Días desde hoy hasta una fecha ISO (negativo = pasado). null si no hay fecha.
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

// Fecha + hora (ej: "26 jun, 15:30")
export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Solo la hora (ej: "15:30")
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

// Rango horario de una reunión (ej: "26 jun, 15:30 – 16:00")
export function fmtMeetingRange(dueIso: string, endIso: string | null): string {
  const base = fmtDateTime(dueIso);
  return endIso ? `${base} – ${fmtTime(endIso)}` : base;
}

// Convierte ISO a valor de <input type="datetime-local"> (YYYY-MM-DDTHH:mm) en hora local.
export function toDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

// Convierte el valor de <input type="datetime-local"> a ISO.
export function fromDateTimeInput(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

// Hora local "HH:mm" desde un ISO (para <input type="time">).
export function toTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Compone un ISO desde fecha (YYYY-MM-DD) + hora (HH:mm) en hora local.
export function combineDateTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

// Suma minutos a una hora "HH:mm" y devuelve "HH:mm" (acota a 23:59).
export function addMinutesToTime(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  let total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Convierte una fecha ISO a valor para <input type="date"> (YYYY-MM-DD).
export function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

// Convierte el valor de <input type="date"> a ISO (mediodía para evitar saltos de zona horaria).
export function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(value + "T12:00:00").toISOString();
}

// ---- Helpers de calendario ----

// Clave de día local YYYY-MM-DD (sin desfase de zona horaria).
export function dayKey(d: Date): string {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

// Matriz de 6 semanas (semana empieza en lunes) que cubre el mes de `ref`.
export function monthGrid(ref: Date): Date[][] {
  const first = new Date(ref.getFullYear(), ref.getMonth(), 1);
  // getDay(): 0=domingo..6=sábado -> queremos lunes=0
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  const weeks: Date[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// ¿La fecha `day` cae dentro del rango de un evento [due, endDate]?
export function eventCoversDay(dueIso: string, endIso: string | null, day: Date): boolean {
  const start = new Date(dueIso);
  const end = endIso ? new Date(endIso) : start;
  const k = dayKey(day);
  return k >= dayKey(start) && k <= dayKey(end);
}

export function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
