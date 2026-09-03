const PREFIX = 'tend.';
/** Keys that belong to one signed-in person (queue, local tasks, view state) and must not leak to the next person on the same phone. */
const PER_USER = new Set(['pending', 'created', 'overlay', 'idMap', 'mode', 'settings']);
let userNs = '';

/** Called on sign-in / sign-out so per-user keys are stored under that address. */
export function setStorageUser(email: string | null) {
  userNs = email ? email.trim().toLowerCase() + '.' : '';
}

function keyFor(key: string): string {
  return PER_USER.has(key) ? `${PREFIX}u.${userNs}${key}` : PREFIX + key;
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(keyFor(key));
    return raw ? { ...fallback, ...JSON.parse(raw) } as T : fallback;
  } catch { return fallback; }
}

export function readValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(keyFor(key));
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

export function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(keyFor(key), JSON.stringify(value)); } catch { /* private mode etc. */ }
}
