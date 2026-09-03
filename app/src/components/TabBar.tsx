import type { Mode, Screen } from '../lib/types';
import { CalendarIcon, ChatIcon, PeopleIcon, PlusIcon, SunIcon } from './Icons';

interface Props {
  screen: Screen;
  mode: Mode;
  reviewCount: number;
  onGo: (s: Screen) => void;
  onAdd: () => void;
}

export function TabBar({ screen, mode, reviewCount, onGo, onAdd }: Props) {
  const tab = (active: boolean) => `tab${active ? ' is-active' : ''}`;
  const isPeople = screen === 'people' || screen === 'owner';
  return (
    <div className="tabbar">
      <div className="tabs">
        <div className={tab(screen === 'today')} onClick={() => onGo('today')}>
          <SunIcon />{screen === 'today' && <span>Today</span>}
        </div>
        <div className={tab(screen === 'review')} onClick={() => onGo('review')}>
          <ChatIcon />
          {screen === 'review' && <span>{mode === 'carla' ? 'Review' : 'Handoff'}</span>}
          {reviewCount > 0 && screen !== 'review' && <span className="tab-badge">{reviewCount}</span>}
        </div>
        <div className={tab(isPeople)} onClick={() => onGo('people')}>
          <PeopleIcon />{isPeople && <span>People</span>}
        </div>
        <div className={tab(screen === 'week')} onClick={() => onGo('week')}>
          <CalendarIcon />{screen === 'week' && <span>Week</span>}
        </div>
      </div>
      <div className="fab" onClick={onAdd}><PlusIcon /></div>
    </div>
  );
}
