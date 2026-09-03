import { readValue, writeJson } from './storage';
import { member } from './team';

export const ALLOWED_DOMAIN = 'carlaguilhem.com';
export const TEAM_PASSWORD = 'APPCONTROLE';

export interface Session { email: string; at: number }

export function readSession(): Session | null {
  const s = readValue<Session | null>('session', null);
  return s && typeof s.email === 'string' && s.email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN) ? s : null;
}

export function writeSession(s: Session | null) {
  writeJson('session', s);
}

/** Returns an error message, or null when the credentials are accepted. */
export function checkCredentials(emailRaw: string, passwordRaw: string): string | null {
  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();
  if (!email) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'That does not look like an email address.';
  if (!email.endsWith('@' + ALLOWED_DOMAIN)) return `Only @${ALLOWED_DOMAIN} addresses can sign in.`;
  const m = member(email);
  if (m && !m.active) return 'This account is deactivated.';
  if (!password) return 'Enter the team password.';
  if (password.toUpperCase() !== TEAM_PASSWORD) return 'Wrong password.';
  return null;
}

import type { OwnerId, Role } from './types';
import { people } from './people';

/** Who is signed in, decided by the address: carla@ → Carla, barbara@/design@ → Barbara, anyone else → team. */
export function roleFor(email: string): Role {
  const m = member(email);
  if (m) return m.role;
  const local = email.split('@')[0].toLowerCase();
  if (local.startsWith('carla')) return 'carla';
  if (local.startsWith('barbara')) return 'barbara';
  return 'team';
}

/** Display name for the signed-in person. */
export function nameFor(email: string): string {
  const m = member(email);
  if (m) return m.short;
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Team member → the Owner they own tasks as, matched on the first name in the address (fernanda@ → Fernanda). */
export function ownerFor(email: string): OwnerId | null {
  const m = member(email);
  if (m) return m.owner;
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z]/g, ' ');
  for (const p of people) if (p.id !== 'none' && p.keys.some(k => local.includes(k))) return p.id;
  return null;
}
