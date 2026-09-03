import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number; sw?: number };

function Svg({ size = 16, sw = 1.8, children, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      style={{ strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' }} {...rest}>{children}</svg>
  );
}

export const FocusIcon = (p: P) => <Svg size={15} {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Svg>;
export const BackIcon = (p: P) => <Svg size={18} {...p}><path d="m15 18-6-6 6-6" /></Svg>;
export const CloseIcon = (p: P) => <Svg size={18} {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>;
export const CheckIcon = (p: P) => <Svg size={13} sw={2.6} {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
export const MoonIcon = (p: P) => <Svg size={15} {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Svg>;
export const SunIcon = (p: P) => <Svg size={17} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></Svg>;
export const ChatIcon = (p: P) => <Svg size={17} {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg>;
export const PeopleIcon = (p: P) => <Svg size={17} {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>;
export const CalendarIcon = (p: P) => <Svg size={17} {...p}><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="3" /><path d="M3 10h18" /></Svg>;
export const PlusIcon = (p: P) => <Svg size={22} sw={2} {...p}><path d="M5 12h14" /><path d="M12 5v14" /></Svg>;
export const GripIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="9" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="6" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="15" cy="18" r="1.6" />
  </svg>
);
