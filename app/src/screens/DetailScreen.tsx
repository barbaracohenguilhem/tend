import { Avatar } from '../components/Avatar';
import { BackIcon } from '../components/Icons';
import { dueLabel } from '../lib/dates';
import { person } from '../lib/people';
import type { Task } from '../lib/types';

interface Props {
  task: Task;
  onClose: () => void;
  onCycleOwner: () => void;
  onCyclePriority: () => void;
  onCycleDue: () => void;
  onSnooze: (to: 'later' | 1 | 7) => void;
  onPrimary: () => void;
  notify: (text: string) => void;
}

export function DetailScreen({ task: t, onClose, onCycleOwner, onCyclePriority, onCycleDue, onSnooze, onPrimary, notify }: Props) {
  const owner = person(t.owner);
  return (
    <div className="detail">
      <div className="detail-top">
        <div className="icon-btn" onClick={onClose} aria-label="Back"><BackIcon /></div>
        <span className="eyebrow">{t.category}</span>
        <div className="spacer-40" />
      </div>
      <div className="detail-scroll scroll">
        <h1 className="detail-title">{t.action}</h1>
        <div className="detail-subject">{t.from} — {t.subject}</div>
        <div className="kv-card">
          <div className="kv-row with-avatar" onClick={onCycleOwner}>
            <span className="kv-key">Owner</span>
            <span className="kv-val"><Avatar person={owner} size={24} fs={10} /><span>{owner.short}</span></span>
          </div>
          <div className="kv-row" onClick={onCyclePriority}><span className="kv-key">Priority</span><span className="kv-val">{t.priority || 'None'}</span></div>
          <div className="kv-row" onClick={onCycleDue}><span className="kv-key">Due</span><span className="kv-val">{dueLabel(t)}</span></div>
          <div className="kv-row"><span className="kv-key">Review</span><span className="kv-val">{t.review || '—'}</span></div>
        </div>
        <div className="eyebrow">Summary</div>
        <div className="detail-summary">{t.summary || 'No summary.'}</div>
        {t.draft && (
          <>
            <div className="eyebrow">Draft by LOLI</div>
            <div className="draft-card">{t.draft}</div>
          </>
        )}
        <span className="link detail-gmail" onClick={() => { if (t.gmail) window.open(t.gmail, '_blank', 'noopener'); else notify('No Gmail link on this item'); }}>Open in Gmail</span>
      </div>
      <div className="detail-bottom">
        <div className="btn-row">
          <div className="btn btn-white" onClick={() => onSnooze('later')}>Later today</div>
          <div className="btn btn-white" onClick={() => onSnooze(1)}>Tomorrow</div>
          <div className="btn btn-white" onClick={() => onSnooze(7)}>Next week</div>
        </div>
        <div className="btn btn-ink btn-big" onClick={onPrimary}>{t.completed ? 'Reopen' : 'Mark completed'}</div>
      </div>
    </div>
  );
}
