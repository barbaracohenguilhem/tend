import { readValue, setStorageUser, writeJson } from './storage';
import { member } from './team';
import type { OwnerId, Role } from './types';

export const ALLOWED_DOMAIN = 'carlaguilhem.com';
/** The password shown on the sign-in screen. The server's TEAM_PASSWORD wins when the app is hosted (see GateScreen). */
export const TEAM_PASSWORD = 'APPCONTROLE';

export interface Session { email: string; at: number; /** the password that was accepted, sent as x-relay-key */ key?: string }

export function readSession(): Session | null {
  const s = readValue<Session | null>('session', null);
  if (!s || typeof s.email !== 'string' || !s.email.toLowerCase().endsWith('@' + ALLOWED_DOMAIN)) return null;
  const m = member(s.email);
  if (m && !m.active) return null;
  return s;
}

export function writeSession(s: Session | null) {
  writeJson('session', s);
  setStorageUser(s ? s.email : null);
}

/** Local checks: an address at the studio domain that is not deactivated, and a non-empty password. */
export function checkCredentials(emailRaw: string, passwordRaw: string): string | null {
  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();
  if (!email) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'That does not look like an email address.';
  if (!email.endsWith('@' + ALLOWED_DOMAIN)) return `Only @${ALLOWED_DOMAIN} addresses can sign in.`;
  const m = member(email);
  if (m && !m.active) return 'This account is deactivated.';
  if (!password) return 'Enter the team password.';
  return null;
}

/** Offline fallback when the server cannot be asked. */
export function matchesLocalPassword(password: string): boolean {
  return password.trim().toUpperCase() === TEAM_PASSWORD;
}

/** Who is signed in. Only the roster decides: unknown addresses at the domain are team members who own nothing yet. */
export function roleFor(email: string): Role {
  const m = member(email);
  return m ? m.role : 'team';
}

/** Display name for the signed-in person. */
export function nameFor(email: string): string {
  const m = member(email);
  if (m) return m.short;
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** The Owner this person's tasks are filed under, from the roster only. */
export function ownerFor(email: string): OwnerId | null {
  const m = member(email);
  return m ? m.owner : null;
}
