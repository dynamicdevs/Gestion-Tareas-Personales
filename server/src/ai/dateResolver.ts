// Resuelve expresiones temporales en español a una fecha ISO (mediodía local
// para evitar saltos de zona horaria), usando `now` como referencia.
// Cubre los casos comunes; si no reconoce nada, devuelve null.

const DAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

const MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11,
};

function atNoon(d: Date): string {
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// Combina una fecha ISO ya resuelta con una hora "HH:mm" (hora local).
export function applyTimeToISO(iso: string, time: string | null | undefined): string {
  if (!time) return iso;
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return iso;
  const d = new Date(iso);
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d.toISOString();
}

export function resolvePhraseToISO(phrase: string | null | undefined, now: Date = new Date()): string | null {
  if (!phrase) return null;
  const p = phrase
    .toLowerCase()
    .normalize("NFC")
    .trim();
  if (!p) return null;

  // Hoy / esta tarde / esta noche
  if (/\bhoy\b|\besta (tarde|noche|mañana)\b/.test(p)) return atNoon(new Date(now));

  // Pasado mañana (antes que "mañana" para no colisionar)
  if (/\bpasado\s*mañana\b/.test(p)) return atNoon(addDays(now, 2));

  // Mañana
  if (/\bmañana\b/.test(p)) return atNoon(addDays(now, 1));

  // "en N días" / "dentro de N días"
  const inDays = p.match(/\b(?:en|dentro de)\s+(\d+)\s*d[ií]as?\b/);
  if (inDays) return atNoon(addDays(now, parseInt(inDays[1], 10)));

  // "en una semana" / "en N semanas"
  const inWeeks = p.match(/\b(?:en|dentro de)\s+(\d+|una)\s*semanas?\b/);
  if (inWeeks) {
    const n = inWeeks[1] === "una" ? 1 : parseInt(inWeeks[1], 10);
    return atNoon(addDays(now, n * 7));
  }

  // Día + mes con nombre ("4 de julio", "el 29 de junio", "30 junio").
  // Si la fecha ya pasó este año, se asume el año siguiente.
  const dayMonth = p.match(/\b(\d{1,2})\s*(?:de\s+)?([a-zé]+)\b/);
  if (dayMonth) {
    const target = parseInt(dayMonth[1], 10);
    const month = MONTHS[dayMonth[2]];
    if (target >= 1 && target <= 31 && month !== undefined) {
      const d = new Date(now);
      d.setMonth(month, target);
      if (d < now && Math.abs(d.getTime() - now.getTime()) > 24 * 60 * 60 * 1000) {
        d.setFullYear(d.getFullYear() + 1);
      }
      return atNoon(d);
    }
  }

  // Día del mes con número ("el 29", "el lunes 29", "el día 29").
  // Si el día ya pasó este mes, se asume el mes siguiente.
  const dayNum = p.match(/\bel\s+(?:[a-zé]+\s+)?(\d{1,2})\b(?!\s*:)/);
  if (dayNum) {
    const target = parseInt(dayNum[1], 10);
    if (target >= 1 && target <= 31) {
      const d = new Date(now);
      d.setDate(target);
      if (d < now && d.getDate() !== now.getDate()) d.setMonth(d.getMonth() + 1);
      return atNoon(d);
    }
  }

  // Día de la semana ("el viernes", "viernes que viene", "próximo lunes")
  for (const [name, dow] of Object.entries(DAYS)) {
    if (new RegExp(`\\b${name}\\b`).test(p)) {
      const cur = now.getDay();
      let diff = (dow - cur + 7) % 7;
      // Si es hoy mismo o se pide "que viene/próximo", saltamos a la próxima semana.
      if (diff === 0 || /\b(que viene|pr[oó]xim[oa]|siguiente)\b/.test(p)) {
        diff = diff === 0 ? 7 : diff;
      }
      return atNoon(addDays(now, diff));
    }
  }

  return null;
}
