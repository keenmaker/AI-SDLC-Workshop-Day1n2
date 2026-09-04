import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB, todoDB } from '@/lib/db';

/**
 * POST /api/todos/[id]/subtasks
 * Create a new subtask under a todo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const todoId = Number(id);

  try {
    const body = await request.json();
    const { title } = body;

    // Validate title is not empty/whitespace
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Subtask title is required' }, { status: 400 });
    }

    // Verify ownership: todo must belong to current user
    const todo = todoDB.findById(todoId, session.userId);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Create subtask
    const subtask = subtaskDB.create(todoId, title.trim());

    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error) {
    console.error('Error creating subtask:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
