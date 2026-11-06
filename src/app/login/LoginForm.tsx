'use client';

import { useEffect, useState } from 'react';
import { AlertIcon, ArrowRightIcon, LockIcon } from '@/components/icons';
import { apiCall } from '@/lib/client';

const NAME_KEY = 'checkin.name';

export function LoginForm() {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? '');
    } catch {}
    if (new URLSearchParams(window.location.search).get('error') === 'admin_only') {
      setError('That page needs the admin PIN.');
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { ok, data } = await apiCall<{ role: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, pin }),
      redirectOn401: false,
    });
    if (!ok) {
      setBusy(false);
      setError(data.error ?? 'Sign-in failed');
      setPin('');
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, name.trim());
    } catch {}
    const next = new URLSearchParams(window.location.search).get('next');
    const safeNext = next && /^\/(?![/\\])/.test(next) ? next : null;
    window.location.href = safeNext ?? (data.role === 'admin' ? '/admin' : '/desk');
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="label">Your name or desk</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Desk 1 – Priya"
          maxLength={40}
          required
          autoComplete="nickname"
          className="input h-12 text-base"
        />
      </label>
      <label className="block">
        <span className="label">PIN</span>
        <div className="relative">
          <LockIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            required
            className="input h-12 pl-10 text-base tracking-[0.3em]"
          />
        </div>
      </label>

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger" role="alert">
          <AlertIcon className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <button disabled={busy} className="btn btn-primary h-12 w-full text-base">
        {busy ? 'Signing in…' : 'Sign in'}
        {!busy && <ArrowRightIcon className="h-4 w-4" />}
      </button>
    </form>
  );
}
