export type OwnerId = 'carla' | 'fernanda' | 'luiz' | 'alessandra' | 'nicola' | 'none';
export type Mode = 'carla' | 'barbara';
export type Priority = 'High' | 'Medium' | 'Low';
export type Review = 'Pending review' | 'Approved' | 'Changes requested' | 'Barbara to handle';
export type Screen = 'today' | 'week' | 'owner' | 'people' | 'review' | 'focus' | 'done';

/** One Smart Inbox item — mirrors the relay's GET /smart-inbox shape (see sync-spec.md). */
export interface Task {
  id: string;
  action: string;
  subject: string;
  from: string;
  owner: OwnerId;
  priority: Priority | null;
  category: string;
  review: Review | null;
  summary: string;
  draft: string | null;
  limitation?: string | null;
  feedback: string | null;
  gmail: string | null;
  /** ISO date (YYYY-MM-DD…) or null */
  due: string | null;
  /** HH:MM, optional */
  time?: string | null;
  completed: boolean;
  /** Local-only manual order set by drag-to-reorder */
  _rank?: number;
}

export interface Person {
  id: OwnerId;
  name: string;
  short: string;
  initial: string;
  bg: string;
  keys: string[];
}

export type TaskPatch = Partial<Pick<Task, 'completed' | 'due' | 'time' | 'review' | 'feedback' | 'draft' | 'owner' | 'priority'>>;

export type RelayOp =
  | { kind: 'update'; id: string; patch: TaskPatch }
  | { kind: 'create'; id: string; action: string; owner: OwnerId; due: string | null; priority: Priority | null };

export interface Settings {
  dataUrl: string;
  relayUrl: string;
  relayKey: string;
  headerAura: boolean;
}

export interface Snapshot {
  fetchedAt?: string;
  items: Task[];
}
