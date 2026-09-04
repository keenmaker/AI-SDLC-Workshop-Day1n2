import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subtaskDB } from '@/lib/db';

/**
 * PUT /api/subtasks/[id]
 * Toggle completion and/or rename a subtask.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await params;
  const subtaskId = Number(id);

  try {
    const body = await request.json();
    const { completed, title } = body;

    // Verify ownership via subtaskDB.findOwnerUserId
    const ownerId = subtaskDB.findOwnerUserId(subtaskId);
    if (ownerId === null || ownerId !== session.userId) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    // Update subtask
    const updated = subtaskDB.update(subtaskId, {
      ...(completed !== undefined && { completed }),
      ...(title !== undefined && { title }),
    });

    if (!updated) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating subtask:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/subtasks/[id]
 * Permanently remove a subtask.
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
  const subtaskId = Number(id);

  try {
    // Verify ownership via subtaskDB.findOwnerUserId
    const ownerId = subtaskDB.findOwnerUserId(subtaskId);
    if (ownerId === null || ownerId !== session.userId) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    // Delete subtask
    const deleted = subtaskDB.delete(subtaskId);

    if (!deleted) {
      return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subtask:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
