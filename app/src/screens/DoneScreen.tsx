import { Logo } from '../components/Logo';
import { dateLine } from '../lib/dates';

export function DoneScreen({ summary, onReview, onToday }: { summary: string; onReview: () => void; onToday: () => void }) {
  return (
    <div className="done">
      <div className="done-aura" />
      <Logo className="done-logo" />
      <div className="done-center">
        <span className="eyebrow">{dateLine()}</span>
        <h1 className="done-title">Inbox clear.</h1>
        <div className="done-summary">{summary}</div>
      </div>
      <div className="done-bottom">
        <div className="btn btn-ink btn-big" onClick={onReview}>Review drafts</div>
        <span className="done-back" onClick={onToday}>Back to today</span>
      </div>
    </div>
  );
}
