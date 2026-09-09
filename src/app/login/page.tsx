'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? 'Could not sign in.');
      const next = params.get('next');
      router.replace(next && next.startsWith('/') ? next : '/');
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="login-wrap">
        <div className="panel">
          <h1 style={{ marginBottom: 4 }}>Confirmation Letters</h1>
          <p className="sub" style={{ marginTop: 0, fontSize: 13 }}>Enter the shared password to continue.</p>
          {error && <div className="msg err">{error}</div>}
          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input
                id="pw"
                type="password"
                value={password}
                autoFocus
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="primary" type="submit" disabled={busy || !password} style={{ width: '100%' }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

/** useSearchParams needs a Suspense boundary to be prerenderable. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
