import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { Chat } from '../components/Chat';
import { BackIcon } from '../components/Icons';
import { TaskTags } from '../components/TaskTags';
import { FieldEditor } from '../components/FieldEditor';
import { people } from '../lib/people';
import type { OwnerId, Priority, Role, Task, TaskPatch } from '../lib/types';
import { useComments } from '../store/useComments';

export interface Decision { kind: 'approve' | 'reject' | 'resolved' | 'complete' | 'reopen'; reason?: string }
export interface Forward { owner: OwnerId; priority: Priority | null; due: number | null; note: string }

interface Props {
  task: Task;
  role: Role;
  me: string;
  projects: string[];
  onClose: () => void;
  onPatch: (p: TaskPatch) => void;
  onSnooze: (to: 'later' | 1 | 7) => void;
  onDecide: (d: Decision) => void;
  onForward: (f: Forward) => void;
  notify: (text: string) => void;
}

const dueChoices: { label: string; value: number | null }[] = [{ label: 'Today', value: 0 }, { label: 'Tomorrow', value: 1 }, { label: 'Next week', value: 7 }, { label: 'No date', value: null }];
const prioChoices: (Priority | null)[] = ['High', 'Medium', 'Low', null];

export function DetailScreen({ task: t, role, me, projects, onClose, onPatch, onSnooze, onDecide, onForward, notify }: Props) {
  const manager = role === 'carla' || role === 'barbara';
  const chat = useComments(t.id, me);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [forwarding, setForwarding] = useState(false);
  const [fwd, setFwd] = useState<Forward>({ owner: t.owner === 'carla' ? 'fernanda' : 'carla', priority: t.priority, due: null, note: '' });

  const pendingDecision = !!t.draft && !t.completed && (t.review === 'Pending review' || t.review === null);
  const canDecide = role === 'carla' || role === 'barbara';
  const gmail = () => { if (t.gmail) window.open(t.gmail, '_blank', 'noopener'); else notify('No Gmail link on this item'); };
  const rejectNow = () => {
    if (!reason.trim()) { notify('Say why it is rejected'); return; }
    onDecide({ kind: 'reject', reason: reason.trim() }); setRejecting(false); setReason('');
  };
  const rejectByVoice = async (blob: Blob, name: string) => {
    const ok = await chat.upload('voice', blob, name, 'Rejected — reason in this voice note');
    if (ok) { onDecide({ kind: 'reject', reason: '(reason recorded as a voice note in the conversation)' }); setRejecting(false); }
  };

  return (
    <div className="detail">
      <div className="detail-top">
        <div className="icon-btn" onClick={onClose} aria-label="Back"><BackIcon /></div>
        <span className="eyebrow">{t.category}</span>
        <div className="spacer-40" />
      </div>
      <div className="detail-scroll scroll">
        <h1 className="detail-title">{t.action}</h1>
        <div className="detail-subject">{t.subject}</div>
        <div className="detail-tags"><TaskTags task={t} /></div>

        <div className="sender">
          <div className="sender-who">
            <span className="sender-name">{t.from || 'Unknown sender'}</span>
            {t.senderEmail && <a className="sender-email" href={`mailto:${t.senderEmail}`}>{t.senderEmail}</a>}
          </div>
          <div className="btn btn-white btn-sm" onClick={gmail}>Open in Gmail</div>
        </div>

        <FieldEditor task={t} editable={manager} projects={projects} onPatch={onPatch} />

        <div className="eyebrow">Summary</div>
        <div className="detail-summary">{t.summary || 'No summary.'}</div>

        {(t.deliverable || t.hasAttachments || (t.files && t.files.length > 0)) && (
          <>
            <div className="eyebrow">Files</div>
            <div className="files-card">
              {t.deliverable && <div className="files-ask"><b>To deliver:</b> {t.deliverable}</div>}
              {t.hasAttachments && <div className="files-note">The original email has attachments. <span className="link" onClick={gmail}>Open it in Gmail</span> to see them.</div>}
              {t.files && t.files.length > 0 && (
                <div className="files-list">
                  {t.files.map((f, i) => <a key={i} className="file-chip" href={f.url} target="_blank" rel="noopener">{f.name}</a>)}
                </div>
              )}
              {chat.available && <label className="btn btn-white btn-sm files-attach">Attach a file<input type="file" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) { const ok = await chat.upload('deliverable', f, f.name); notify(ok ? 'File saved to the task' : 'Upload failed'); } e.target.value = ''; }} /></label>}
            </div>
          </>
        )}

        {t.draft && (
          <>
            <div className="eyebrow">Proposed response</div>
            <div className="draft-card">{t.draft}</div>
          </>
        )}
        {t.feedback && (
          <>
            <div className="eyebrow">Carla's feedback</div>
            <div className="feedback-box">{t.feedback}</div>
          </>
        )}

        {canDecide && pendingDecision && !rejecting && (
          <div className="decide">
            <div className="btn btn-ink btn-big" onClick={() => onDecide({ kind: 'approve' })}>Approve</div>
            <div className="btn-row">
              <div className="btn btn-white" onClick={() => setRejecting(true)}>Reject</div>
              <div className="btn btn-white" onClick={() => onDecide({ kind: 'resolved' })}>I did it myself</div>
            </div>
          </div>
        )}
        {rejecting && (
          <div className="decide">
            <div className="eyebrow">Why is it rejected?</div>
            <textarea className="textarea feedback-textarea" placeholder="What is wrong or missing…" value={reason} onChange={e => setReason(e.target.value)} />
            <div className="btn-row">
              <div className="btn btn-ink" onClick={rejectNow}>Send rejection</div>
              <div className="btn btn-white" onClick={() => setRejecting(false)}>Cancel</div>
            </div>
            <span className="chat-note">Or record the reason as a voice note below and it will be attached to the rejection.</span>
          </div>
        )}

        {!manager && !t.completed && <div className="chat-note" style={{ marginTop: 18 }}>Need this changed, moved, or handed to someone else? Say so in the conversation below and Barbara will sort it out.</div>}
        {manager && !forwarding ? (
          <div className="btn-row" style={{ marginTop: 18 }}>
            <div className="btn btn-white" onClick={() => setForwarding(true)}>Forward to someone</div>
            {!pendingDecision && role === 'carla' && !t.completed && <div className="btn btn-white" onClick={() => onDecide({ kind: 'resolved' })}>I did it myself</div>}
          </div>
        ) : manager ? (
          <div className="forward">
            <div className="eyebrow">Forward to</div>
            <div className="chip-row">
              {people.filter(p => p.id !== 'none' && p.id !== t.owner).map(p => (
                <div key={p.id} className={`sheet-chip has-avatar${fwd.owner === p.id ? ' is-active' : ''}`} onClick={() => setFwd({ ...fwd, owner: p.id })}><Avatar person={p} size={18} fs={9} /><span>{p.short}</span></div>
              ))}
            </div>
            <div className="eyebrow">Priority</div>
            <div className="chip-row">{prioChoices.map(p => <div key={String(p)} className={`sheet-chip${fwd.priority === p ? ' is-active' : ''}`} onClick={() => setFwd({ ...fwd, priority: p })}>{p || 'None'}</div>)}</div>
            <div className="eyebrow">Due</div>
            <div className="chip-row">{dueChoices.map(d => <div key={d.label} className={`sheet-chip${fwd.due === d.value ? ' is-active' : ''}`} onClick={() => setFwd({ ...fwd, due: d.value })}>{d.label}</div>)}</div>
            <textarea className="textarea feedback-textarea" placeholder="Add a note for them…" value={fwd.note} onChange={e => setFwd({ ...fwd, note: e.target.value })} />
            <div className="btn-row">
              <div className="btn btn-ink" onClick={() => { onForward(fwd); setForwarding(false); }}>Forward</div>
              <div className="btn btn-white" onClick={() => setForwarding(false)}>Cancel</div>
            </div>
          </div>
        ) : null}

        <Chat comments={chat.comments} loading={chat.loading} error={chat.error} busy={chat.busy} available={chat.available} me={me}
          onSend={chat.send}
          onVoice={(blob, name) => { if (rejecting) rejectByVoice(blob, name); else chat.upload('voice', blob, name); }}
          onAttach={async f => { const ok = await chat.upload('deliverable', f, f.name, `📎 ${f.name}`); if (!ok) notify('Upload failed'); }}
          attachLabel={t.deliverable ? 'Attach the requested file' : 'Attach a file'} />
      </div>
      <div className="detail-bottom">
        {manager && (
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
