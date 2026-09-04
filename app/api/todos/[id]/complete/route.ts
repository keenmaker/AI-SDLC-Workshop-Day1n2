import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB, tagDB, runInTransaction, type Todo } from '@/lib/db';
import { calculateNextDueDate } from '@/lib/timezone';

/**
 * POST /api/todos/[id]/complete
 *
 * Marks a todo complete and, when it is recurring, atomically creates the
 * next occurrence (same title/priority/tags/pattern/reminder, with a
 * clamped due date one interval ahead) in the same transaction.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const todoId = Number(id);
  if (!Number.isInteger(todoId)) {
    return NextResponse.json({ error: 'Invalid todo id' }, { status: 400 });
  }

  const existing = todoDB.findById(todoId, session.userId);
  if (!existing) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });

  const result = runInTransaction(() => {
    const completed = todoDB.update(todoId, session.userId, { completed: true });
    if (!completed) throw new Error('Failed to complete todo');

    let nextTodo: Todo | null = null;

    if (completed.is_recurring && completed.recurrence_pattern && completed.due_date) {
      const nextDueDate = calculateNextDueDate(completed.due_date, completed.recurrence_pattern);

      nextTodo = todoDB.create(session.userId, {
        title: completed.title,
        due_date: nextDueDate,
        priority: completed.priority,
        is_recurring: true,
        recurrence_pattern: completed.recurrence_pattern,
        reminder_minutes: completed.reminder_minutes,
        completed: false,
      });

      const tagIds = (completed.tags ?? []).map((tag) => tag.id);
      if (tagIds.length > 0) {
        tagDB.setForTodo(nextTodo.id, tagIds);
        nextTodo = todoDB.findById(nextTodo.id, session.userId);
      }
    }

    return { completed, nextTodo };
  });

  return NextResponse.json({ success: true, data: result });
}
