import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { parseId, validateTodoPayload, type TodoPayload } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/todos/[id] */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseId(id);
  if (todoId === null) {
    return NextResponse.json({ error: 'Invalid todo id' }, { status: 400 });
  }

  const todo = todoDB.findById(todoId, session.userId);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ todo });
}

/**
 * PUT /api/todos/[id] — update a todo.
 *
 * Accepts partial payloads; omitted fields keep their current values.
 *
 * Note: completing a recurring todo must also spawn the next instance. That
 * belongs to feature 03 and is added in step 5; this handler currently updates
 * the todo only.
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseId(id);
  if (todoId === null) {
    return NextResponse.json({ error: 'Invalid todo id' }, { status: 400 });
  }

  const existing = todoDB.findById(todoId, session.userId);
  if (!existing) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const current: TodoPayload = {
    title: existing.title,
    due_date: existing.due_date,
    priority: existing.priority,
    is_recurring: existing.is_recurring,
    recurrence_pattern: existing.recurrence_pattern,
    reminder_minutes: existing.reminder_minutes,
    completed: existing.completed,
  };

  const validated = validateTodoPayload(body, { partial: true, existing: current });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const todo = todoDB.update(todoId, session.userId, validated.value);
  if (!todo) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ todo });
}

/** DELETE /api/todos/[id] — immediate, cascades to subtasks and tags. */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = parseId(id);
  if (todoId === null) {
    return NextResponse.json({ error: 'Invalid todo id' }, { status: 400 });
  }

  if (!todoDB.delete(todoId, session.userId)) {
    return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
