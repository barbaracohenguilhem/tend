import type { Mode, Role, Screen } from '../lib/types';
import { CalendarIcon, ChatIcon, PeopleIcon, PlusIcon, SunIcon } from './Icons';

interface Props {
  screen: Screen;
  mode: Mode;
  role: Role;
  reviewCount: number;
  onGo: (s: Screen) => void;
  onAdd: () => void;
}

export function TabBar({ screen, mode, role, reviewCount, onGo, onAdd }: Props) {
  const tab = (active: boolean) => `tab${active ? ' is-active' : ''}`;
  const isPeople = screen === 'people' || screen === 'owner';
  return (
    <div className="tabbar">
      <div className="tabs">
        <div className={tab(screen === 'home')} onClick={() => onGo('home')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }}><path d="m3 11 9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" /></svg>
          {screen === 'home' && <span>{role === 'barbara' ? 'Reviewed' : role === 'carla' ? 'For you' : 'Yours'}</span>}
        </div>
        <div className={tab(screen === 'today')} onClick={() => onGo('today')}>
          <SunIcon />{screen === 'today' && <span>Today</span>}
        </div>
        {role !== 'team' && <div className={tab(screen === 'review')} onClick={() => onGo('review')}>
          <ChatIcon />
          {screen === 'review' && <span>{mode === 'carla' ? 'Review' : 'Handoff'}</span>}
          {reviewCount > 0 && screen !== 'review' && <span className="tab-badge">{reviewCount}</span>}
        </div>}
        {role !== 'team' && <div className={tab(isPeople)} onClick={() => onGo('people')}>
          <PeopleIcon />{isPeople && <span>People</span>}
        </div>}
        <div className={tab(screen === 'week')} onClick={() => onGo('week')}>
          <CalendarIcon />{screen === 'week' && <span>Week</span>}
        </div>
      </div>
      <div className="fab" onClick={onAdd}><PlusIcon /></div>
    </div>
  );
}
