import { useState } from 'react';
import { addDays, dueLabel, iso, today } from '../lib/dates';
import { catColors, person } from '../lib/people';
import type { Priority, Task, TaskPatch } from '../lib/types';

const PRIORITIES: (Priority | null)[] = ['High', 'Medium', 'Low', null];
const CATEGORIES = Object.keys(catColors).concat(['Newsletter / Information', 'Spam / Promotion']);

interface Props {
  task: Task;
  editable: boolean;
  /** Project names already in use, for quick picking */
  projects: string[];
  onPatch: (p: TaskPatch) => void;
}

/** Priority · category · project · due date, as real controls (chips and a date picker) that write straight to Notion. */
export function FieldEditor({ task: t, editable, projects, onPatch }: Props) {
  const [newProject, setNewProject] = useState('');
  const owner = person(t.owner);
  if (!editable) {
    return (
      <div className="kv-card">
        <div className="kv-row"><span className="kv-key">Owner</span><span className="kv-val">{owner.short}</span></div>
        <div className="kv-row"><span className="kv-key">Priority</span><span className="kv-val">{t.priority || 'None'}</span></div>
        <div className="kv-row"><span className="kv-key">Category</span><span className="kv-val">{t.category}</span></div>
        {t.project && <div className="kv-row"><span className="kv-key">Project</span><span className="kv-val">{t.project}</span></div>}
        <div className="kv-row"><span className="kv-key">Due</span><span className="kv-val">{dueLabel(t)}</span></div>
        <div className="kv-row"><span className="kv-key">Status</span><span className="kv-val">{t.completed ? `Completed${t.resolvedBy ? ` · by ${t.resolvedBy}` : ''}` : t.review || 'Open'}</span></div>
      </div>
    );
  }
  const projectChoices = Array.from(new Set(['Sem projeto', ...projects, ...(t.project ? [t.project] : [])]));
  const dueValue = t.due ? t.due.slice(0, 10) : '';
  return (
    <div className="fields">
      <div className="field-block">
        <span className="field-label">Priority</span>
        <div className="chip-row">
          {PRIORITIES.map(p => <div key={String(p)} className={`sheet-chip prio-${(p || 'none').toLowerCase()}${(t.priority ?? null) === p ? ' is-active' : ''}`} onClick={() => onPatch({ priority: p })}>{p || 'None'}</div>)}
        </div>
      </div>
      <div className="field-block">
        <span className="field-label">Due date</span>
        <div className="chip-row">
          <div className={`sheet-chip${dueValue === iso(today()) ? ' is-active' : ''}`} onClick={() => onPatch({ due: iso(today()), time: null })}>Today</div>
          <div className={`sheet-chip${dueValue === iso(addDays(1)) ? ' is-active' : ''}`} onClick={() => onPatch({ due: iso(addDays(1)), time: null })}>Tomorrow</div>
          <div className={`sheet-chip${dueValue === iso(addDays(7)) ? ' is-active' : ''}`} onClick={() => onPatch({ due: iso(addDays(7)), time: null })}>Next week</div>
          <div className={`sheet-chip${!dueValue ? ' is-active' : ''}`} onClick={() => onPatch({ due: null, time: null })}>None</div>
          <label className="date-pick">
            <input type="date" value={dueValue} onChange={e => onPatch({ due: e.target.value || null, time: e.target.value ? t.time ?? null : null })} />
            <span>{dueValue ? dueLabel(t) : 'Pick a date'}</span>
          </label>
        </div>
      </div>
      <div className="field-block">
        <span className="field-label">Category</span>
        <div className="chip-row">
          {CATEGORIES.map(c => <div key={c} className={`sheet-chip${t.category === c ? ' is-active' : ''}`} onClick={() => onPatch({ category: c })}><span className="dot" style={{ background: catColors[c] || 'var(--linen)' }} />{c}</div>)}
        </div>
      </div>
      <div className="field-block">
        <span className="field-label">Project</span>
        <div className="chip-row">
          {projectChoices.map(p => <div key={p} className={`sheet-chip${(t.project || 'Sem projeto') === p ? ' is-active' : ''}`} onClick={() => onPatch({ project: p })}>{p}</div>)}
          <form className="project-add" onSubmit={e => { e.preventDefault(); const v = newProject.trim(); if (v) { onPatch({ project: v }); setNewProject(''); } }}>
            <input className="field-input" placeholder="New project…" value={newProject} onChange={e => setNewProject(e.target.value)} />
            <button type="submit" className="btn btn-white btn-sm">Add</button>
          </form>
        </div>
      </div>
      <div className="kv-card">
        <div className="kv-row"><span className="kv-key">Owner</span><span className="kv-val">{owner.short}</span></div>
        <div className="kv-row"><span className="kv-key">Status</span><span className="kv-val">{t.completed ? `Completed${t.resolvedBy ? ` · by ${t.resolvedBy}` : ''}` : t.review || 'Open'}</span></div>
      </div>
    </div>
  );
}
