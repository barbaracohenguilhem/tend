import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { TaskTags } from '../components/TaskTags';
import { dateLine } from '../lib/dates';
import { person } from '../lib/people';
import { sortTasks } from '../lib/sort';
import type { OwnerId, Role, Task } from '../lib/types';

interface Section { key: string; title: string; hint?: string; rows: Task[]; struck?: boolean; empty: string }

interface Props {
  role: Role;
  name: string;
  myOwner: OwnerId | null;
  tasks: Task[];
  onOpen: (id: string) => void;
  onSeeAll: (() => void) | null;
  onSettings: () => void;
}

/** Waiting for Carla: a proposal with no decision yet ('Changes requested' is waiting on LOLI's rewrite). */
const isPendingDraft = (t: Task) => !!t.draft && !t.completed && (t.review === 'Pending review' || t.review === null);
const needsDelivery = (t: Task) => !!t.deliverable && !t.completed && !(t.files && t.files.length);

/** Role-specific front page: what needs this person's hand, nothing else. */
export function HomeScreen({ role, name, myOwner, tasks, onOpen, onSeeAll, onSettings }: Props) {
  let title = 'For you.'; let sections: Section[] = [];
  const open = tasks.filter(t => !t.completed);
  if (role === 'carla') {
    const mine = open.filter(t => t.owner === 'carla');
    const decide = mine.filter(isPendingDraft).sort(sortTasks);
    const deliver = mine.filter(t => needsDelivery(t) && !isPendingDraft(t)).sort(sortTasks);
    const rest = mine.filter(t => !isPendingDraft(t) && !needsDelivery(t) && t.review !== 'Changes requested').sort(sortTasks);
    const waiting = mine.filter(t => t.review === 'Changes requested').sort(sortTasks);
    sections = [
      { key: 'decide', title: 'To decide', hint: 'Proposed responses waiting for your approval', rows: decide, empty: 'Nothing to decide.' },
      { key: 'deliver', title: 'To deliver', hint: 'Documents or files someone needs from you', rows: deliver, empty: 'Nothing to deliver.' },
      { key: 'mine', title: 'Also in your name', rows: rest, empty: 'Nothing else in your name.' },
      { key: 'waiting', title: 'Sent back — being rewritten', hint: 'You rejected these; a new proposal will show up in "To decide"', rows: waiting, empty: '' },
    ].filter(s => s.rows.length > 0 || s.empty);
  } else if (role === 'barbara') {
    title = 'Reviewed by Carla.';
    const approved = open.filter(t => t.review === 'Approved').sort(sortTasks);
    const handed = open.filter(t => t.review === 'Barbara to handle').sort(sortTasks);
    const rejected = open.filter(t => t.review === 'Changes requested').sort(sortTasks);
    const resolved = tasks.filter(t => t.completed && t.resolvedBy === 'Carla').sort(sortTasks);
    sections = [
      { key: 'approved', title: 'Approved — for you to do', hint: 'Send the response as proposed, or handle what was approved', rows: approved, empty: 'Nothing approved yet.' },
      { key: 'handed', title: 'Handed to you', rows: handed, empty: 'Nothing handed to you.' },
      { key: 'rejected', title: 'Rejected — with her reason', hint: 'Open the task to read or listen to why', rows: rejected, empty: 'Nothing rejected.' },
      { key: 'resolved', title: 'She did it herself', rows: resolved, struck: true, empty: 'Nothing resolved by Carla yet.' },
    ];
  } else {
    title = 'Yours.';
    const mine = myOwner ? open.filter(t => t.owner === myOwner).sort(sortTasks) : [];
    sections = [{ key: 'mine', title: myOwner ? `In your name · ${mine.length}` : 'Your tasks', rows: mine, empty: myOwner ? 'Nothing in your name right now.' : 'We could not match your address to a team member yet. Ask Barbara to add you.' }];
  }
  const total = sections.reduce((n, s) => n + (s.struck ? 0 : s.rows.length), 0);

  return (
    <div className="page scroll">
      <Logo onClick={onSettings} />
      <h1 className="h1">{title}</h1>
      <div className="subline">{dateLine()} · {name} · {total} waiting</div>
      {sections.map(s => (
        <div key={s.key} className="home-section">
          <div className="eyebrow section-label">{s.title}{s.rows.length ? ` · ${s.rows.length}` : ''}</div>
          {s.hint && s.rows.length > 0 && <div className="home-hint">{s.hint}</div>}
          {s.rows.length === 0 && <div className="home-empty">{s.empty}</div>}
          <div className="rows">
            {s.rows.map(t => {
              const o = person(t.owner);
              return (
                <div key={t.id} className={`home-card${s.struck ? ' is-struck' : ''}`} onClick={() => onOpen(t.id)}>
                  <div className="home-card-top"><span className="home-from">{t.from}</span><Avatar person={o} size={20} fs={9} /></div>
                  <div className="home-card-title">{t.action}</div>
                  {t.feedback && s.key === 'rejected' && <div className="home-reason">“{t.feedback}”</div>}
                  <TaskTags task={t} compact />
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
