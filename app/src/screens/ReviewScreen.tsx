import { useState } from 'react';
import { Logo } from '../components/Logo';
import { ReviewPill } from '../components/ReviewPill';
import type { Mode, Task } from '../lib/types';

interface CardUi { summary?: boolean; expanded?: boolean; editing?: boolean; draftEdit?: string; asking?: 'changes' | 'barbara' | null; feedbackEdit?: string }

interface Props {
  mode: Mode;
  cards: Task[];
  decided: Task[];
  onApprove: (id: string) => void;
  onChanges: (id: string, feedback: string) => void;
  onBarbara: (id: string, feedback: string) => void;
  onSaveDraft: (id: string, draft: string) => void;
  onComplete: (id: string) => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
  notify: (text: string) => void;
}

export function ReviewScreen({ mode, cards, decided, onApprove, onChanges, onBarbara, onSaveDraft, onComplete, onOpen, onSettings, notify }: Props) {
  const carla = mode === 'carla';
  const [ui, setUi] = useState<Record<string, CardUi>>({});
  const set = (id: string, patch: CardUi) => setUi(u => ({ ...u, [id]: { ...(u[id] || {}), ...patch } }));

  return (
    <div className="page scroll">
      <Logo onClick={onSettings} />
      <h1 className="h1">{carla ? 'Review.' : 'Handoff.'}</h1>
      <div className="subline">{carla ? `${cards.length} drafts waiting for you` : `${cards.length} approved or handed to you`}</div>
      {cards.length === 0 && <div className="review-empty">{carla ? 'Nothing to review.' : 'Nothing handed off yet.'}</div>}
      <div className="review-list">
        {cards.map(t => {
          const u = ui[t.id] || {};
          const long = (t.draft || '').length > 420;
          const clamped = long && !u.expanded;
          const showActions = !u.editing && !u.asking;
          const openGmail = () => { if (t.gmail) window.open(t.gmail, '_blank', 'noopener'); else notify('No Gmail link on this item'); };
          return (
            <div key={t.id} className="review-card">
              <div className="review-top">
                <ReviewPill review={t.review} large fallback="Draft" />
                <span className="review-from">{t.from}</span>
              </div>
              <div className="review-subject">{t.subject}</div>
              <div className="review-action">{t.action}</div>
              {u.summary && <div className="summary-box">{t.summary}</div>}
              {t.feedback && <div className="feedback-box"><b>Carla: </b>{t.feedback}</div>}
              <div className="eyebrow">Draft by LOLI</div>

              {u.editing ? (
                <>
                  <textarea className="textarea draft-textarea" value={u.draftEdit ?? t.draft ?? ''} onChange={e => set(t.id, { draftEdit: e.target.value })} />
                  <div className="btn-row">
                    <div className="btn btn-ink" onClick={() => { onSaveDraft(t.id, u.draftEdit ?? t.draft ?? ''); set(t.id, { editing: false }); }}>Save draft</div>
                    <div className="btn btn-white" onClick={() => set(t.id, { editing: false })}>Cancel</div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`draft${clamped ? ' is-clamped' : ''}`}>{t.draft || 'No draft yet — LOLI has not proposed a response.'}</div>
                  {long && <span className="link" style={{ alignSelf: 'flex-start' }} onClick={() => set(t.id, { expanded: !u.expanded })}>{u.expanded ? 'Show less' : 'Show more'}</span>}
                  {t.limitation && !u.expanded && <div className="limitation">{t.limitation}</div>}
                </>
              )}

              {u.asking && (
                <>
                  <textarea className="textarea feedback-textarea" placeholder="What should change?" value={u.feedbackEdit || ''} onChange={e => set(t.id, { feedbackEdit: e.target.value })} />
                  <div className="btn-row">
                    <div className="btn btn-ink" onClick={() => {
                      const fb = (u.feedbackEdit || '').trim();
                      if (u.asking === 'changes' && !fb) { notify('Say what should change'); return; }
                      if (u.asking === 'barbara') onBarbara(t.id, fb); else onChanges(t.id, fb);
                      set(t.id, { asking: null, feedbackEdit: '' });
                    }}>{u.asking === 'barbara' ? 'Hand to Barbara' : 'Send to LOLI'}</div>
                    <div className="btn btn-white" onClick={() => set(t.id, { asking: null })}>Cancel</div>
                  </div>
                </>
              )}

              {showActions && (
                <>
                  {carla ? (
                    <div className="review-actions">
                      <div className="btn btn-ink" onClick={() => onApprove(t.id)}>Approve</div>
                      <div className="btn btn-white" onClick={() => set(t.id, { asking: 'changes', editing: false })}>Changes</div>
                      <div className="btn btn-white" onClick={() => set(t.id, { asking: 'barbara', editing: false })}>To Barbara</div>
                    </div>
                  ) : (
                    <div className="btn btn-ink review-complete" onClick={() => onComplete(t.id)}>Mark completed</div>
                  )}
                  <div className="review-links">
                    {carla && <span onClick={() => set(t.id, { editing: true, draftEdit: t.draft || '', asking: null })}>Edit draft</span>}
                    <span onClick={() => set(t.id, { summary: !u.summary })}>{u.summary ? 'Hide summary' : 'Summary'}</span>
                    <span onClick={openGmail}>Open in Gmail</span>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {decided.length > 0 && (
        <>
          <div className="eyebrow section-label">Decided · {decided.length}</div>
          <div className="rows">
            {decided.map(t => (
              <div key={t.id} className="decided-row" onClick={() => onOpen(t.id)}>
                <ReviewPill review={t.review} />
                <div className="decided-subject">{t.subject}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
