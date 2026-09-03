import { Avatar } from '../components/Avatar';
import { CloseIcon } from '../components/Icons';
import { person } from '../lib/people';
import type { Task } from '../lib/types';

interface Props {
  task: Task | undefined;
  index: number;
  total: number;
  out: boolean;
  onExit: () => void;
  onDone: () => void;
  onLater: () => void;
  onSkip: () => void;
}

export function FocusScreen({ task: t, index, total, out, onExit, onDone, onLater, onSkip }: Props) {
  const owner = t ? person(t.owner) : null;
  return (
    <div className="focus">
      <div className="focus-aura" />
      <div className="focus-top">
        <div className="glass glass-btn" onClick={onExit} aria-label="Exit focus"><CloseIcon /></div>
        <div className="glass glass-pill">{total ? `${index + 1} of ${total}` : ''}</div>
      </div>
      <div className="focus-body">
        {t && owner && (
          <div className={`focus-fade${out ? ' is-out' : ''}`}>
            <span className="eyebrow">{t.category}</span>
            <h1 className="focus-title">{t.action}</h1>
            <div className="focus-subject">{t.from} — {t.subject}</div>
            <div className="focus-meta"><Avatar person={owner} size={24} fs={10} /><span>{owner.short}{t.priority === 'High' ? ' · High priority' : ''}</span></div>
          </div>
        )}
      </div>
      <div className="focus-actions">
        <div className="btn btn-ink btn-big" onClick={onDone}>Done</div>
        <div className="btn-row">
          <div className="glass-action" onClick={onLater}>Tomorrow</div>
          <div className="glass-action" onClick={onSkip}>Skip</div>
        </div>
      </div>
    </div>
  );
}
