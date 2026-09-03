import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { catColor, person } from '../lib/people';
import { dayOffset, dueLabel } from '../lib/dates';
import type { Person, Task } from '../lib/types';
import { Avatar } from './Avatar';
import { CheckIcon, GripIcon, MoonIcon } from './Icons';
import { ReviewPill } from './ReviewPill';

export interface Group { key: string; person: Person | null; rows: Task[] }
export interface Anim { id: string; type: 'complete' | 'snooze' }

interface Gesture {
  type: 'drag' | 'swipe';
  kind: 'check' | 'grip' | 'body';
  id: string; gkey: string;
  x0: number; y0: number; dx: number; dy: number;
  from: number; to: number; slot: number; n: number;
  moved: boolean;
}

interface Props {
  groups: Group[];
  anim: Anim | null;
  onComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  onOpen: (id: string) => void;
  onReorder: (gkey: string, from: number, to: number) => void;
}

const SWIPE_LIMIT = 150;

/** Owner-grouped task rows with swipe (right = done, left = tomorrow) and grip-drag reordering. */
export function TaskList({ groups, anim, onComplete, onSnooze, onOpen, onReorder }: Props) {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gRef = useRef<Gesture | null>(null);
  const rowsOf = (gkey: string) => groups.find(g => g.key === gkey)?.rows ?? [];
  const update = (g: Gesture | null) => { gRef.current = g; setGesture(g); };
  useEffect(() => () => { gRef.current = null; }, []);

  const down = (e: RPointerEvent<HTMLDivElement>, id: string, gkey: string) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (anim && anim.id === id) return;
    const target = e.target as HTMLElement;
    const isGrip = !!target.closest('[data-grip]');
    const isCheck = !!target.closest('[data-check]');
    const rows = rowsOf(gkey);
    const idx = rows.findIndex(t => t.id === id);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    const rect = e.currentTarget.getBoundingClientRect();
    update({
      type: isGrip ? 'drag' : 'swipe', kind: isCheck ? 'check' : isGrip ? 'grip' : 'body', id, gkey,
      x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, from: idx, to: idx, slot: rect.height + 8, n: rows.length, moved: false,
    });
  };
  const move = (e: RPointerEvent<HTMLDivElement>, id: string) => {
    const g = gRef.current; if (!g || g.id !== id) return;
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (g.type === 'drag') {
      const to = Math.max(0, Math.min(g.n - 1, g.from + Math.round(dy / g.slot)));
      update({ ...g, dy, to, moved: g.moved || Math.abs(dy) > 3 });
    } else {
      if (!g.moved && Math.abs(dx) < 5) return;
      const ad = Math.min(Math.abs(dx), SWIPE_LIMIT + (Math.abs(dx) - SWIPE_LIMIT) * 0.25);
      update({ ...g, dx: Math.sign(dx) * ad, moved: true });
    }
  };
  const up = (_e: RPointerEvent<HTMLDivElement>, id: string) => {
    const g = gRef.current; if (!g || g.id !== id) return;
    update(null);
    if (g.type === 'drag') { if (g.to !== g.from && g.moved) onReorder(g.gkey, g.from, g.to); return; }
    if (!g.moved) { if (g.kind === 'check') onComplete(id); else if (g.kind === 'body') onOpen(id); return; }
    if (g.dx > 80) onComplete(id); else if (g.dx < -80) onSnooze(id);
  };
  const cancel = (_e: RPointerEvent<HTMLDivElement>, id: string) => {
    const g = gRef.current; if (g && g.id === id) update(null);
  };

  const shiftFor = (i: number, g: Gesture) => {
    if (g.from < g.to && i > g.from && i <= g.to) return -g.slot;
    if (g.from > g.to && i >= g.to && i < g.from) return g.slot;
    return 0;
  };

  return (
    <>
      {groups.map(g => (
        <div key={g.key} className="screen-col">
          {g.person && (
            <div className="group-label eyebrow">
              <Avatar person={g.person} size={18} fs={9} />
              <span>{g.person.short} · {g.rows.length}</span>
            </div>
          )}
          <div className="rows">
            {g.rows.map((t, i) => {
              const a = anim && anim.id === t.id ? anim.type : null;
              const dragging = gesture?.type === 'drag' && gesture.gkey === g.key;
              const dragStyle = dragging
                ? gesture.id === t.id
                  ? { transform: `translateY(${gesture.dy}px) scale(1.02)` }
                  : { transform: `translateY(${shiftFor(i, gesture)}px)` }
                : undefined;
              const swiping = gesture?.type === 'swipe' && gesture.id === t.id && gesture.moved;
              const swipeStyle = swiping ? { transform: `translateX(${gesture.dx}px)` } : undefined;
              const checked = t.completed || a === 'complete';
              const owner = person(t.owner);
              const d = dayOffset(t);
              return (
                <div key={t.id} className="row-wrap">
                  <div className={`row-drag${dragging && gesture.id === t.id ? ' is-dragging' : ''}`} style={dragStyle}>
                    <div className="row-under">
                      <div className="under-done"><CheckIcon size={16} sw={2.2} /><span>Done</span></div>
                      <div className="under-later"><span>Tomorrow</span><MoonIcon /></div>
                    </div>
                    <div className={`row-swipe${swiping ? ' is-moving' : ''}${a === 'complete' ? ' is-completing' : ''}${a === 'snooze' ? ' is-snoozing' : ''}`} style={swipeStyle}>
                      <div className="row"
                        onPointerDown={e => down(e, t.id, g.key)} onPointerMove={e => move(e, t.id)}
                        onPointerUp={e => up(e, t.id)} onPointerCancel={e => cancel(e, t.id)}>
                        <div data-check="1" className={`check${checked ? ' is-checked' : ''}${a === 'complete' ? ' is-glow' : ''}`}>
                          {checked && <CheckIcon />}
                        </div>
                        <div className="row-body">
                          <div className="row-title">{t.action}</div>
                          <div className="row-meta">
                            <span className="dot" style={{ background: catColor(t.category) }} />
                            <span className="row-meta-text">{t.from}{d !== null ? ' · ' + dueLabel(t) : ''}</span>
                            {t.priority === 'High' && <span className="badge-high">High</span>}
                            <ReviewPill review={t.review} />
                          </div>
                        </div>
                        <div data-grip="1" className="grip" aria-label={`Reorder ${owner.short}'s task`}><GripIcon /></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/** Flat secondary row (Completed / No date sections). */
export function SecondaryRow({ task, onOpen, onToggle }: { task: Task; onOpen: (id: string) => void; onToggle: (id: string) => void }) {
  const owner = person(task.owner);
  const d = dayOffset(task);
  return (
    <div className="row2" onClick={() => onOpen(task.id)}>
      <div className={`check${task.completed ? ' is-checked' : ''}`} onClick={e => { e.stopPropagation(); onToggle(task.id); }}>
        {task.completed && <CheckIcon />}
      </div>
      <div className="row2-body">
        <div className={`row2-title${task.completed ? ' is-done' : ''}`}>{task.action}</div>
        <div className="row2-meta">
          <span className="dot" style={{ background: catColor(task.category) }} />
          <span className="row2-meta-text">{task.from}{d !== null ? ' · ' + dueLabel(task) : ''}</span>
        </div>
      </div>
      <Avatar person={owner} size={28} fs={11} />
    </div>
  );
}
