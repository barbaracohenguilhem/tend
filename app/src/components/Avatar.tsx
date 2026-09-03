import type { Person } from '../lib/types';

export function Avatar({ person, size, fs }: { person: Person; size: number; fs: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: fs, background: person.bg }}>{person.initial}</span>
  );
}
