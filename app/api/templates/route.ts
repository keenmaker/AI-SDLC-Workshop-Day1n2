import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { REMINDER_OPTIONS, templateDB } from '@/lib/db';

const templateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  title_template: z.string().trim().min(1),
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

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(templateDB.listByUser(session.userId));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
  }

  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid template data' }, { status: 400 });
  }
  if (
    parsed.data.is_recurring &&
    (!parsed.data.recurrence_pattern || parsed.data.due_date_offset_minutes == null)
  ) {
    return NextResponse.json(
      { error: 'Recurring templates require a due-date offset and pattern' },
      { status: 400 },
    );
  }

  const template = templateDB.create(session.userId, {
    ...parsed.data,
    subtasks: parsed.data.subtasks?.map((subtask, index) => ({
      title: subtask.title,
      position: index,
    })),
  });
  return NextResponse.json(template, { status: 201 });
}
