import { taskTitle } from '../lib/title';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { TaskTags } from '../components/TaskTags';
import { dateLine } from '../lib/dates';
import { person } from '../lib/people';
import { sortTasks } from '../lib/sort';
import { isPendingDraft } from '../lib/review';
import type { OwnerId, Role, Task } from '../lib/types';
import { weightOf } from '../lib/weight';
import '../styles/home.css';

interface Section { key: string; title: string; hint?: string; rows: Task[]; struck?: boolean; light?: boolean; collapsed?: boolean; empty: string }

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
  onReview?: () => void;
  onSeeAll: (() => void) | null;
  onSettings: () => void;
}

const isHandedOff = (t: Task) => t.review === 'Approved' || t.review === 'Barbara to handle';
const split = (rows: Task[]) => ({ key: rows.filter(t => weightOf(t) === 'key'), light: rows.filter(t => weightOf(t) === 'light') });

/** Role-specific front page: decisions first, quick checks last, nothing that is not this person's. */
export function HomeScreen({ role, name, myOwner, tasks, loading, error, onRetry, pendingCount, onOpen, onReview, onSeeAll, onSettings }: Props) {
  let title = 'For you.'; let sections: Section[] = [];
  const open = tasks.filter(t => !t.completed);
  if (role === 'carla') {
    const mine = open.filter(t => t.owner === 'carla');
    const asks = open.filter(t => t.teamReview === 'Requested').sort(sortTasks);
    // All prepared responses need her decision; keep her own first, with each task shown once.
    const decide = open.filter(t => isPendingDraft(t) && t.teamReview !== 'Requested')
      .sort((a, b) => Number(b.owner === 'carla') - Number(a.owner === 'carla') || sortTasks(a, b));
    const rest = mine.filter(t => !isPendingDraft(t) && !isHandedOff(t) && t.review !== 'Changes requested' && t.teamReview !== 'Requested').sort(sortTasks);
    const waiting = open.filter(t => t.review === 'Changes requested' && t.teamReview !== 'Requested').sort(sortTasks);
    const handed = open.filter(t => isHandedOff(t) && t.teamReview !== 'Requested').sort(sortTasks);
    sections = [
      { key: 'asks', title: 'Your team asks', hint: 'Someone wants your go-ahead before acting', rows: asks, empty: '' },
      { key: 'decide', title: 'Responses to review', hint: 'Read the summary and response, then approve or request changes.', rows: decide, empty: 'No responses waiting for your review.' },
      { key: 'mine', title: 'Your other tasks', rows: rest, collapsed: true, empty: '' },
      { key: 'waiting', title: 'Waiting for changes', hint: 'These will return for review when a new response is ready.', rows: waiting, collapsed: true, empty: '' },
      { key: 'handed', title: 'With Barbara', hint: 'You have decided. Barbara will take it from here.', rows: handed, collapsed: true, empty: '' },
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
  const total = new Set(sections.filter(s => !s.struck && !s.collapsed).flatMap(s => s.rows.map(t => t.id))).size;
  const reviewCount = tasks.filter(isPendingDraft).length;
  const ready = !loading && !error;

  const sectionBody = (s: Section) => <>
    {s.hint && s.rows.length > 0 && <div className="home-hint">{s.hint}</div>}
    {s.key === 'decide' && reviewCount > 0 && onReview && <button type="button" className="btn btn-ink home-review" onClick={onReview}>Review responses · {reviewCount}</button>}
    {s.rows.length === 0 && ready && <div className="home-empty">{pendingCount ? 'Your changes are waiting to sync.' : s.key === 'decide' && reviewCount > 0 ? 'Your team requests also have prepared responses to review.' : s.empty}</div>}
    <div className="rows">
      {s.rows.map(t => {
        const o = person(t.owner);
        return (
          <button type="button" key={t.id} className={`home-card${s.struck ? ' is-struck' : ''}${s.light ? ' is-light' : ''}`} onClick={() => onOpen(t.id)}>
            <div className="home-card-top"><span className="home-from">{t.from}</span><Avatar person={o} size={24} fs={10} /></div>
            <div className="home-card-title">{taskTitle(t)}</div>
            {s.key === 'asks' && t.reviewRequest && <div className="home-ask"><b>{t.requestedBy || o.short}:</b> {t.reviewRequest.split('\n')[0]}</div>}
            {t.feedback && (s.key === 'rejected' || s.key === 'waiting') && <div className="home-reason">“{t.feedback}”</div>}
            {!s.light && t.summary && s.key !== 'asks' && <div className="home-context">{t.summary}</div>}
            {t.deliverable && s.key === 'mine' && <div className="home-hint">Needed: {t.deliverable}</div>}
            <TaskTags task={t} all={tasks} compact />
          </button>
        );
      })}
    </div>
  </>;

  return (
    <div className="page scroll home-screen">
      <Logo onClick={onSettings} />
      <h1 className="h1">{title}</h1>
      <div className="subline">{dateLine()} · {name}{ready ? ` · ${total} ${role === 'carla' ? 'to review' : 'waiting'}` : ''}{pendingCount ? ` · ${pendingCount} to sync` : ''}</div>
      {loading && <div className="home-status" role="status">Updating your inbox…</div>}
      {error && !loading && (
        <div className="banner banner-error" role="alert">
          <div><b>Can't reach the Smart Inbox.</b> {error}</div>
          {onRetry && <button type="button" className="btn btn-white btn-sm" onClick={onRetry}>Retry</button>}
        </div>
      )}
      {sections.map(s => s.collapsed ? (
        <details key={s.key} className="home-section home-secondary">
          <summary>{s.title}<span className="home-count">{s.rows.length}</span></summary>
          {sectionBody(s)}
        </details>
      ) : (
        <div key={s.key} className={`home-section${s.light ? ' is-light' : ''}`}>
          <div className="eyebrow section-label">{s.title}{s.rows.length ? ` · ${s.rows.length}` : ''}</div>
          {sectionBody(s)}
        </div>
      ))}
      {onSeeAll && <button type="button" className="home-all" onClick={onSeeAll}>See everything →</button>}
    </div>
  );
}
