import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/Avatar';
import { CalendarIcon } from '../components/Icons';
import { addDays, dueLabel, iso, today } from '../lib/dates';
import { parseDraft } from '../lib/parse';
import { ownerIds, person } from '../lib/people';
import { cycleIn } from '../lib/sort';
import type { Mode, OwnerId, Priority } from '../lib/types';

export interface NewTask { title: string; due: number | null; time: string | null; owner: OwnerId; priority: Priority }

interface Props {
  mode: Mode;
  /** Fixed owner (team members always create for themselves) */
  fixedOwner?: OwnerId | null;
  /** Day offset preselected by the screen (Week view selects its day) */
  defaultDue: number | null;
  onAdd: (t: NewTask) => void;
  onClose: () => void;
}

const dueOpts: (number | null)[] = [0, 1, 2, 7, null];
const prioOpts: Priority[] = ['High', 'Medium', 'Low'];

export function QuickAddSheet({ mode, fixedOwner, defaultDue, onAdd, onClose }: Props) {
  const [draft, setDraft] = useState('');
  const [dueOverride, setDueOverride] = useState<number | null | undefined>(undefined);
  const [ownerOverride, setOwnerOverride] = useState<OwnerId | null>(null);
  const [prioOverride, setPrioOverride] = useState<Priority | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const p = parseDraft(draft, mode, today());
  const due = dueOverride !== undefined ? dueOverride : p.due !== undefined ? p.due : defaultDue;
  const dueParsed = p.due !== undefined || dueOverride !== undefined;
  const owner: OwnerId = fixedOwner || ownerOverride || p.owner || (mode === 'carla' ? 'carla' : 'none');
  const ownerParsed = !!(ownerOverride || p.owner);
  const priority: Priority = prioOverride !== undefined ? prioOverride : p.priority || 'Medium';
  const prioParsed = !!(p.priority || prioOverride !== undefined);
  const can = !!p.title;
  const op = person(owner);
  const dueText = due === null || due === undefined ? 'No date' : dueLabel({ due: iso(addDays(due)), time: p.time });

  const add = () => { if (can) onAdd({ title: p.title, due: due ?? null, time: p.time, owner, priority }); };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet">
        <div className="handle" />
        <input ref={inputRef} className="sheet-input" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') onClose(); }}
          placeholder="New task — try “Send GA files to Unzile tomorrow 9am @Fernanda”" enterKeyHint="done" />
        <div className="chip-row">
          <div className={`sheet-chip${dueParsed ? ' is-active' : ''}`} onClick={() => setDueOverride(cycleIn(dueOpts, dueOpts.includes(due ?? null) && due !== undefined ? due : 7))}>
            <CalendarIcon size={14} /><span>{dueText}</span>
          </div>
          <div className={`sheet-chip has-avatar${ownerParsed || fixedOwner ? ' is-active' : ''}`} onClick={() => { if (!fixedOwner) setOwnerOverride(cycleIn(ownerIds, owner)); }}>
            <Avatar person={op} size={18} fs={9} /><span>{op.short}</span>
          </div>
          <div className={`sheet-chip${prioParsed ? ' is-active' : ''}`} onClick={() => setPrioOverride(cycleIn(prioOpts, priority))}>
            <span>{priority}</span>
          </div>
        </div>
        <div className="sheet-foot">
          <span className="sheet-hint">Creates a Smart Inbox item. Dates, @people and “high” are picked up as you type.</span>
          <div className={`add-btn${can ? ' is-ready' : ''}`} onClick={add}>Add</div>
        </div>
      </div>
    </>
  );
}
