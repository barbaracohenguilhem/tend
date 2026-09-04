import { taskTitle } from '../lib/title';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { TaskTags } from '../components/TaskTags';
import { dateLine } from '../lib/dates';
import { person } from '../lib/people';
import { sortTasks } from '../lib/sort';
import type { OwnerId, Role, Task } from '../lib/types';
import { weightOf } from '../lib/weight';

interface Section { key: string; title: string; hint?: string; rows: Task[]; struck?: boolean; light?: boolean; empty: string }

interface Props {
  role: Role;
  name: string;
  myOwner: OwnerId | null;
  tasks: Task[];
  loading?: boolean;
  /** Last fetch failed: shown as a banner so an outage is never mistaken for an empty inbox. */
  error?: string | null;
  onRetry?: () => void;
  pendingCount?: number;
  onOpen: (id: string) => void;
  onSeeAll: (() => void) | null;
  onSettings: () => void;
}

/** Waiting for Carla: a proposal with no decision yet ('Changes requested' is waiting on LOLI's rewrite). */
const isPendingDraft = (t: Task) => !!t.draft && !t.completed && (t.review === 'Pending review' || t.review === null);
const needsDelivery = (t: Task) => !!t.deliverable && !t.completed && !(t.files && t.files.length);
const isHandedOff = (t: Task) => t.review === 'Approved' || t.review === 'Barbara to handle';
const split = (rows: Task[]) => ({ key: rows.filter(t => weightOf(t) === 'key'), light: rows.filter(t => weightOf(t) === 'light') });

/** Role-specific front page: decisions first, quick checks last, nothing that is not this person's. */
export function HomeScreen({ role, name, myOwner, tasks, loading, error, onRetry, pendingCount, onOpen, onSeeAll, onSettings }: Props) {
  let title = 'For you.'; let sections: Section[] = [];
  const open = tasks.filter(t => !t.completed);
  if (role === 'carla') {
    const mine = open.filter(t => t.owner === 'carla');
    const asks = open.filter(t => t.teamReview === 'Requested').sort(sortTasks);
    // LOLI marks every proposal "Pending review" whoever the task belongs to — the decision is always Carla's — but her own
    // tasks come first: the team's proposals get their own section further down.
    const decide = mine.filter(t => isPendingDraft(t) && t.teamReview !== 'Requested').sort(sortTasks);
    const team = open.filter(t => t.owner !== 'carla' && isPendingDraft(t) && t.teamReview !== 'Requested').sort(sortTasks);
    const deliver = mine.filter(t => needsDelivery(t) && !isPendingDraft(t)).sort(sortTasks);
    const rest = mine.filter(t => !isPendingDraft(t) && !needsDelivery(t) && t.review !== 'Changes requested' && t.teamReview !== 'Requested').sort(sortTasks);
    const restSplit = split(rest); const decideSplit = split(decide);
    const waiting = mine.filter(t => t.review === 'Changes requested').sort(sortTasks);
    sections = [
      { key: 'asks', title: 'Your team asks', hint: 'Someone wants your go-ahead before acting', rows: asks, empty: '' },
      { key: 'decide', title: 'To decide', hint: 'Proposed responses for your own tasks, waiting for your approval', rows: decideSplit.key, empty: 'Nothing to decide.' },
      { key: 'deliver', title: 'To deliver', hint: 'Documents or files someone needs from you', rows: deliver, empty: '' },
      { key: 'mine', title: 'Also in your name', rows: restSplit.key, empty: 'Nothing else in your name.' },
      { key: 'waiting', title: 'Sent back — being rewritten', hint: 'You rejected these; a new proposal will show up in "To decide"', rows: waiting, empty: '' },
      { key: 'team', title: 'Team proposals', hint: 'Proposed responses for the team\'s tasks — they wait for your approval too', rows: team, empty: '' },
      { key: 'light', title: 'Quick checks', hint: 'Low-stakes confirmations. Glance, tap done.', rows: [...decideSplit.light, ...restSplit.light], light: true, empty: '' },
    ];
  } else if (role === 'barbara') {
    title = 'Reviewed by Carla.';
    const approved = open.filter(t => t.review === 'Approved').sort(sortTasks);
    const handed = open.filter(t => t.review === 'Barbara to handle').sort(sortTasks);
    const rejected = open.filter(t => t.review === 'Changes requested').sort(sortTasks);
    const resolved = tasks.filter(t => t.completed && t.resolvedBy === 'Carla').sort(sortTasks);
    const asks = open.filter(t => t.teamReview === 'Requested').sort(sortTasks);
    const unassigned = open.filter(t => t.owner === 'none' && !isHandedOff(t) && t.review !== 'Changes requested').sort(sortTasks);
    sections = [
      { key: 'approved', title: 'Approved — for you to do', hint: 'Send the response as proposed, or handle what was approved', rows: approved, empty: 'Nothing approved yet.' },
      { key: 'handed', title: 'Handed to you', rows: handed, empty: '' },
      { key: 'rejected', title: 'Rejected — with her reason', hint: 'Open the task to read or listen to why', rows: rejected, empty: 'Nothing rejected.' },
      { key: 'unassigned', title: 'Needs an owner', hint: 'LOLI could not tell whose these are — open one and forward it', rows: unassigned, empty: '' },
      { key: 'asks', title: 'Team waiting on Carla', rows: asks, light: true, empty: '' },
      { key: 'resolved', title: 'She did it herself', rows: resolved, struck: true, empty: '' },
    ];
  } else {
    title = 'Yours.';
    const mine = myOwner ? open.filter(t => t.owner === myOwner).sort(sortTasks) : [];
    const s = split(mine);
    sections = [
      { key: 'mine', title: myOwner ? 'In your name' : 'Your tasks', rows: s.key, empty: myOwner ? 'Nothing in your name right now.' : 'We could not match your address to a team member yet. Ask Barbara to add you.' },
      { key: 'light', title: 'Quick checks', rows: s.light, light: true, empty: '' },
    ];
  }
  sections = sections.filter(s => s.rows.length > 0 || s.empty);
  const total = sections.reduce((n, s) => n + (s.struck || s.light ? 0 : s.rows.length), 0);

  return (
    <div className="page scroll">
      <Logo onClick={onSettings} />
      <h1 className="h1">{title}</h1>
      <div className="subline">{dateLine()} · {name} · {total} waiting{pendingCount ? ` · ${pendingCount} to sync` : ''}</div>
      {error && !loading && (
        <div className="banner banner-error" role="alert">
          <div><b>Can't reach the Smart Inbox.</b> {error}</div>
          {onRetry && <div className="btn btn-white btn-sm" onClick={onRetry}>Retry</div>}
        </div>
      )}
      {sections.map(s => (
        <div key={s.key} className={`home-section${s.light ? ' is-light' : ''}`}>
          <div className="eyebrow section-label">{s.title}{s.rows.length ? ` · ${s.rows.length}` : ''}</div>
          {s.hint && s.rows.length > 0 && <div className="home-hint">{s.hint}</div>}
          {s.rows.length === 0 && <div className="home-empty">{s.empty}</div>}
          <div className="rows">
            {s.rows.map(t => {
              const o = person(t.owner);
              return (
                <div key={t.id} className={`home-card${s.struck ? ' is-struck' : ''}${s.light ? ' is-light' : ''}`} onClick={() => onOpen(t.id)}>
                  <div className="home-card-top"><span className="home-from">{t.from}{t.project && t.project !== 'Sem projeto' ? ` · ${t.project}` : ''}</span><Avatar person={o} size={20} fs={9} /></div>
                  <div className="home-card-title">{taskTitle(t)}</div>
                  {s.key === 'asks' && t.reviewRequest && <div className="home-ask"><b>{t.requestedBy || o.short}:</b> {t.reviewRequest.split('\n')[0]}</div>}
                  {t.feedback && s.key === 'rejected' && <div className="home-reason">“{t.feedback}”</div>}
                  {!s.light && t.summary && s.key !== 'asks' && <div className="home-context">{t.summary}</div>}
                  <TaskTags task={t} all={tasks} compact />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {onSeeAll && <div className="home-all" onClick={onSeeAll}>See everything →</div>}
    </div>
  );
}
