import { dayOffset } from './dates';
import type { Task } from './types';

export const prioRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

/** Priority (High → Low → none), then due date ascending, undated last. Manual ranks win when both rows have one. */
export function sortTasks(a: Task, b: Task): number {
  if (a._rank !== undefined && b._rank !== undefined) return a._rank - b._rank;
  const pa = prioRank[a.priority ?? ''] ?? 3, pb = prioRank[b.priority ?? ''] ?? 3;
  if (pa !== pb) return pa - pb;
  const oa = dayOffset(a), ob = dayOffset(b);
  if (oa === null && ob === null) return 0;
  if (oa === null) return 1;
  if (ob === null) return -1;
  return oa - ob;
}

export function cycleIn<T>(list: readonly T[], cur: T): T {
  const i = list.indexOf(cur);
  return list[(i + 1) % list.length];
}
