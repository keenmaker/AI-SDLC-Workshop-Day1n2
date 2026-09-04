import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { parseTemplateSubtasks, runInTransaction, subtaskDB, templateDB, todoDB } from '@/lib/db';
import { addMinutes, formatSingaporeDateTime, getSingaporeNow } from '@/lib/timezone';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
  const template = templateDB.findById(id, session.userId);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  if (template.is_recurring && template.due_date_offset_minutes == null) {
    return NextResponse.json(
      { error: 'Recurring templates require a due-date offset' },
      { status: 400 },
    );
  }

  const dueDate =
    template.due_date_offset_minutes == null
      ? null
      : formatSingaporeDateTime(addMinutes(getSingaporeNow(), template.due_date_offset_minutes));

  const todo = runInTransaction(() => {
    const created = todoDB.create(session.userId, {
      title: template.title_template,
      priority: template.priority,
      due_date: dueDate,
      is_recurring: template.is_recurring,
      recurrence_pattern: template.recurrence_pattern,
      reminder_minutes: template.reminder_minutes,
    });
    for (const subtask of parseTemplateSubtasks(template.subtasks_json)) {
      subtaskDB.create(created.id, subtask.title, subtask.position);
    }
    return todoDB.findById(created.id, session.userId);
  });

  return NextResponse.json(todo, { status: 201 });
}
