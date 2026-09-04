import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { REMINDER_OPTIONS } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { importTodos } from '@/lib/export-import';
import { parseSingaporeDateTime, toStorageDateTime } from '@/lib/timezone';

const storedDate = z
  .string()
  .min(1)
  .refine((value) => parseSingaporeDateTime(value) !== null, 'Invalid date')
  .transform((value) => toStorageDateTime(value) as string);
const reminder = z
  .number()
  .int()
  .nullable()
  .refine((value) => value === null || REMINDER_OPTIONS.includes(value as (typeof REMINDER_OPTIONS)[number]), {
    message: 'Invalid reminder',
  });
const todoItemSchema = z
  .object({
      title: z.string().min(1),
      completed: z.boolean(),
      due_date: storedDate.nullable(),
      priority: z.enum(['high', 'medium', 'low']),
      is_recurring: z.boolean(),
      recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable(),
      reminder_minutes: reminder,
      created_at: storedDate,
      subtasks: z.array(
        z.object({
          title: z.string().min(1),
          completed: z.boolean(),
          position: z.number().int(),
        }),
      ),
      tags: z.array(z.object({ name: z.string().min(1), color: z.string() })),
    })
  .superRefine((item, context) => {
    if (item.is_recurring && (!item.recurrence_pattern || !item.due_date)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Recurring todos require a due date and recurrence pattern',
      });
    }
  });
const importSchema = z.object({
  version: z.literal(1),
  exported_at: storedDate,
  todos: z.array(todoItemSchema),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
  }

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Failed to import todos. Please check the file format.' },
      { status: 400 },
    );
  }

  try {
    const result = importTodos(session.userId, parsed.data.todos);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json({ error: 'Failed to import todos' }, { status: 500 });
  }
}
