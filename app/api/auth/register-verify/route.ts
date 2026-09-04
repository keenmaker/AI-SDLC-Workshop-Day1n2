import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextResponse, type NextRequest } from 'next/server';
import { consumeChallenge, createSession, getChallenge } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  let body: { username?: unknown; response?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (typeof body.username !== 'string' || !body.response || typeof body.response !== 'object') {
    return NextResponse.json({ error: 'Invalid registration response' }, { status: 400 });
  }
  const username = body.username.trim();
  const response = body.response as Parameters<typeof verifyRegistrationResponse>[0]['response'];

  let verification;
  try {
    const clientDataJSON = (response.response as { clientDataJSON: string }).clientDataJSON;
    const clientData = JSON.parse(
      Buffer.from(clientDataJSON, 'base64url').toString('utf8'),
    ) as { challenge?: string };
    if (!clientData.challenge || !getChallenge(username, 'registration', clientData.challenge)) {
      return NextResponse.json(
        { error: 'Registration challenge expired or already used' },
        { status: 401 },
      );
    }

    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: clientData.challenge,
      expectedOrigin: process.env.RP_ORIGIN ?? process.env.ORIGIN ?? 'http://localhost:3000',
      expectedRPID: process.env.RP_ID ?? 'localhost',
    });
  } catch {
    return NextResponse.json({ error: 'Registration verification failed' }, { status: 401 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Registration verification failed' }, { status: 401 });
  }
  const clientDataJSON = (response.response as { clientDataJSON: string }).clientDataJSON;
  const challenge = (
    JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')) as { challenge: string }
  ).challenge;
  if (!consumeChallenge(username, 'registration', challenge)) {
    return NextResponse.json({ error: 'Registration challenge expired or already used' }, { status: 401 });
  }

  try {
    const user = userDB.create(username);
    const credential = verification.registrationInfo.credential;
    authenticatorDB.create({
      user_id: user.id,
      credential_id: credential.id,
      credential_public_key: Buffer.from(credential.publicKey),
      counter: credential.counter ?? 0,
    });
    await createSession(user);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unable to create account' }, { status: 409 });
  }
}
