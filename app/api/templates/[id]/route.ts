import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { REMINDER_OPTIONS, templateDB } from '@/lib/db';

const updateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  title_template: z.string().trim().min(1).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  is_recurring: z.boolean().optional(),
  recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable().optional(),
  reminder_minutes: z
    .number()
    .int()
    .nullable()
    .refine((value) => value === null || REMINDER_OPTIONS.includes(value as (typeof REMINDER_OPTIONS)[number]), {
      message: 'Invalid reminder',
    })
    .optional(),
  due_date_offset_minutes: z.number().int().nullable().optional(),
  subtasks: z
    .array(z.object({ title: z.string().trim().min(1), position: z.number().int().optional() }))
    .nullable()
    .optional(),
});

function parseId(id: string): number | null {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const id = parseId((await params).id);
  if (id === null) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid template data' }, { status: 400 });

  const existing = templateDB.findById(id, session.userId);
  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  const recurring = parsed.data.is_recurring ?? existing.is_recurring;
  const offset =
    parsed.data.due_date_offset_minutes !== undefined
      ? parsed.data.due_date_offset_minutes
      : existing.due_date_offset_minutes;
  const pattern =
    parsed.data.recurrence_pattern !== undefined
      ? parsed.data.recurrence_pattern
      : existing.recurrence_pattern;
  if (recurring && (!pattern || offset == null)) {
    return NextResponse.json(
      { error: 'Recurring templates require a due-date offset and pattern' },
      { status: 400 },
    );
  }

  const template = templateDB.update(id, session.userId, {
    ...parsed.data,
    subtasks: parsed.data.subtasks?.map((subtask, index) => ({
      title: subtask.title,
      position: index,
    })),
  });
  return NextResponse.json(template);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const id = parseId((await params).id);
  if (id === null || !templateDB.delete(id, session.userId)) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
