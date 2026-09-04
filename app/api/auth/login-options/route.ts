import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextResponse, type NextRequest } from 'next/server';
import { saveChallenge } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';

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
  const user = username ? userDB.findByUsername(username) : null;
  if (!user) return NextResponse.json({ error: 'Unable to authenticate' }, { status: 401 });

  const options = await generateAuthenticationOptions({
    rpID: process.env.RP_ID ?? 'localhost',
    allowCredentials: authenticatorDB.listByUser(user.id).map((authenticator) => ({
      id: authenticator.credential_id,
    })),
    userVerification: 'preferred',
  });
  saveChallenge(user.username, 'authentication', options.challenge);
  return NextResponse.json(options);
}
