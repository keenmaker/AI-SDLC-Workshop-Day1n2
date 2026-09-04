/**
 * Session management.
 *
 * Sessions are stateless JWTs stored in an HTTP-only cookie with a 7-day
 * expiry. Nothing is persisted server-side, so logout works by clearing the
 * cookie.
 *
 * Step 3 (WebAuthn) builds on this contract: once a passkey is verified, the
 * route calls `createSession()` with the resolved user.
 */

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import type { Session } from './db';

export const SESSION_COOKIE = 'todo_session';

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set to a random string of at least 32 characters. See .env.example.',
    );
  }

  return new TextEncoder().encode(secret);
}

/** Signs a session JWT and writes it to the HTTP-only session cookie. */
export async function createSession(session: Session): Promise<void> {
  const token = await new SignJWT({ username: session.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Reads and verifies the current session.
 * Returns `null` when the cookie is absent, expired, or tampered with.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());

    const userId = Number(payload.sub);
    const username = typeof payload.username === 'string' ? payload.username : null;

    if (!Number.isInteger(userId) || userId <= 0 || !username) return null;

    return { userId, username };
  } catch {
    return null;
  }
}

/** Clears the session cookie. */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
