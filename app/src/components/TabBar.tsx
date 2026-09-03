import type { Mode, Role, Screen } from '../lib/types';
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
    <div className="tabbar">
      <div className="tabs">
        <div className={tab(screen === 'home')} onClick={() => onGo('home')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="m3 11 9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" /></svg>
          {screen === 'home' && <span>{role === 'barbara' ? 'Reviewed' : role === 'carla' ? 'For you' : 'Yours'}</span>}
        </div>
        {role !== 'team' && <div className={tab(screen === 'today' || screen === 'people' || screen === 'owner')} onClick={() => onGo('today')}>
          <SunIcon />{(screen === 'today' || screen === 'people' || screen === 'owner') && <span>Today</span>}
        </div>}
        <div className={tab(screen === 'board')} onClick={() => onGo('board')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}><rect x="3" y="3" width="5" height="18" rx="1.5" /><rect x="10" y="3" width="5" height="12" rx="1.5" /><rect x="17" y="3" width="4" height="8" rx="1.5" /></svg>
          {screen === 'board' && <span>Board</span>}
        </div>
        <div className={tab(screen === 'calendar' || screen === 'week')} onClick={() => onGo('calendar')}>
          <CalendarIcon />{(screen === 'calendar' || screen === 'week') && <span>Calendar</span>}
        </div>
        {role !== 'team' && <div className={tab(screen === 'review')} onClick={() => onGo('review')}>
          <ChatIcon />
          {screen === 'review' && <span>{mode === 'carla' ? 'Review' : 'Handoff'}</span>}
          {reviewCount > 0 && screen !== 'review' && <span className="tab-badge">{reviewCount}</span>}
        </div>}
      </div>
      {onAdd && <div className="fab" onClick={onAdd}><PlusIcon /></div>}
    </div>
  );
}
