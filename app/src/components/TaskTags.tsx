import { catColor } from '../lib/people';
import { dayOffset, dueLabel } from '../lib/dates';
import type { Task } from '../lib/types';

/** Category · project · due, as small chips. Due gets stronger the closer (or later) it is. */
export function TaskTags({ task, compact }: { task: Task; compact?: boolean }) {
  const d = dayOffset(task);
  const dueClass = d === null ? '' : d < 0 ? ' is-overdue' : d === 0 ? ' is-today' : d <= 2 ? ' is-soon' : '';
  return (
    <div className={`tags${compact ? ' compact' : ''}`}>
      <span className="tag tag-cat"><span className="dot" style={{ background: catColor(task.category) }} />{task.category}</span>
      {task.project && task.project !== 'Sem projeto' && <span className="tag tag-project">{task.project}</span>}
      {d !== null && <span className={`tag tag-due${dueClass}`}>{d < 0 ? `Overdue · ${dueLabel(task)}` : dueLabel(task)}</span>}
      {task.priority === 'High' && <span className="tag tag-high">High</span>}
    </div>
  );
}

export function DueChip({ task }: { task: Task }) {
  const d = dayOffset(task);
  if (d === null) return null;
  const cls = d < 0 ? ' is-overdue' : d === 0 ? ' is-today' : d <= 2 ? ' is-soon' : '';
  return <span className={`tag tag-due${cls}`}>{d < 0 ? `Overdue · ${dueLabel(task)}` : dueLabel(task)}</span>;
}
