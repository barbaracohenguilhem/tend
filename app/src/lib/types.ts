export type OwnerId = 'carla' | 'fernanda' | 'luiz' | 'alessandra' | 'nicola' | 'eugenia' | 'francesca' | 'yevgeniy' | 'none';
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
  /** Raw Owner text from Notion — shows people outside the team. */
  ownerName?: string | null;
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
  /** A team member asked Carla to confirm something about this task */
  teamReview?: 'Requested' | 'Approved' | 'Rejected' | null;
  reviewRequest?: string | null;
  reviewReply?: string | null;
  requestedBy?: string | null;
  /** Free-text external dependency ("Fulana's answer about the flight") */
  waitingOn?: string | null;
  parentId?: string | null;
  subtaskIds?: string[];
  dependsOn?: string[];
  blocks?: string[];
  /** ISO date (YYYY-MM-DD…) or null */
  due: string | null;
  /** HH:MM, optional */
  time?: string | null;
  /** Full datetime with offset as stored in Notion, when the due date has a time; due/time above are derived from it in local time */
  dueAt?: string | null;
  completed: boolean;
  /** Local-only manual order set by drag-to-reorder */
  _rank?: number;
}

export interface Attachment { name: string; url: string; expires?: string | null }

export interface Comment { id: string; author: string; text: string; at: string; audio?: Attachment | null; file?: Attachment | null }

export type Role = 'carla' | 'barbara' | 'team';

export interface Person {
  id: OwnerId;
  name: string;
  short: string;
  initial: string;
  bg: string;
  keys: string[];
}

export type TaskPatch = Partial<Pick<Task, 'completed' | 'due' | 'time' | 'review' | 'feedback' | 'draft' | 'owner' | 'priority' | 'resolvedBy' | 'project' | 'category' | 'teamReview' | 'reviewRequest' | 'reviewReply' | 'requestedBy' | 'waitingOn' | 'parentId' | 'dependsOn'>>;

export type RelayOp =
  | { kind: 'update'; id: string; patch: TaskPatch }
  | { kind: 'create'; id: string; action: string; owner: OwnerId; due: string | null; time?: string | null; priority: Priority | null; ownerName?: string | null; parentId?: string | null; from?: string | null; project?: string | null; category?: string | null }
  | { kind: 'comment'; id: string; text: string; author: string }
  | { kind: 'archive'; id: string };

/** Select options from the Notion schema (GET /smart-inbox/meta). */
export interface Meta { projects: string[]; categories: string[] }

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
