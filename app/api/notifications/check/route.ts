import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { getSingaporeNow, calculateReminderTime } from '@/lib/timezone';

/**
 * GET /api/notifications/check
 *
 * Returns todos whose reminder window has opened (due_date - reminder_minutes
 * <= now <= due_date) and that have not been notified yet. All timing
 * comparisons happen server-side against Singapore time, so client clock
 * drift cannot affect when a reminder fires.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const now = getSingaporeNow();

  const dueTodos = todoDB
    .listPendingReminders(session.userId)
    .filter((todo) => todo.last_notification_sent === null)
    .filter((todo) => {
      const reminderTime = calculateReminderTime(todo.due_date, todo.reminder_minutes);
      return reminderTime !== null && reminderTime.getTime() <= now.getTime();
    });

  return NextResponse.json({ success: true, data: dueTodos });
}
