export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const SNOOZE_MINUTES = 10;

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad = (n: number) => String(n).padStart(2, '0');

const FULL_WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const FULL_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Ej.: "sábado 31 de octubre". */
export function formatLongDate(ms: number): string {
  const d = new Date(ms);
  return `${FULL_WEEKDAYS[d.getDay()]} ${d.getDate()} de ${FULL_MONTHS[d.getMonth()]}`;
}

/** Ej.: "31 oct 2026". */
export function formatShortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Inicio del día local de `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + DAY);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return `hoy ${formatTime(ms)}`;
  if (sameDay(d, tomorrow)) return `mañana ${formatTime(ms)}`;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${formatTime(ms)}`;
}

export function formatInterval(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** Horarios de toma: desde `startAt`, cada `intervalMinutes`, durante `days` días. */
export function buildSchedule(startAt: number, intervalMinutes: number, days: number): number[] {
  const end = startAt + days * DAY;
  const step = intervalMinutes * MINUTE;
  const slots: number[] = [];
  for (let t = startAt; t < end; t += step) slots.push(t);
  return slots;
}
