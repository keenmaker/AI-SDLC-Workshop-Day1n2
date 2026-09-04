import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
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
    return NextResponse.json({ error: 'Unable to authenticate' }, { status: 401 });
  }

  const user = userDB.findByUsername(body.username.trim());
  const response = body.response as Parameters<typeof verifyAuthenticationResponse>[0]['response'];
  const authenticator =
    typeof response.id === 'string' ? authenticatorDB.findByCredentialId(response.id) : null;
  if (!user || !authenticator || authenticator.user_id !== user.id) {
    return NextResponse.json({ error: 'Unable to authenticate' }, { status: 401 });
  }

  let clientData: { challenge?: string };
  try {
    clientData = JSON.parse(
      Buffer.from((response.response as { clientDataJSON: string }).clientDataJSON, 'base64url').toString('utf8'),
    ) as { challenge?: string };
  } catch {
    return NextResponse.json({ error: 'Unable to authenticate' }, { status: 401 });
  }
  if (!clientData.challenge || !getChallenge(user.username, 'authentication', clientData.challenge)) {
    return NextResponse.json({ error: 'Unable to authenticate' }, { status: 401 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: clientData.challenge,
      expectedOrigin: process.env.RP_ORIGIN ?? process.env.ORIGIN ?? 'http://localhost:3000',
      expectedRPID: process.env.RP_ID ?? 'localhost',
      credential: {
        id: isoBase64URL.fromBuffer(isoBase64URL.toBuffer(authenticator.credential_id)),
        publicKey: Uint8Array.from(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to authenticate' }, { status: 401 });
  }

  const previousCounter = authenticator.counter ?? 0;
  const nextCounter = verification.authenticationInfo?.newCounter ?? 0;
  const counterValid = previousCounter === 0
    ? true
    : nextCounter > previousCounter;
  if (!verification.verified || !counterValid) {
    return NextResponse.json({ error: 'Unable to authenticate' }, { status: 401 });
  }
  if (!consumeChallenge(user.username, 'authentication', clientData.challenge)) {
    return NextResponse.json({ error: 'Unable to authenticate' }, { status: 401 });
  }

  authenticatorDB.updateCounter(authenticator.credential_id, nextCounter ?? 0);
  await createSession(user);
  return NextResponse.json({ success: true });
}
