export function Logo({ onClick, className }: { onClick?: () => void; className?: string }) {
  return (
    <div className={`logo${className ? ' ' + className : ''}`} onClick={onClick} title={onClick ? 'Settings' : undefined}>
      <span className="logo-orb" />
      <span className="logo-word">tend</span>
    </div>
  );
}
