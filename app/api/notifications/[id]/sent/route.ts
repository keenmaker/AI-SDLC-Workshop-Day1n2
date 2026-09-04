import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { formatSingaporeDateTime, getSingaporeNow } from '@/lib/timezone';

/**
 * POST /api/notifications/[id]/sent
 *
 * Records that a browser notification has been shown for a todo.
 *
 * This is its own endpoint because `last_notification_sent` is deliberately
 * not part of the todo update payload: it is bookkeeping, not user-editable
 * content. Writing it through PUT /api/todos/[id] silently dropped the value,
 * which left the reminder re-firing on every poll.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const todoId = Number((await params).id);
  if (!Number.isInteger(todoId) || todoId < 1) {
    return NextResponse.json({ error: 'Invalid todo id' }, { status: 400 });
  }

  if (!todoDB.findById(todoId, session.userId)) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  todoDB.markNotified(todoId, session.userId, formatSingaporeDateTime(getSingaporeNow()));

  return NextResponse.json({ success: true });
}
