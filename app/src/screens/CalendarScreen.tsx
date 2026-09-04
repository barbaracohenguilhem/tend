import { taskTitle } from '../lib/title';
import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Logo } from '../components/Logo';
import { TaskTags } from '../components/TaskTags';
import { dayNames, iso, monthNames, today } from '../lib/dates';
import { person } from '../lib/people';
import { sortTasks } from '../lib/sort';
import type { OwnerId, Role, Task } from '../lib/types';

interface Props {
  role: Role;
  myOwner: OwnerId | null;
  tasks: Task[];
  onOpen: (id: string) => void;
  onSettings: () => void;
}

/** Month view of due dates. Days with work carry dots; overdue items are listed first. */
export function CalendarScreen({ role, myOwner, tasks, onOpen, onSettings }: Props) {
  const t0 = today();
  const [scope, setScope] = useState<'mine' | 'all'>(role === 'barbara' || !myOwner ? 'all' : 'mine');
  const [ym, setYm] = useState({ y: t0.getFullYear(), m: t0.getMonth() });
  const [sel, setSel] = useState<string>(iso(t0));
  const open = tasks.filter(t => !t.completed && !!t.due && (scope === 'all' || t.owner === myOwner));
  const byDay = new Map<string, Task[]>();
  open.forEach(t => { const k = t.due!.slice(0, 10); byDay.set(k, [...(byDay.get(k) || []), t]); });
  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-based
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => iso(new Date(ym.y, ym.m, i + 1)))];
  while (cells.length % 7) cells.push(null);
  const todayIso = iso(t0);
  const overdue = open.filter(t => t.due!.slice(0, 10) < todayIso).sort(sortTasks);
  const selected = (byDay.get(sel) || []).slice().sort(sortTasks);
  const selDate = new Date(sel + 'T00:00:00');
  const shift = (n: number) => { const d = new Date(ym.y, ym.m + n, 1); setYm({ y: d.getFullYear(), m: d.getMonth() }); };

  return (
    <div className="page scroll">
      <Logo onClick={onSettings} />
      <h1 className="h1">Calendar.</h1>
      <div className="subline-row">
        <span>{open.length} dated</span>
        {myOwner && role !== 'team' && (
          <div className="mode-switch" style={{ marginLeft: 'auto' }}>
            <div className={`mode-opt${scope === 'mine' ? ' is-active' : ''}`} onClick={() => setScope('mine')}>Mine</div>
            <div className={`mode-opt${scope === 'all' ? ' is-active' : ''}`} onClick={() => setScope('all')}>Everyone</div>
          </div>
        )}
      </div>
      <div className="cal">
        <div className="cal-nav">
          <div className="icon-btn sm" onClick={() => shift(-1)} aria-label="Previous month"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></div>
          <span className="cal-month">{monthNames[ym.m]} {ym.y}</span>
          <div className="icon-btn sm" onClick={() => shift(1)} aria-label="Next month"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></div>
        </div>
        <div className="cal-grid">
          {'MTWTFSS'.split('').map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
          {cells.map((c, i) => {
            if (!c) return <span key={i} className="cal-cell is-blank" />;
            const n = byDay.get(c)?.length || 0;
            const hi = (byDay.get(c) || []).some(t => t.priority === 'High');
            const past = c < todayIso;
            return (
              <span key={i} className={`cal-cell${c === todayIso ? ' is-today' : ''}${c === sel ? ' is-sel' : ''}${past ? ' is-past' : ''}`} onClick={() => setSel(c)}>
                <span className="cal-num">{+c.slice(8, 10)}</span>
                <span className="cal-dots">{Array.from({ length: Math.min(n, 3) }, (_, k) => <i key={k} className={hi && past ? 'is-hot' : ''} />)}</span>
              </span>
            );
          })}
        </div>
      </div>
      {overdue.length > 0 && (
        <>
          <div className="eyebrow section-label" style={{ color: 'var(--danger)' }}>Overdue · {overdue.length}</div>
          <div className="rows">{overdue.map(t => <DayRow key={t.id} t={t} onOpen={onOpen} />)}</div>
        </>
      )}
      <div className="eyebrow section-label">{dayNames[selDate.getDay()]}, {selDate.getDate()} {monthNames[selDate.getMonth()]}{sel === todayIso ? ' · today' : ''} · {selected.length}</div>
      {selected.length === 0 && <div className="home-empty">Nothing due this day.</div>}
      <div className="rows">{selected.map(t => <DayRow key={t.id} t={t} onOpen={onOpen} />)}</div>
    </div>
  );
}

function DayRow({ t, onOpen }: { t: Task; onOpen: (id: string) => void }) {
  const o = person(t.owner);
  return (
    <div className="home-card" onClick={() => onOpen(t.id)}>
      <div className="home-card-top"><span className="home-from">{t.from}{t.time ? ` · ${t.time}` : ''}</span><Avatar person={o} size={20} fs={9} /></div>
      <div className="home-card-title">{taskTitle(t)}</div>
      <TaskTags task={t} compact />
    </div>
  );
}
