import { catColor } from '../lib/people';
import { dayOffset, dueLabel } from '../lib/dates';
import type { Task } from '../lib/types';
import { isBlocked } from '../lib/weight';

/** Category · project · due, as small chips. Due gets stronger the closer (or later) it is. */
export function TaskTags({ task, all, compact }: { task: Task; all?: Task[]; compact?: boolean }) {
  const subs = all ? all.filter(x => x.parentId === task.id) : [];
  const blocked = all ? isBlocked(task, all) : false;
  const d = dayOffset(task);
  const dueClass = d === null ? '' : d < 0 ? ' is-overdue' : d === 0 ? ' is-today' : d <= 2 ? ' is-soon' : '';
  return (
    <div className={`tags${compact ? ' compact' : ''}`}>
      <span className="tag tag-cat"><span className="dot" style={{ background: catColor(task.category) }} />{task.category}</span>
      {task.project && task.project !== 'Sem projeto' && <span className="tag tag-project">{task.project}</span>}
      {d !== null && <span className={`tag tag-due${dueClass}`}>{d < 0 ? `Overdue · ${dueLabel(task)}` : dueLabel(task)}</span>}
      {task.priority === 'High' && <span className="tag tag-high">High</span>}
      {task.priority === 'Medium' && <span className="tag tag-medium">Medium</span>}
      {task.priority === 'Low' && <span className="tag tag-low">Low</span>}
      {task.teamReview === 'Requested' && <span className="tag tag-ask">Asked Carla</span>}
      {task.teamReview === 'Approved' && <span className="tag tag-ok">Carla ✓</span>}
      {task.teamReview === 'Rejected' && <span className="tag tag-no">Carla ✗</span>}
      {blocked && <span className="tag tag-blocked">Waiting{task.waitingOn ? ` · ${task.waitingOn}` : ''}</span>}
      {subs.length > 0 && <span className="tag">{subs.filter(x => x.completed).length}/{subs.length} subtasks</span>}
    </div>
  );
}

export function DueChip({ task }: { task: Task }) {
  const d = dayOffset(task);
  if (d === null) return null;
  const cls = d < 0 ? ' is-overdue' : d === 0 ? ' is-today' : d <= 2 ? ' is-soon' : '';
  return <span className={`tag tag-due${cls}`}>{d < 0 ? `Overdue · ${dueLabel(task)}` : dueLabel(task)}</span>;
}
