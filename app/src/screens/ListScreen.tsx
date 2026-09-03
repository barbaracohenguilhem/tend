import { addDays, dateLine, dayNames, dayOffset, weekRange, weekdayOffset } from '../lib/dates';
import { people, person } from '../lib/people';
import { sortTasks } from '../lib/sort';
import type { Mode, OwnerId, Task } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { BackIcon, FocusIcon, PeopleIcon } from '../components/Icons';
import { Logo } from '../components/Logo';
import { SecondaryRow, TaskList, type Anim, type Group } from '../components/TaskList';

export type ListKind = 'today' | 'week' | 'owner';

interface Props {
  screen: ListKind;
  mode: Mode;
  headerAura: boolean;
  loading: boolean;
  tasks: Task[];
  /** open tasks visible in the current mode */
  open: Task[];
  filter: OwnerId | 'all';
  weekSel: number;
  ownerId: OwnerId;
  pendingCount: number;
  pendingLabel: string;
  connectionError?: string;
  pendingReviewCount: number;
  anim: Anim | null;
  showPeople?: boolean;
  onMode: (m: Mode) => void;
  onFilter: (f: OwnerId | 'all') => void;
  onWeekSel: (o: number) => void;
  onFocus: () => void;
  onSettings: () => void;
  onPeople: () => void;
  onComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  onOpen: (id: string) => void;
  onReorder: (gkey: string, from: number, to: number) => void;
  onAdd: () => void;
}

export function ListScreen(p: Props) {
  const { screen, mode, tasks, open, filter } = p;
  const carla = mode === 'carla';

  let groups: Group[] = [];
  if (screen === 'today') {
    const vis = open.filter(t => filter === 'all' || t.owner === filter);
    groups = people.filter(pp => vis.some(t => t.owner === pp.id))
      .map(pp => ({ key: pp.id, person: pp, rows: vis.filter(t => t.owner === pp.id).sort(sortTasks) }));
  } else if (screen === 'week') {
    const rows = open.filter(t => dayOffset(t) === p.weekSel).sort(sortTasks);
    groups = rows.length ? [{ key: 'day', person: null, rows }] : [];
  } else {
    const rows = open.filter(t => t.owner === p.ownerId).sort(sortTasks);
    groups = rows.length ? [{ key: 'owner', person: null, rows }] : [];
  }
  const rowCount = groups.reduce((n, g) => n + g.rows.length, 0);

  let rows2: Task[] = [];
  if (screen === 'today') rows2 = tasks.filter(t => t.completed && (filter === 'all' || t.owner === filter));
  else if (screen === 'week') rows2 = open.filter(t => dayOffset(t) === null);
  else rows2 = tasks.filter(t => t.completed && t.owner === p.ownerId);
  const rows2Label = screen === 'week' ? `No date · ${rows2.length}` : `Completed · ${rows2.length}`;

  let emptyTitle = 'Nothing scheduled.';
  if (screen === 'today') emptyTitle = carla ? 'Inbox clear.' : 'Nothing handed off yet.';
  if (screen === 'owner') emptyTitle = 'No open items.';

  const high = open.filter(t => t.priority === 'High').length;
  const openLine = carla ? `${open.length} open · ${high} high · ${p.pendingReviewCount} to review` : `${open.length} to do`;

  const chips = [
    { id: 'all' as const, label: 'All', person: null },
    ...people.filter(pp => open.some(t => t.owner === pp.id)).map(pp => ({ id: pp.id, label: String(open.filter(t => t.owner === pp.id).length), person: pp })),
  ];

  const off = weekdayOffset();
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => {
    const o = i - off, d = addDays(o), count = open.filter(t => dayOffset(t) === o).length;
    return { key: i, o, label: 'MTWTFSS'[i], num: d.getDate(), dots: Math.min(count, 3), sel: o === p.weekSel, isT: o === 0 };
  });
  const selDate = addDays(p.weekSel);
  const weekSelLabel = `${dayNames[selDate.getDay()]}${p.weekSel === 0 ? ' · today' : p.weekSel === 1 ? ' · tomorrow' : ''}`;

  const oh = person(p.ownerId);
  const ohOpen = tasks.filter(t => t.owner === p.ownerId && !t.completed).length;
  const ohDone = tasks.filter(t => t.owner === p.ownerId && t.completed).length;

  return (
    <div className="list scroll">
      {p.headerAura && screen === 'today' && <div className="aura-header" />}
      <div className="list-head">
        {screen === 'today' && (
          <div className="screen-col">
            <div className="hdr">
              <Logo onClick={p.onSettings} />
              <div className="hdr-right">
                {p.showPeople && <div className="icon-btn sm" onClick={p.onPeople} aria-label="People"><PeopleIcon /></div>}
                <div className="icon-btn sm" onClick={p.onFocus} aria-label="Focus mode"><FocusIcon /></div>
              </div>
            </div>
            <h1 className="h1">Today.</h1>
            <div className="subline-row">
              <span>{dateLine()}</span><span>·</span><span>{openLine}</span>
              {p.pendingCount > 0 && <span className="pending-pill" onClick={p.onSettings}>{p.pendingCount} {p.pendingLabel}</span>}
            </div>
            <div className="chips">
              {chips.map(c => (
                <div key={c.id} className={`chip${c.person ? ' has-avatar' : ''}${filter === c.id ? ' is-active' : ''}`} onClick={() => p.onFilter(c.id)}>
                  {c.person && <Avatar person={c.person} size={18} fs={9} />}
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === 'week' && (
          <div className="screen-col">
            <Logo onClick={p.onSettings} />
            <h1 className="h1">Week.</h1>
            <div className="subline">{weekRange()}</div>
            <div className="days">
              {days.map(d => (
                <div key={d.key} className={`day${d.o < 0 ? ' is-past' : ''}${d.isT ? ' is-today' : ''}${d.sel ? ' is-sel' : ''}`} onClick={() => p.onWeekSel(d.o)}>
                  <span className="day-label">{d.label}</span>
                  <span className="day-num">{d.num}</span>
                  <div className="day-dots">{Array.from({ length: d.dots }, (_, k) => <span key={k} />)}</div>
                </div>
              ))}
            </div>
            <div className="eyebrow week-sel">{weekSelLabel}</div>
          </div>
        )}

        {screen === 'owner' && (
          <div className="screen-col">
            <div className="hdr">
              <div className="icon-btn" onClick={p.onPeople} aria-label="Back"><BackIcon /></div>
              <span className="eyebrow">Owner</span>
              <div className="spacer-40" />
            </div>
            <div className="owner-head">
              <Avatar person={oh} size={40} fs={14} />
              <h1 className="owner-name">{oh.name}</h1>
            </div>
            <div className="subline">{ohOpen} open · {ohDone} completed</div>
          </div>
        )}
      </div>

      {p.loading && <div className="card-note">Loading your Smart Inbox…</div>}
      {!p.loading && p.connectionError && rowCount === 0 && <div className="card-note" onClick={p.onSettings} style={{ cursor: 'pointer' }}>{p.connectionError}</div>}

      {rowCount > 0 && (
        <TaskList groups={groups} anim={p.anim} onComplete={p.onComplete} onSnooze={p.onSnooze} onOpen={p.onOpen} onReorder={p.onReorder} />
      )}

      {!p.loading && rowCount === 0 && (
        <div className="card-empty">
          <span className="card-empty-title">{emptyTitle}</span>
          <span className="link" onClick={p.onAdd}>Add a task</span>
        </div>
      )}

      {rows2.length > 0 && (
        <>
          <div className="eyebrow section-label">{rows2Label}</div>
          <div className="rows">
            {rows2.map(t => <SecondaryRow key={t.id} task={t} onOpen={p.onOpen} onToggle={p.onComplete} />)}
          </div>
        </>
      )}
    </div>
  );
}
