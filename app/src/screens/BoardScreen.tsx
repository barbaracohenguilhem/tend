import { taskTitle } from '../lib/title';
import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { TaskTags } from '../components/TaskTags';
import { dayOffset } from '../lib/dates';
import { person } from '../lib/people';
import { sortTasks } from '../lib/sort';
import type { OwnerId, Role, Task } from '../lib/types';

export type Bucket = 'today' | 'tomorrow' | 'later' | 'none';
const COLS: { key: Bucket; title: string; hint: string }[] = [
  { key: 'today', title: 'Today', hint: 'Due today or overdue' },
  { key: 'tomorrow', title: 'Tomorrow', hint: '' },
  { key: 'later', title: 'Later', hint: 'This week and beyond' },
  { key: 'none', title: 'No date', hint: 'Not scheduled yet' },
];
export function bucketOf(t: Task): Bucket {
  const d = dayOffset(t);
  if (d === null) return 'none';
  if (d <= 0) return 'today';
  if (d === 1) return 'tomorrow';
  return 'later';
}

interface Props {
  role: Role;
  myOwner: OwnerId | null;
  tasks: Task[];
  onMove: (id: string, to: Bucket) => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
}

/** Triage board: four columns you move cards between with one tap. Moves change the due date, so the calendar follows. */
export function BoardScreen({ role, myOwner, tasks, onMove, onOpen, onSettings }: Props) {
  const [scope, setScope] = useState<'mine' | 'all'>(role === 'barbara' || !myOwner ? 'all' : 'mine');
  const [moving, setMoving] = useState<string | null>(null);
  const open = tasks.filter(t => !t.completed && (scope === 'all' || t.owner === myOwner));
  const cols = COLS.map(c => ({ ...c, rows: open.filter(t => bucketOf(t) === c.key).sort(sortTasks) }));

  return (
    <div className="page board-page">
      <div className="board-head">
        <Logo onClick={onSettings} />
        <h1 className="h1">Board.</h1>
        <div className="subline-row">
          <span>{open.length} open</span>
          {myOwner && role !== 'team' && (
            <div className="mode-switch" style={{ marginLeft: 'auto' }}>
              <div className={`mode-opt${scope === 'mine' ? ' is-active' : ''}`} onClick={() => setScope('mine')}>Mine</div>
              <div className={`mode-opt${scope === 'all' ? ' is-active' : ''}`} onClick={() => setScope('all')}>Everyone</div>
            </div>
          )}
        </div>
      </div>
      <div className="board scroll">
        {cols.map(c => (
          <div key={c.key} className={`col col-${c.key}`}>
            <div className="col-head"><span className="eyebrow">{c.title}</span><span className="col-count">{c.rows.length}</span></div>
            {c.hint && c.rows.length === 0 && <div className="col-empty">{c.hint}</div>}
            <div className="col-list scroll">
              {c.rows.map(t => {
                const o = person(t.owner);
                const isMoving = moving === t.id;
                return (
                  <div key={t.id} className={`kcard${isMoving ? ' is-moving' : ''}`}>
                    <div className="kcard-body" onClick={() => onOpen(t.id)}>
                      <div className="home-card-top"><span className="home-from">{t.from}</span><Avatar person={o} size={20} fs={9} /></div>
                      <div className="home-card-title">{taskTitle(t)}</div>
                      <TaskTags task={t} compact />
                    </div>
                    {isMoving ? (
                      <div className="kcard-moves">
                        {COLS.filter(x => x.key !== c.key).map(x => <div key={x.key} className="sheet-chip" onClick={() => { onMove(t.id, x.key); setMoving(null); }}>→ {x.title}</div>)}
                        <div className="sheet-chip" onClick={() => setMoving(null)}>Cancel</div>
                      </div>
                    ) : (
                      <div className="kcard-move" onClick={() => setMoving(t.id)}>Move</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
