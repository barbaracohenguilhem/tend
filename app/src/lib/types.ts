export type OwnerId = 'carla' | 'fernanda' | 'luiz' | 'alessandra' | 'nicola' | 'none';
export type Mode = 'carla' | 'barbara';
export type Priority = 'High' | 'Medium' | 'Low';
export type Review = 'Pending review' | 'Approved' | 'Changes requested' | 'Barbara to handle';
export type Screen = 'home' | 'today' | 'board' | 'calendar' | 'week' | 'owner' | 'people' | 'review' | 'focus' | 'done';

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
  /** Sender's email address, when Notion captured it */
  senderEmail?: string | null;
  /** The original email carried attachments (Notion "Has attachments") */
  hasAttachments?: boolean;
  /** Who closed the item: Carla did it herself, or Barbara executed it */
  resolvedBy?: 'Carla' | 'Barbara' | null;
  project?: string | null;
  /** What Carla is asked to hand in (documents, files…) */
  deliverable?: string | null;
  files?: Attachment[];
  voiceNotes?: Attachment[];
  /** ISO date (YYYY-MM-DD…) or null */
  due: string | null;
  /** HH:MM, optional */
  time?: string | null;
  completed: boolean;
  /** Local-only manual order set by drag-to-reorder */
  _rank?: number;
}

export interface Attachment { name: string; url: string; expires?: string | null }

export interface Comment { id: string; author: string; text: string; at: string; audio?: Attachment | null }

export type Role = 'carla' | 'barbara' | 'team';

export interface Person {
  id: OwnerId;
  name: string;
  short: string;
  initial: string;
  bg: string;
  keys: string[];
}

export type TaskPatch = Partial<Pick<Task, 'completed' | 'due' | 'time' | 'review' | 'feedback' | 'draft' | 'owner' | 'priority' | 'resolvedBy' | 'project'>>;

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
