import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse, type NextRequest } from 'next/server';
import { saveChallenge } from '@/lib/auth';
import { userDB } from '@/lib/db';

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,64}$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const username =
    typeof body === 'object' &&
    body !== null &&
    'username' in body &&
    typeof body.username === 'string'
      ? body.username.trim()
      : '';

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3-64 letters, numbers, or ._- characters' },
      { status: 400 },
    );
  }
  if (userDB.findByUsername(username)) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const options = await generateRegistrationOptions({
    rpName: process.env.RP_NAME ?? process.env.NEXT_PUBLIC_RP_NAME ?? 'Todo App',
    rpID: process.env.RP_ID ?? 'localhost',
    userName: username,
    attestationType: 'none',
  });
  saveChallenge(username, 'registration', options.challenge);
  return NextResponse.json(options);
}
