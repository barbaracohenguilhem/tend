import type { Task } from './types';

export const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(n: number, base: Date = today()): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Day offset of a task's due date from today; null when undated. */
export function dayOffset(t: Pick<Task, 'due'>, base: Date = today()): number | null {
  if (!t.due) return null;
  const d = new Date(t.due.slice(0, 10) + 'T00:00:00');
  return Math.round((d.getTime() - base.getTime()) / 86400000);
}

export function dueLabel(t: Pick<Task, 'due' | 'time'>, base: Date = today()): string {
  const d = dayOffset(t, base);
  let s: string;
  if (d === null) s = 'No date';
  else if (d === 0) s = 'Today';
  else if (d === 1) s = 'Tomorrow';
  else if (d === -1) s = 'Yesterday';
  else if (d < -1) s = `${-d} days ago`;
  else if (d < 7) s = dayNames[addDays(d, base).getDay()];
  else {
    const dt = addDays(d, base);
    s = `${dt.getDate()} ${monthNames[dt.getMonth()].slice(0, 3)}`;
  }
  return t.time ? `${s}, ${t.time}` : s;
}

export function dateLine(base: Date = today()): string {
  return `${dayNames[base.getDay()]}, ${base.getDate()} ${monthNames[base.getMonth()]}`;
}

/** Monday-based offset of today within its week (0 = Monday). */
export function weekdayOffset(base: Date = today()): number {
  return (base.getDay() + 6) % 7;
}

export function weekRange(base: Date = today()): string {
  const off = weekdayOffset(base);
  const mon = addDays(-off, base), sun = addDays(6 - off, base);
  return mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${monthNames[mon.getMonth()]}`
    : `${mon.getDate()} ${monthNames[mon.getMonth()]} – ${sun.getDate()} ${monthNames[sun.getMonth()]}`;
}
