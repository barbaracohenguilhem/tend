import type { Task } from './types';

/** A prepared response with no decision yet. Requested changes wait for a new proposal. */
export const isPendingDraft = (task: Task): boolean =>
  !task.completed && !!task.draft?.trim() && (task.review === 'Pending review' || task.review === null);
