import { useEffect, useRef, useState } from 'react';
import type { Comment } from '../lib/types';

interface Props {
  comments: Comment[];
  loading: boolean;
  error: string | null;
  busy: boolean;
  available: boolean;
  me: string;
  onSend: (text: string) => void;
  onVoice: (blob: Blob, filename: string) => void;
  onAttach: (file: File) => void;
  attachLabel?: string;
}

function when(iso: string): string {
  const d = new Date(iso), now = new Date();
  const same = d.toDateString() === now.toDateString();
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return same ? t : `${d.getDate()}/${d.getMonth() + 1} ${t}`;
}

/** Conversation on one task: text, voice notes, attachments. Everyone signed in sees the same thread. */
export function Chat({ comments, loading, error, busy, available, me, onSend, onVoice, onAttach, attachLabel }: Props) {
  const [text, setText] = useState('');
  const [rec, setRec] = useState<'idle' | 'recording' | 'unsupported'>('idle');
  const [secs, setSecs] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [comments.length]);
  useEffect(() => () => { window.clearInterval(timer.current); recorder.current?.stream.getTracks().forEach(t => t.stop()); }, []);

  const submit = () => { if (!text.trim()) return; onSend(text); setText(''); };

  const startRec = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setRec('unsupported'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const type = r.mimeType || mime || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(chunks.current, { type });
        if (blob.size > 0) onVoice(blob, `voice-${Date.now()}.${ext}`);
      };
      recorder.current = r; r.start();
      setRec('recording'); setSecs(0);
      timer.current = window.setInterval(() => setSecs(s => s + 1), 1000);
    } catch { setRec('unsupported'); }
  };
  const stopRec = () => { window.clearInterval(timer.current); recorder.current?.stop(); recorder.current = null; setRec('idle'); };

  return (
    <div className="chat">
      <div className="eyebrow">Conversation</div>
      {!available && <div className="chat-note">The conversation is available once this task is saved in Notion.</div>}
      {available && loading && comments.length === 0 && <div className="chat-note">Loading…</div>}
      {available && !loading && comments.length === 0 && <div className="chat-note">No messages yet. Say something, record a voice note, or attach a file.</div>}
      <div className="chat-list">
        {comments.map(c => {
          const mine = c.author.toLowerCase() === me.toLowerCase();
          return (
            <div key={c.id} className={`msg${mine ? ' is-mine' : ''}`}>
              <div className="msg-meta"><span className="msg-author">{c.author}</span><span className="msg-when">{when(c.at)}</span></div>
              {c.text && <div className="msg-text">{c.text}</div>}
              {c.audio && <audio className="msg-audio" controls preload="none" src={c.audio.url} />}
              {c.file && <a className="link" href={c.file.url} target="_blank" rel="noopener">📎 {c.file.name}</a>}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {error && <div className="chat-error">{error}</div>}
      {available && (
        <div className="chat-compose">
          {rec === 'recording' ? (
            <div className="rec-row">
              <span className="rec-dot" /><span className="rec-time">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
              <div className="btn btn-ink btn-sm" onClick={stopRec}>Stop &amp; send</div>
            </div>
          ) : (
            <>
              <textarea className="chat-input" rows={1} placeholder="Write a message…" value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
              <div className="chat-actions">
                <div className={`icon-btn sm${rec === 'unsupported' ? ' is-disabled' : ''}`} title="Record a voice note" onClick={startRec} aria-label="Record voice note">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v5" /><path d="M8 22h8" /></svg>
                </div>
                <div className="icon-btn sm" title={attachLabel || 'Attach a file'} onClick={() => fileInput.current?.click()} aria-label="Attach file">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                </div>
                <input ref={fileInput} type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = ''; }} />
                <div className={`btn btn-ink btn-sm${!text.trim() || busy ? ' is-disabled' : ''}`} onClick={submit}>Send</div>
              </div>
            </>
          )}
          {rec === 'unsupported' && <div className="chat-note">Voice notes need microphone access. Allow it in Safari settings and try again.</div>}
        </div>
      )}
    </div>
  );
}
