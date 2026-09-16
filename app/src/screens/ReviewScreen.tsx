import { useState } from 'react';
import { Logo } from '../components/Logo';
import { ReviewPill } from '../components/ReviewPill';
import type { Mode, Task } from '../lib/types';
import '../styles/review.css';

interface CardUi { expanded?: boolean; editing?: boolean; draftEdit?: string; asking?: 'changes' | 'barbara' | null; feedbackEdit?: string }

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
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  pendingCount?: number;
}

export function ReviewScreen({ mode, cards, decided, onApprove, onChanges, onBarbara, onSaveDraft, onComplete, onOpen, onSettings, notify, loading = false, error = null, onRetry, pendingCount = 0 }: Props) {
  const carla = mode === 'carla';
  const [ui, setUi] = useState<Record<string, CardUi>>({});
  const set = (id: string, patch: CardUi) => setUi(u => ({ ...u, [id]: { ...(u[id] || {}), ...patch } }));
  const countLabel = carla
    ? `${cards.length} ${cards.length === 1 ? 'proposal' : 'proposals'} waiting for you`
    : `${cards.length} ${cards.length === 1 ? 'item' : 'items'} approved or handed to you`;

  return (
    <div className="page scroll review-page">
      <button type="button" className="review-logo-button" onClick={onSettings} aria-label="Open settings"><Logo /></button>
      <h1 className="h1">{carla ? 'Review.' : 'Handoff.'}</h1>
      <div className="subline">{loading ? 'Loading your items…' : error ? 'Your inbox needs a refresh' : countLabel}</div>
      {carla && <p className="review-intro">Read the summary and proposal. Barbara handles what you approve.</p>}

      {error && (
        <div className="review-status is-error" role="alert">
          <div><strong>We couldn’t refresh your inbox.</strong><p>{error}</p>{cards.length > 0 && <p>These items may be out of date.</p>}</div>
          {onRetry && <button type="button" className="btn btn-white btn-sm" onClick={onRetry} disabled={loading}>Try again</button>}
        </div>
      )}
      {loading && <div className="review-status" role="status">{cards.length ? 'Refreshing your items…' : 'Getting your latest items…'}</div>}
      {pendingCount > 0 && (
        <div className="review-status is-pending" role="status">
          {pendingCount} {pendingCount === 1 ? 'change is' : 'changes are'} waiting to sync. Keep this page open when you’re back online.
        </div>
      )}
      {!loading && !error && cards.length === 0 && (
        <div className="review-empty" role="status">
          {pendingCount > 0 ? 'Your changes are waiting to sync.' : carla ? 'Nothing to review.' : 'Nothing handed off yet.'}
        </div>
      )}

      <div className="review-list" aria-busy={loading}>
        {cards.map(t => {
          const u = ui[t.id] || {};
          const hasDraft = !!t.draft?.trim();
          const long = (t.draft || '').length > 420;
          const clamped = long && !u.expanded;
          const showActions = !u.editing && !u.asking;
          const draftId = `review-draft-${t.id}`;
          const feedbackId = `review-feedback-${t.id}`;
          return (
            <article key={t.id} className="review-card" aria-labelledby={`review-title-${t.id}`}>
              <div className="review-top">
                <ReviewPill review={t.review} large fallback={hasDraft ? 'Draft ready' : 'Awaiting draft'} />
                {t.from && <span className="review-from">{t.from}</span>}
              </div>
              <h2 id={`review-title-${t.id}`} className="review-subject">{t.subject || t.action}</h2>
              {t.action && t.action !== t.subject && <div className="review-action">{t.action}</div>}

              {t.summary && (
                <section className="review-summary" aria-labelledby={`review-summary-${t.id}`}>
                  <h3 id={`review-summary-${t.id}`} className="eyebrow">Summary</h3>
                  <p>{t.summary}</p>
                </section>
              )}
              {t.feedback && <div className="feedback-box"><b>Carla’s feedback: </b>{t.feedback}</div>}

              <section className="review-proposal" aria-labelledby={`review-proposal-${t.id}`}>
                <h3 id={`review-proposal-${t.id}`} className="eyebrow">Proposed response</h3>
                {u.editing ? (
                  <form className="review-form" onSubmit={e => {
                    e.preventDefault();
                    onSaveDraft(t.id, u.draftEdit ?? t.draft ?? '');
                    set(t.id, { editing: false });
                  }}>
                    <label className="review-field-label" htmlFor={draftId}>Edit the proposed response</label>
                    <textarea id={draftId} className="textarea draft-textarea" autoFocus value={u.draftEdit ?? t.draft ?? ''} onChange={e => set(t.id, { draftEdit: e.target.value })} />
                    <div className="btn-row">
                      <button type="submit" className="btn btn-ink">Save draft</button>
                      <button type="button" className="btn btn-white" onClick={() => set(t.id, { editing: false })}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div id={draftId} className={`draft${clamped ? ' is-clamped' : ''}`}>{hasDraft ? t.draft : 'No proposed response yet.'}</div>
                    {long && <button type="button" className="review-text-button" aria-expanded={!!u.expanded} aria-controls={draftId} onClick={() => set(t.id, { expanded: !u.expanded })}>{u.expanded ? 'Show less' : 'Read full response'}</button>}
                  </>
                )}
                {t.limitation && <div className="limitation">{t.limitation}</div>}
              </section>

              {u.asking && (
                <form className="review-form review-feedback-form" onSubmit={e => {
                  e.preventDefault();
                  const fb = (u.feedbackEdit || '').trim();
                  if (u.asking === 'changes' && !fb) { notify('Say what should change'); return; }
                  if (u.asking === 'barbara') onBarbara(t.id, fb); else onChanges(t.id, fb);
                  set(t.id, { asking: null, feedbackEdit: '' });
                }}>
                  <label className="review-field-label" htmlFor={feedbackId}>{u.asking === 'barbara' ? 'A note for Barbara (optional)' : 'What would you like changed?'}</label>
                  <textarea id={feedbackId} className="textarea feedback-textarea" autoFocus required={u.asking === 'changes'} placeholder={u.asking === 'barbara' ? 'Add any context she needs…' : 'Tell us what to adjust…'} value={u.feedbackEdit || ''} onChange={e => set(t.id, { feedbackEdit: e.target.value })} />
                  <div className="btn-row">
                    <button type="submit" className="btn btn-ink">{u.asking === 'barbara' ? 'Hand to Barbara' : 'Request changes'}</button>
                    <button type="button" className="btn btn-white" onClick={() => set(t.id, { asking: null })}>Cancel</button>
                  </div>
                </form>
              )}

              {showActions && (
                <>
                  {carla ? (
                    <div className="review-actions">
                      <button type="button" className="btn btn-ink" disabled={!hasDraft} onClick={() => onApprove(t.id)}>Approve</button>
                      <button type="button" className="btn btn-white" onClick={() => set(t.id, { asking: 'changes', editing: false })}>Request changes</button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-ink review-complete" onClick={() => onComplete(t.id)}>Mark completed</button>
                  )}
                  <details className="review-more">
                    <summary>More options</summary>
                    <div className="review-more-actions">
                      {carla && <button type="button" onClick={() => set(t.id, { asking: 'barbara', editing: false })}>Hand to Barbara</button>}
                      {carla && <button type="button" onClick={() => set(t.id, { editing: true, draftEdit: t.draft || '', asking: null })}>Edit draft</button>}
                      {t.gmail && <a href={t.gmail} target="_blank" rel="noopener noreferrer">Open in Gmail</a>}
                      <button type="button" onClick={() => onOpen(t.id)}>View task details</button>
                    </div>
                  </details>
                </>
              )}
            </article>
          );
        })}
      </div>

      {decided.length > 0 && (
        <details className="review-history">
          <summary>Previous decisions <span>{decided.length}</span></summary>
          <div className="rows">
            {decided.map(t => (
              <button type="button" key={t.id} className="decided-row" onClick={() => onOpen(t.id)}>
                <ReviewPill review={t.review} />
                <span className="decided-subject">{t.subject || t.action}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
