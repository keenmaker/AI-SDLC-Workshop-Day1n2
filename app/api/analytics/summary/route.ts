import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { eventDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const summary = eventDB.getSummary(session.userId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Failed to get summary:', error);
    return NextResponse.json({ error: 'Failed to get summary' }, { status: 500 });
  }
}
