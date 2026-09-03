import type { Task } from './types';

const LIGHT_CATEGORIES = ['System / Notification', 'Newsletter / Information', 'Spam / Promotion'];
const CHECK_WORDS = /\b(verif|confirm(ar|e|ação)?\b(?! (a|o|the) (compra|pagamento|purchase|payment))|check|login|senha|password|2fa|dispositivo|device|c[oó]digo|code|unsubscribe|newsletter)/i;

export type Weight = 'key' | 'light';

/** Decision vs. quick check. LOLI's priority and category come first; the wording of the action is the tie-breaker. */
export function weightOf(t: Task): Weight {
  if (t.teamReview === 'Requested') return 'key';
  if (t.priority === 'High') return 'key';
  if (LIGHT_CATEGORIES.includes(t.category)) return 'light';
  if (t.priority === 'Low') return 'light';
  if (!t.priority && CHECK_WORDS.test(t.action)) return 'light';
  if (t.priority === 'Medium' && t.category === 'Action required' && CHECK_WORDS.test(t.action) && !t.draft) return 'light';
  return 'key';
}

export function isBlocked(t: Task, all: Task[]): boolean {
  if (t.waitingOn) return true;
  return (t.dependsOn || []).some(id => { const d = all.find(x => x.id === id); return d ? !d.completed : false; });
}
