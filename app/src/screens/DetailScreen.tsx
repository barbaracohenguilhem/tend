import { taskTitle } from '../lib/title';
import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Chat } from '../components/Chat';
import { FieldEditor } from '../components/FieldEditor';
import { BackIcon } from '../components/Icons';
import { TaskTags } from '../components/TaskTags';
import { addDays, dueLabel, iso } from '../lib/dates';
import { people, person } from '../lib/people';
import type { OwnerId, Priority, Role, Task, TaskPatch } from '../lib/types';
import { isBlocked } from '../lib/weight';
import { useComments } from '../store/useComments';

export interface Decision { kind: 'approve' | 'reject' | 'resolved' | 'complete' | 'reopen'; reason?: string }
export interface Forward { owner: OwnerId; priority: Priority | null; due: number | null; note: string }
export interface NewSubtask { title: string; owner: OwnerId; ownerName: string | null; due: number | null }

interface Props {
  task: Task;
  all: Task[];
  role: Role;
  me: string;
  myOwner: OwnerId | null;
  projects: string[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onPatch: (p: TaskPatch) => void;
  onSnooze: (to: 'later' | 1 | 7) => void;
  onDecide: (d: Decision) => void;
  onForward: (f: Forward) => void;
  onAskCarla: (text: string) => void;
  onAnswerRequest: (approved: boolean, reply: string) => void;
  onAddSubtask: (s: NewSubtask) => void;
  notify: (text: string) => void;
}

const dueChoices: { label: string; value: number | null }[] = [{ label: 'Today', value: 0 }, { label: 'Tomorrow', value: 1 }, { label: 'Next week', value: 7 }, { label: 'No date', value: null }];
const prioChoices: (Priority | null)[] = ['High', 'Medium', 'Low', null];
const teamPeople = people.filter(p => p.id !== 'none' && p.id !== 'carla');

export function DetailScreen(props: Props) {
  const { task: t, all, role, me, myOwner, projects, onClose, onOpen, onPatch, onSnooze, onDecide, onForward, onAskCarla, onAnswerRequest, onAddSubtask, notify } = props;
  const manager = role === 'carla' || role === 'barbara';
  const isMine = myOwner !== null && t.owner === myOwner;
  const chat = useComments(t.id, me);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [fwd, setFwd] = useState<Forward>({ owner: t.owner === 'carla' ? 'fernanda' : 'carla', priority: t.priority, due: null, note: '' });
  const [asking, setAsking] = useState(false);
  const [ask, setAsk] = useState(''); const [askLink, setAskLink] = useState(''); const [askLinks, setAskLinks] = useState<string[]>([]);
  const [answering, setAnswering] = useState<null | boolean>(null); const [reply, setReply] = useState('');
  const [addingSub, setAddingSub] = useState(false);
  const [sub, setSub] = useState<NewSubtask>({ title: '', owner: t.owner === 'none' ? 'fernanda' : t.owner, ownerName: null, due: null });
  const [external, setExternal] = useState('');
  const [depSearch, setDepSearch] = useState(''); const [addingDep, setAddingDep] = useState(false);
  const [waiting, setWaiting] = useState(t.waitingOn || '');

  const pendingDecision = manager && !!t.draft && !t.completed && (t.review === 'Pending review' || t.review === null);
  const pendingRequest = manager && t.teamReview === 'Requested';
  const gmail = () => { if (t.gmail) window.open(t.gmail, '_blank', 'noopener'); else notify('No Gmail link on this item'); };
  const subtasks = all.filter(x => x.parentId === t.id);
  const parent = t.parentId ? all.find(x => x.id === t.parentId) : undefined;
  const deps = (t.dependsOn || []).map(id => all.find(x => x.id === id)).filter((x): x is Task => !!x);
  const blocked = isBlocked(t, all);
  const canStructure = manager || isMine;

  const rejectNow = () => { if (!reason.trim()) { notify('Say why it is rejected'); return; } onDecide({ kind: 'reject', reason: reason.trim() }); setRejecting(false); setReason(''); };
  const rejectByVoice = async (blob: Blob, name: string) => { const ok = await chat.upload('voice', blob, name, 'Rejected — reason in this voice note'); if (ok) { onDecide({ kind: 'reject', reason: '(reason recorded as a voice note in the conversation)' }); setRejecting(false); } };
  const sendAsk = () => { const text = ask.trim(); if (!text) { notify('Write what you want Carla to confirm'); return; } onAskCarla(askLinks.length ? `${text}\n\nLinks:\n${askLinks.join('\n')}` : text); setAsking(false); setAsk(''); setAskLinks([]); };
  const addLink = () => { const v = askLink.trim(); if (!v) return; setAskLinks(l => [...l, /^https?:\/\//i.test(v) ? v : 'https://' + v]); setAskLink(''); };
  const submitSub = () => { if (!sub.title.trim()) { notify('Give the subtask a title'); return; } onAddSubtask({ ...sub, title: sub.title.trim(), ownerName: external.trim() || null, owner: external.trim() ? 'none' : sub.owner }); setAddingSub(false); setSub({ ...sub, title: '' }); setExternal(''); };
  const depCandidates = depSearch.trim().length < 2 ? [] : all.filter(x => x.id !== t.id && !x.completed && !(t.dependsOn || []).includes(x.id) && (taskTitle(x) + ' ' + x.action + ' ' + x.subject).toLowerCase().includes(depSearch.toLowerCase())).slice(0, 6);

  return (
    <div className="detail">
      <div className="detail-top">
        <div className="icon-btn" onClick={onClose} aria-label="Back"><BackIcon /></div>
        <span className="eyebrow">{t.category}</span>
        <div className="spacer-40" />
      </div>
      <div className="detail-scroll scroll">
        {parent && <div className="parent-link" onClick={() => onOpen(parent.id)}>Part of: <b>{taskTitle(parent)}</b></div>}
        <h1 className="detail-title">{taskTitle(t)}</h1>
        {t.title && t.action !== taskTitle(t) && <div className="detail-action">{t.action}</div>}
        {t.subject !== t.action && <div className="detail-subject">{t.subject}</div>}
        <div className="detail-tags"><TaskTags task={t} all={all} /></div>

        {t.teamReview && (
          <div className={`request-card is-${t.teamReview.toLowerCase()}`}>
            <div className="eyebrow">{t.teamReview === 'Requested' ? `${t.requestedBy || 'Someone'} asks Carla` : t.teamReview === 'Approved' ? 'Carla approved' : 'Carla said no'}</div>
            {t.reviewRequest && <div className="request-text">{t.reviewRequest}</div>}
            {t.reviewReply && <div className="request-reply"><b>Carla:</b> {t.reviewReply}</div>}
            {pendingRequest && answering === null && (
              <div className="btn-row"><div className="btn btn-ink" onClick={() => setAnswering(true)}>Approve</div><div className="btn btn-white" onClick={() => setAnswering(false)}>No</div></div>
            )}
            {pendingRequest && answering !== null && (
              <>
                <textarea className="textarea feedback-textarea" placeholder={answering ? 'Optional note…' : 'Why not? (required)'} value={reply} onChange={e => setReply(e.target.value)} />
                <div className="btn-row">
                  <div className="btn btn-ink" onClick={() => { if (!answering && !reply.trim()) { notify('Say why'); return; } onAnswerRequest(answering, reply.trim()); setAnswering(null); setReply(''); }}>{answering ? 'Send approval' : 'Send answer'}</div>
                  <div className="btn btn-white" onClick={() => setAnswering(null)}>Cancel</div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="sender">
          <div className="sender-who">
            <span className="sender-name">{t.from || 'Unknown sender'}</span>
            {t.senderEmail && <a className="sender-email" href={`mailto:${t.senderEmail}`}>{t.senderEmail}</a>}
          </div>
          {t.gmail && <div className="btn btn-white btn-sm" onClick={gmail}>Open in Gmail</div>}
        </div>

        <FieldEditor task={t} editable={manager} dueEditable={manager || isMine} projects={projects} onPatch={onPatch} />

        {t.summary && (<><div className="eyebrow">Summary</div><div className="detail-summary">{t.summary}</div></>)}

        {(t.deliverable || t.hasAttachments || (t.files && t.files.length > 0)) && (
          <>
            <div className="eyebrow">Files</div>
            <div className="files-card">
              {t.deliverable && <div className="files-ask"><b>To deliver:</b> {t.deliverable}</div>}
              {t.hasAttachments && <div className="files-note">The original email has attachments. <span className="link" onClick={gmail}>Open it in Gmail</span> to see them.</div>}
              {t.files && t.files.length > 0 && <div className="files-list">{t.files.map((f, i) => <a key={i} className="file-chip" href={f.url} target="_blank" rel="noopener">{f.name}</a>)}</div>}
              {chat.available && <label className="btn btn-white btn-sm files-attach">Attach a file<input type="file" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const ok = await chat.upload('deliverable', f, f.name); notify(ok ? 'File saved to the task' : 'Upload failed'); } e.target.value = ''; }} /></label>}
            </div>
          </>
        )}

        {t.draft && (<><div className="eyebrow">Proposed response</div><div className="draft-card">{t.draft}</div></>)}
        {t.feedback && (<><div className="eyebrow">Carla's feedback</div><div className="feedback-box">{t.feedback}</div></>)}

        {/* ---- structure: subtasks and dependencies ---- */}
        <div className="eyebrow">Subtasks{subtasks.length ? ` · ${subtasks.length}` : ''}</div>
        <div className="struct-card">
          {subtasks.length === 0 && !addingSub && !(t.subtaskIds || []).length && <div className="files-note">No subtasks yet.</div>}
          {(t.subtaskIds || []).filter(id => !all.some(x => x.id === id)).length > 0 && <div className="files-note">{(t.subtaskIds || []).filter(id => !all.some(x => x.id === id)).length} more with other people or already done.</div>}
          {subtasks.map(s => (
            <div key={s.id} className={`struct-row${s.completed ? ' is-done' : ''}`} onClick={() => onOpen(s.id)}>
              <span className={`check mini${s.completed ? ' is-checked' : ''}`} />
              <span className="struct-title">{taskTitle(s)}</span>
              <span className="struct-who">{s.owner === 'none' ? (s.ownerName || '') : person(s.owner).short}</span>
            </div>
          ))}
          {canStructure && !addingSub && <div className="link" onClick={() => setAddingSub(true)}>+ Add a subtask</div>}
          {addingSub && (
            <div className="struct-form">
              <input className="field-input" placeholder="What needs to happen…" value={sub.title} onChange={e => setSub({ ...sub, title: e.target.value })} />
              <span className="field-label">Who</span>
              <div className="chip-row">
                {teamPeople.map(p => <div key={p.id} className={`sheet-chip has-avatar${!external && sub.owner === p.id ? ' is-active' : ''}`} onClick={() => { setExternal(''); setSub({ ...sub, owner: p.id }); }}><Avatar person={p} size={18} fs={9} /><span>{p.short}</span></div>)}
                <div className={`sheet-chip has-avatar${!external && sub.owner === 'carla' ? ' is-active' : ''}`} onClick={() => { setExternal(''); setSub({ ...sub, owner: 'carla' }); }}><Avatar person={person('carla')} size={18} fs={9} /><span>Carla</span></div>
              </div>
              <input className="field-input" placeholder="…or someone outside the team (name)" value={external} onChange={e => setExternal(e.target.value)} />
              <span className="field-label">Due</span>
              <div className="chip-row">{dueChoices.map(d => <div key={d.label} className={`sheet-chip${sub.due === d.value ? ' is-active' : ''}`} onClick={() => setSub({ ...sub, due: d.value })}>{d.label}</div>)}</div>
              <div className="btn-row"><div className="btn btn-ink" onClick={submitSub}>Add subtask</div><div className="btn btn-white" onClick={() => setAddingSub(false)}>Cancel</div></div>
            </div>
          )}
        </div>

        <div className="eyebrow">Depends on{blocked ? ' · blocked' : ''}</div>
        <div className="struct-card">
          {deps.length === 0 && !t.waitingOn && !addingDep && <div className="files-note">Nothing. This task can go ahead.</div>}
          {deps.map(d => (
            <div key={d.id} className={`struct-row${d.completed ? ' is-done' : ''}`}>
              <span className={`check mini${d.completed ? ' is-checked' : ''}`} onClick={() => onOpen(d.id)} />
              <span className="struct-title" onClick={() => onOpen(d.id)}>{taskTitle(d)}</span>
              {canStructure && <span className="struct-x" onClick={() => onPatch({ dependsOn: (t.dependsOn || []).filter(x => x !== d.id) })}>×</span>}
            </div>
          ))}
          {t.waitingOn && !addingDep && (
            <div className="struct-row is-external"><span className="check mini" /><span className="struct-title">Waiting on: {t.waitingOn}</span>{canStructure && <span className="struct-x" onClick={() => { onPatch({ waitingOn: null }); setWaiting(''); }}>×</span>}</div>
          )}
          {canStructure && !addingDep && <div className="link" onClick={() => setAddingDep(true)}>+ Add a dependency</div>}
          {addingDep && (
            <div className="struct-form">
              <span className="field-label">Another task</span>
              <input className="field-input" placeholder="Search open tasks…" value={depSearch} onChange={e => setDepSearch(e.target.value)} />
              {depCandidates.map(c => <div key={c.id} className="struct-row" onClick={() => { onPatch({ dependsOn: [...(t.dependsOn || []), c.id] }); setDepSearch(''); setAddingDep(false); }}><span className="check mini" /><span className="struct-title">{taskTitle(c)}</span><span className="struct-who">{c.owner === 'none' ? '' : person(c.owner).short}</span></div>)}
              <span className="field-label">Or something outside the app</span>
              <input className="field-input" placeholder="e.g. Fulana's answer about the flight" value={waiting} onChange={e => setWaiting(e.target.value)} />
              <div className="btn-row"><div className="btn btn-ink" onClick={() => { onPatch({ waitingOn: waiting.trim() || null }); setAddingDep(false); }}>Save</div><div className="btn btn-white" onClick={() => setAddingDep(false)}>Cancel</div></div>
            </div>
          )}
        </div>

        {/* ---- decisions (LOLI drafts) ---- */}
        {pendingDecision && !rejecting && (
          <div className="decide">
            <div className="btn btn-ink btn-big" onClick={() => onDecide({ kind: 'approve' })}>Approve</div>
            <div className="btn-row"><div className="btn btn-white" onClick={() => setRejecting(true)}>Reject</div><div className="btn btn-white" onClick={() => onDecide({ kind: 'resolved' })}>I did it myself</div></div>
          </div>
        )}
        {rejecting && (
          <div className="decide">
            <div className="eyebrow">Why is it rejected?</div>
            <textarea className="textarea feedback-textarea" placeholder="What is wrong or missing…" value={reason} onChange={e => setReason(e.target.value)} />
            <div className="btn-row"><div className="btn btn-ink" onClick={rejectNow}>Send rejection</div><div className="btn btn-white" onClick={() => setRejecting(false)}>Cancel</div></div>
            <span className="chat-note">Or record the reason as a voice note below and it will be attached to the rejection.</span>
          </div>
        )}

        {/* ---- team: ask Carla ---- */}
        {!manager && !t.completed && t.teamReview !== 'Requested' && !asking && (
          <div className="btn btn-white btn-big-soft" style={{ marginTop: 18 }} onClick={() => setAsking(true)}>Ask Carla to confirm</div>
        )}
        {asking && (
          <div className="forward">
            <div className="eyebrow">What do you want Carla to confirm?</div>
            <textarea className="textarea feedback-textarea" placeholder="e.g. Can I buy the three sofas from supplier X for $4,200?" value={ask} onChange={e => setAsk(e.target.value)} />
            <div className="link-row">
              <input className="field-input" placeholder="Paste a link (optional)" value={askLink} onChange={e => setAskLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
              <div className="btn btn-white btn-sm" onClick={addLink}>Add link</div>
            </div>
            {askLinks.length > 0 && <div className="files-list">{askLinks.map((l, i) => <span key={i} className="file-chip">{l}</span>)}</div>}
            {chat.available && <label className="btn btn-white btn-sm files-attach">Attach photo or file<input type="file" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const ok = await chat.upload('deliverable', f, f.name); notify(ok ? `${f.name} attached` : 'Upload failed'); } e.target.value = ''; }} /></label>}
            <div className="btn-row"><div className="btn btn-ink" onClick={sendAsk}>Send to Carla</div><div className="btn btn-white" onClick={() => setAsking(false)}>Cancel</div></div>
          </div>
        )}

        {/* ---- forward / delegate ---- */}
        {!t.completed && !forwarding && (manager || isMine) && (
          <div className="btn-row" style={{ marginTop: 18 }}>
            <div className="btn btn-white" onClick={() => { setFwd({ owner: manager ? (t.owner === 'carla' ? 'fernanda' : 'carla') : teamPeople.find(p => p.id !== t.owner)?.id || 'fernanda', priority: t.priority, due: null, note: '' }); setForwarding(true); }}>{manager ? 'Forward to someone' : 'Delegate to a teammate'}</div>
            {!pendingDecision && role === 'carla' && <div className="btn btn-white" onClick={() => onDecide({ kind: 'resolved' })}>I did it myself</div>}
          </div>
        )}
        {forwarding && (
          <div className="forward">
            <div className="eyebrow">{manager ? 'Forward to' : 'Delegate to'}</div>
            <div className="chip-row">
              {(manager ? people.filter(p => p.id !== 'none') : teamPeople).filter(p => p.id !== t.owner).map(p => (
                <div key={p.id} className={`sheet-chip has-avatar${fwd.owner === p.id ? ' is-active' : ''}`} onClick={() => setFwd({ ...fwd, owner: p.id })}><Avatar person={p} size={18} fs={9} /><span>{p.short}</span></div>
              ))}
            </div>
            {manager && (<><div className="eyebrow">Priority</div><div className="chip-row">{prioChoices.map(p => <div key={String(p)} className={`sheet-chip${fwd.priority === p ? ' is-active' : ''}`} onClick={() => setFwd({ ...fwd, priority: p })}>{p || 'None'}</div>)}</div></>)}
            <div className="eyebrow">Due</div>
            <div className="chip-row">{dueChoices.map(d => <div key={d.label} className={`sheet-chip${fwd.due === d.value ? ' is-active' : ''}`} onClick={() => setFwd({ ...fwd, due: d.value })}>{d.label}</div>)}</div>
            <textarea className="textarea feedback-textarea" placeholder="Add a note for them…" value={fwd.note} onChange={e => setFwd({ ...fwd, note: e.target.value })} />
            <div className="btn-row"><div className="btn btn-ink" onClick={() => { onForward(fwd); setForwarding(false); }}>{manager ? 'Forward' : 'Delegate'}</div><div className="btn btn-white" onClick={() => setForwarding(false)}>Cancel</div></div>
          </div>
        )}

        {manager && (
          <Chat comments={chat.comments} loading={chat.loading} error={chat.error} busy={chat.busy} available={chat.available} me={me}
            onSend={chat.send}
            onVoice={(blob, name) => { if (rejecting) rejectByVoice(blob, name); else chat.upload('voice', blob, name); }}
            onAttach={async f => { const ok = await chat.upload('deliverable', f, f.name, `📎 ${f.name}`); if (!ok) notify('Upload failed'); }}
            attachLabel={t.deliverable ? 'Attach the requested file' : 'Attach a file'} />
        )}
      </div>
      <div className="detail-bottom">
        {(manager || isMine) && (
          <div className="btn-row">
            <div className="btn btn-white" onClick={() => onSnooze('later')}>Later today</div>
            <div className="btn btn-white" onClick={() => onSnooze(1)}>Tomorrow</div>
            <div className="btn btn-white" onClick={() => onSnooze(7)}>Next week</div>
          </div>
        )}
        {t.completed
          ? <div className="btn btn-ink btn-big" onClick={() => onDecide({ kind: 'reopen' })}>Reopen</div>
          : <div className="btn btn-ink btn-big" onClick={() => onDecide({ kind: 'complete' })}>{role === 'barbara' ? 'Done — mark completed' : 'Mark completed'}</div>}
      </div>
    </div>
  );
}
// keep helpers referenced for future use
void addDays; void iso; void dueLabel;
