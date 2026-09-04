import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { eventDB } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const { eventType, resourceType, resourceId, metadata } = body;

  if (!eventType || typeof eventType !== 'string') {
    return NextResponse.json({ error: 'eventType is required' }, { status: 400 });
  }

  try {
    const event = eventDB.log(
      session.userId,
      eventType,
      resourceType || null,
      resourceId || null,
      metadata || null,
    );
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Failed to log event:', error);
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
  }
}
