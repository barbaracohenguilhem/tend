import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson } from '../lib/storage';
import type { Settings } from '../lib/types';

/** Set at build time on Vercel (vercel.json) so the app talks to its own /api functions. */
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) || '';
export const DEFAULT_DATA_URL = API_BASE ? `${API_BASE}/smart-inbox` : './smart-inbox.json';

const defaults: Settings = { dataUrl: DEFAULT_DATA_URL, relayUrl: API_BASE, relayKey: '', headerAura: true };

/** App settings — replaces the design tool's "Tweaks" panel. Persisted per device. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => readJson('settings', defaults));
  useEffect(() => { writeJson('settings', settings); }, [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings(s => ({ ...s, ...patch })), []);
  return { settings, update };
}
