import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import type { Session, User } from '@/lib/db';

export const SESSION_COOKIE = 'todo_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type ChallengeKind = 'registration' | 'authentication';

interface StoredChallenge {
  username: string;
  kind: ChallengeKind;
  expiresAt: number;
}

const authGlobal = globalThis as typeof globalThis & {
  __todoChallenges?: Map<string, StoredChallenge>;
};
const challenges = authGlobal.__todoChallenges ?? new Map<string, StoredChallenge>();
authGlobal.__todoChallenges = challenges;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) throw new Error('JWT_SECRET or SESSION_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

export function saveChallenge(
  username: string,
  kind: ChallengeKind,
  challenge: string,
): void {
  challenges.set(challenge, {
    username,
    kind,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });
}

export function getChallenge(
  username: string,
  kind: ChallengeKind,
  challenge: string,
): boolean {
  const stored = challenges.get(challenge);
  if (!stored || stored.expiresAt < Date.now()) {
    challenges.delete(challenge);
    return false;
  }
  return stored.username === username && stored.kind === kind;
}

export function consumeChallenge(
  username: string,
  kind: ChallengeKind,
  challenge: string,
): boolean {
  if (!getChallenge(username, kind, challenge)) return false;
  challenges.delete(challenge);
  return true;
}

export async function createSession(user: User): Promise<void> {
  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (typeof payload.userId !== 'number' || typeof payload.username !== 'string') {
      return null;
    }
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
