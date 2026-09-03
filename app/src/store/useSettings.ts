import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson } from '../lib/storage';
import type { Settings } from '../lib/types';

export const DEFAULT_DATA_URL = './smart-inbox.json';

const defaults: Settings = { dataUrl: DEFAULT_DATA_URL, relayUrl: '', relayKey: '', headerAura: true };

/** App settings — replaces the design tool's "Tweaks" panel. Persisted per device. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => readJson('settings', defaults));
  useEffect(() => { writeJson('settings', settings); }, [settings]);
  const update = useCallback((patch: Partial<Settings>) => setSettings(s => ({ ...s, ...patch })), []);
  return { settings, update };
}
