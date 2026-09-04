import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

/**
 * PUT /api/tags/[id]
 * Update a tag (name and/or color).
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
  const tagId = Number(id);

  try {
    const body = await request.json();
    const { name, color } = body;

    // Verify ownership
    const existing = tagDB.findById(tagId, session.userId);
    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Validate color if provided
    if (color !== undefined && typeof color !== 'string') {
      return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
    }

    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json({ error: 'Invalid hex color format' }, { status: 400 });
    }

    // Validate name if provided
    let trimmedName = name;
    if (name !== undefined) {
      if (typeof name !== 'string') {
        return NextResponse.json({ error: 'Invalid name format' }, { status: 400 });
      }

      trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 });
      }

      // Check for duplicate only if name is changing
      if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = tagDB.findByName(session.userId, trimmedName);
        if (duplicate) {
          return NextResponse.json(
            { error: 'Tag with this name already exists' },
            { status: 409 },
          );
        }
      }
    }

    // Update tag
    const updated = tagDB.update(tagId, session.userId, {
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(color !== undefined && { color }),
    });

    if (!updated) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/tags/[id]
 * Delete a tag (cascades to todo_tags via foreign key).
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
  const tagId = Number(id);

  try {
    // Verify ownership
    const existing = tagDB.findById(tagId, session.userId);
    if (!existing) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    // Delete tag
    const deleted = tagDB.delete(tagId, session.userId);

    if (!deleted) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
