import type { Mode, Role, Screen } from '../lib/types';
import '../styles/navigation.css';
import { CalendarIcon, ChatIcon, PlusIcon, SunIcon } from './Icons';

interface Props {
  screen: Screen;
  mode: Mode;
  role: Role;
  reviewCount: number;
  onGo: (s: Screen) => void;
  onAdd: (() => void) | null;
}

export function TabBar({ screen, mode, role, reviewCount, onGo, onAdd }: Props) {
  const tab = (active: boolean) => `tab${active ? ' is-active' : ''}`;
  return (
    <nav className="tabbar tend-navigation" aria-label="Main navigation">
      <div className="tabs">
        <button type="button" className={tab(screen === 'home')} aria-current={screen === 'home' ? 'page' : undefined} onClick={() => onGo('home')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="m3 11 9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" /></svg>
          <span>{role === 'barbara' ? 'Reviewed' : role === 'carla' ? 'For you' : 'Yours'}</span>
        </button>
        {role !== 'team' && <button type="button" className={tab(screen === 'today' || screen === 'people' || screen === 'owner')} aria-current={['today', 'people', 'owner'].includes(screen) ? 'page' : undefined} onClick={() => onGo('today')}>
          <SunIcon /><span>Tasks</span>
        </button>}
        <button type="button" className={tab(screen === 'board')} aria-current={screen === 'board' ? 'page' : undefined} onClick={() => onGo('board')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}><rect x="3" y="3" width="5" height="18" rx="1.5" /><rect x="10" y="3" width="5" height="12" rx="1.5" /><rect x="17" y="3" width="4" height="8" rx="1.5" /></svg>
          <span>Board</span>
        </button>
        <button type="button" className={tab(screen === 'calendar' || screen === 'week')} aria-current={['calendar', 'week'].includes(screen) ? 'page' : undefined} onClick={() => onGo('calendar')}>
          <CalendarIcon /><span>Calendar</span>
        </button>
        {role !== 'team' && <button type="button" className={tab(screen === 'review')} aria-current={screen === 'review' ? 'page' : undefined} onClick={() => onGo('review')}>
          <ChatIcon />
          <span>{mode === 'carla' ? 'Review' : 'Handoff'}</span>
          {reviewCount > 0 && screen !== 'review' && <span className="tab-badge">{reviewCount}</span>}
        </button>}
      </div>
      {onAdd && <button type="button" className="fab" aria-label="Add task" onClick={onAdd}><PlusIcon /></button>}
    </nav>
  );
}

