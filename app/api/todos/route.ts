import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { sectionTodos, sortTodos } from '@/lib/sort';
import { validateTodoPayload } from './_lib/validation';

/** GET /api/todos — all todos for the session user, sorted and sectioned. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const todos = todoDB.listByUser(session.userId);

  return NextResponse.json({
    todos: sortTodos(todos),
    sections: sectionTodos(todos),
  });
}

/** POST /api/todos — create a todo. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const validated = validateTodoPayload(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const todo = todoDB.create(session.userId, validated.value);
  return NextResponse.json({ todo }, { status: 201 });
}
