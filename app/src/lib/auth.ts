import { readValue, writeJson } from './storage';

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
  if (!password) return 'Enter the team password.';
  if (password.toUpperCase() !== TEAM_PASSWORD) return 'Wrong password.';
  return null;
}
