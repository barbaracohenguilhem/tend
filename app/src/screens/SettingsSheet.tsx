import type { Settings } from '../lib/types';
import type { Connection, Source } from '../store/useInbox';

interface Props {
  settings: Settings;
  source: Source;
  connection: Connection;
  pendingCount: number;
  onUpdate: (p: Partial<Settings>) => void;
  onFlush: () => void;
  onReload: () => void;
  onClose: () => void;
}

function ago(ts?: number): string {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m === 1 ? '1 minute ago' : m < 60 ? `${m} minutes ago` : `${Math.round(m / 60)} h ago`;
}

/** Sync settings — the in-app equivalent of the design tool's "Tweaks" panel. */
export function SettingsSheet({ settings, source, connection, pendingCount, onUpdate, onFlush, onReload, onClose }: Props) {
  const notion = source === 'notion';
  const canSend = notion || !!settings.relayUrl;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet scroll">
        <div className="handle" />
        <div className="settings-title">Sync</div>

        {notion && (
          <div className="field">
            <label className="field-label">Notion</label>
            <span className="field-help">
              {connection.status === 'connected' && <>Connected to your Smart Inbox · updated {ago(connection.updatedAt)}.{connection.partial ? ' Showing the first 100 open items.' : ''}</>}
              {connection.status === 'connecting' && 'Connecting to your Smart Inbox…'}
              {connection.status === 'error' && connection.message}
            </span>
          </div>
        )}
        {source === 'none' && (
          <div className="field"><label className="field-label">Notion</label><span className="field-help">{connection.message}</span></div>
        )}
        {source === 'relay' && (
          <>
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
          </>
        )}
        <div className="toggle-row" onClick={() => onUpdate({ headerAura: !settings.headerAura })}>
          <span className="field-label">Header aura</span>
          <div className={`toggle${settings.headerAura ? ' is-on' : ''}`} />
        </div>
        <div className="btn-row">
          {pendingCount > 0 && canSend && <div className="btn btn-white" onClick={onFlush}>Send {pendingCount} queued</div>}
          <div className="btn btn-white" onClick={onReload}>Reload</div>
          <div className="btn btn-ink" onClick={onClose}>Done</div>
        </div>
        {pendingCount > 0 && !canSend && <span className="field-help">{pendingCount} change{pendingCount === 1 ? '' : 's'} waiting — {notion ? 'they will be sent once Notion is reachable.' : 'set a relay URL to send them to Notion.'}</span>}
      </div>
    </>
  );
}
