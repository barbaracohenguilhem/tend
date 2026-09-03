import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { people } from '../lib/people';
import type { OwnerId, Task } from '../lib/types';

export function PeopleScreen({ tasks, openCount, onOpenOwner, onSettings }: { tasks: Task[]; openCount: number; onOpenOwner: (id: OwnerId) => void; onSettings: () => void }) {
  const cards = people.filter(p => tasks.some(t => t.owner === p.id)).map(p => {
    const all = tasks.filter(t => t.owner === p.id);
    const done = all.filter(t => t.completed).length;
    const open = all.length - done;
    const hi = all.filter(t => !t.completed && t.priority === 'High').length;
    const pct = all.length ? Math.round((done / all.length) * 100) : 0;
    return { p, open, hi, pct };
  });
  return (
    <div className="page scroll">
      <Logo onClick={onSettings} />
      <h1 className="h1">People.</h1>
      <div className="subline">{cards.length} people · {openCount} open</div>
      <div className="people-grid">
        {cards.map(({ p, open, hi, pct }) => (
          <div key={p.id} className="person-card" onClick={() => onOpenOwner(p.id)}>
            <Avatar person={p} size={34} fs={12} />
            <div className="person-body">
              <span className="person-name">{p.short}</span>
              <span className="person-open">{open} open{hi ? ` · ${hi} high` : ''}</span>
            </div>
            <div className="bar"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
