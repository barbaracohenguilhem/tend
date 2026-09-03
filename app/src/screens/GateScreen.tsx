import { useEffect, useRef, useState } from 'react';
import { Logo } from '../components/Logo';
import { ALLOWED_DOMAIN, TEAM_PASSWORD, checkCredentials, matchesLocalPassword } from '../lib/auth';
import { verifyCredentials } from '../lib/api';

/** Team sign-in: an @carlaguilhem.com address plus the shared password, remembered on this device. */
export function GateScreen({ onSignIn }: { onSignIn: (email: string, key: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { emailRef.current?.focus(); }, []);

  const submit = async () => {
    if (busy) return;
    const err = checkCredentials(email, password);
    if (err) { setError(err); return; }
    const e = email.trim().toLowerCase(), key = password.trim();
    setBusy(true);
    // The server decides (its TEAM_PASSWORD can differ from the hint below); offline, the printed password is accepted.
    const v = await verifyCredentials(e, key);
    setBusy(false);
    if (v && !v.ok) { setError(v.error || 'Wrong password.'); return; }
    if (!v && !matchesLocalPassword(key)) { setError('Wrong password.'); return; }
    onSignIn(e, key);
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); };

  return (
    <div className="gate">
      <div className="gate-aura" />
      <div className="gate-body">
        <Logo />
        <h1 className="h1">Welcome.</h1>
        <div className="subline">Sign in to your team's Smart Inbox.</div>
        <div className="gate-form">
          <div className="field">
            <label className="field-label" htmlFor="gate-email">Email</label>
            <input id="gate-email" ref={emailRef} className="field-input gate-input" type="email" inputMode="email" autoComplete="username"
              autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder={`you@${ALLOWED_DOMAIN}`}
              value={email} onChange={e => { setEmail(e.target.value); setError(null); }} onKeyDown={onKey} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="gate-password">Password</label>
            <input id="gate-password" className="field-input gate-input" type="password" autoComplete="current-password" autoCapitalize="characters"
              placeholder="Team password" value={password} onChange={e => { setPassword(e.target.value); setError(null); }} onKeyDown={onKey} />
          </div>
          {error && <div className="gate-error" role="alert">{error}</div>}
          <div className={`btn btn-ink btn-big${busy ? ' is-busy' : ''}`} onClick={submit}>{busy ? 'Checking…' : 'Sign in'}</div>
        </div>
        <div className="gate-info">
          <div className="eyebrow">How to get in</div>
          <div className="gate-info-row"><span className="gate-info-key">Who</span><span>Anyone with an <b>@{ALLOWED_DOMAIN}</b> email address.</span></div>
          <div className="gate-info-row"><span className="gate-info-key">Password</span><span><code className="gate-code">{TEAM_PASSWORD}</code></span></div>
          <div className="gate-info-row"><span className="gate-info-key">Then</span><span>You stay signed in on this phone. Sign out from the tend logo → Sync.</span></div>
        </div>
      </div>
    </div>
  );
}
