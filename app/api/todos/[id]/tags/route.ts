import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';

/**
 * POST /api/todos/[id]/tags
 * Attach a tag to a todo (idempotent).
 * Body: { tag_id: number }
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
    const { tag_id } = body;

    if (!tag_id || typeof tag_id !== 'number') {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
    }

    // Verify todo belongs to session user
    const todo = todoDB.findById(todoId, session.userId);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Verify tag belongs to session user
    const tag = tagDB.findById(tag_id, session.userId);
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Attach tag (idempotent)
    tagDB.attach(todoId, tag_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error attaching tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/todos/[id]/tags
 * Detach a tag from a todo (idempotent).
 * Body: { tag_id: number }
 */
export async function DELETE(
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
    const { tag_id } = body;

    if (!tag_id || typeof tag_id !== 'number') {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
    }

    // Verify todo belongs to session user
    const todo = todoDB.findById(todoId, session.userId);
    if (!todo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    // Verify tag belongs to session user
    const tag = tagDB.findById(tag_id, session.userId);
    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Detach tag (idempotent)
    tagDB.detach(todoId, tag_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error detaching tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
