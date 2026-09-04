'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then((response) => {
      if (response.ok) router.replace('/');
    });
  }, [router]);

  async function authenticate(mode: 'register' | 'login') {
    setError(null);
    setBusy(true);
    try {
      const optionsResponse = await fetch(`/api/auth/${mode}-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const options = await optionsResponse.json();
      if (!optionsResponse.ok) {
        setError(options.error ?? 'Unable to authenticate');
        return;
      }

      const response =
        mode === 'register'
          ? await startRegistration(options)
          : await startAuthentication(options);
      const verifyResponse = await fetch(`/api/auth/${mode}-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response }),
      });
      const result = await verifyResponse.json();
      if (!verifyResponse.ok) {
        setError(result.error ?? 'Unable to authenticate');
        return;
      }
      router.replace(searchParams.get('next') || '/');
    } catch (cause) {
      setError(
        cause instanceof DOMException && cause.name === 'NotAllowedError'
          ? 'Passkey prompt cancelled. Try again when ready.'
          : 'This browser or device does not support passkeys.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow dark:bg-slate-900">
        <h1 className="text-2xl font-semibold">Todo App</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Sign in with a passkey. No password is required.
        </p>
        <label className="mt-6 block text-sm font-medium" htmlFor="username">Username</label>
        <input
          id="username"
          className="mt-2 w-full rounded border p-2"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username webauthn"
          disabled={busy}
        />
        {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            onClick={() => authenticate('register')}
            disabled={busy || !username.trim()}
          >
            Register
          </button>
          <button
            className="rounded border px-4 py-2 disabled:opacity-50"
            onClick={() => authenticate('login')}
            disabled={busy || !username.trim()}
          >
            Login
          </button>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center p-6">Loading…</main>}>
      <LoginPageContent />
    </Suspense>
  );
}
