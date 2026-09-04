import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { eventDB } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);

  try {
    const activity = eventDB.getActivity(session.userId, limit);
    return NextResponse.json(activity);
  } catch (error) {
    console.error('Failed to get activity:', error);
    return NextResponse.json({ error: 'Failed to get activity' }, { status: 500 });
  }
}
