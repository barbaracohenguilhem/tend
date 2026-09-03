import type { Settings } from '../lib/types';

interface Props {
  settings: Settings;
  pendingCount: number;
  onUpdate: (p: Partial<Settings>) => void;
  onFlush: () => void;
  onReload: () => void;
  onClose: () => void;
}

/** Sync settings — the in-app equivalent of the design tool's "Tweaks" panel. See sync-spec.md. */
export function SettingsSheet({ settings, pendingCount, onUpdate, onFlush, onReload, onClose }: Props) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet scroll">
        <div className="handle" />
        <div className="settings-title">Sync</div>
        <div className="field">
          <label className="field-label">Data URL</label>
          <input className="field-input" value={settings.dataUrl} onChange={e => onUpdate({ dataUrl: e.target.value })} placeholder="https://…/webhook/smart-inbox" spellCheck={false} autoCapitalize="off" />
          <span className="field-help">GET endpoint returning {'{ items }'}. Remote URLs are polled every 60 s; the bundled snapshot is used until you set one.</span>
        </div>
        <div className="field">
          <label className="field-label">Relay URL</label>
          <input className="field-input" value={settings.relayUrl} onChange={e => onUpdate({ relayUrl: e.target.value })} placeholder="https://…/webhook" spellCheck={false} autoCapitalize="off" />
          <span className="field-help">POST base — changes go to /smart-inbox/update and /smart-inbox/create. While empty, changes queue on this phone.</span>
        </div>
        <div className="field">
          <label className="field-label">Relay key</label>
          <input className="field-input" type="password" value={settings.relayKey} onChange={e => onUpdate({ relayKey: e.target.value })} placeholder="x-relay-key" spellCheck={false} autoCapitalize="off" />
        </div>
        <div className="toggle-row" onClick={() => onUpdate({ headerAura: !settings.headerAura })}>
          <span className="field-label">Header aura</span>
          <div className={`toggle${settings.headerAura ? ' is-on' : ''}`} />
        </div>
        <div className="btn-row">
          {pendingCount > 0 && settings.relayUrl && <div className="btn btn-white" onClick={onFlush}>Send {pendingCount} queued</div>}
          <div className="btn btn-white" onClick={onReload}>Reload data</div>
          <div className="btn btn-ink" onClick={onClose}>Done</div>
        </div>
        {pendingCount > 0 && !settings.relayUrl && <span className="field-help">{pendingCount} change{pendingCount === 1 ? '' : 's'} waiting — set a relay URL to send them to Notion.</span>}
      </div>
    </>
  );
}
