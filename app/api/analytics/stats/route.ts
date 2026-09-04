import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { eventDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since');

  try {
    const stats = eventDB.getStats(session.userId, since || undefined);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
