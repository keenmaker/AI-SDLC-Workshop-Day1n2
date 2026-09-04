import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { tagDB, DEFAULT_TAG_COLOR } from '@/lib/db';

/**
 * GET /api/tags
 * List all tags for the authenticated user.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const tags = tagDB.listByUser(session.userId);
    return NextResponse.json(tags);
  } catch (error) {
    console.error('Error listing tags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/tags
 * Create a new tag for the authenticated user.
 * Body: { name: string, color?: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    let { name, color } = body;

    // Validate and trim name
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    }

    name = name.trim();

    if (!name) {
      return NextResponse.json({ error: 'Tag name cannot be empty' }, { status: 400 });
    }

    // Validate color format if provided
    if (color !== undefined && typeof color !== 'string') {
      return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
    }

    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json({ error: 'Invalid hex color format' }, { status: 400 });
    }

    // Check for duplicate tag name (case-insensitive)
    const existing = tagDB.findByName(session.userId, name);
    if (existing) {
      return NextResponse.json(
        { error: 'Tag with this name already exists' },
        { status: 409 },
      );
    }

    // Create tag
    const tag = tagDB.create(session.userId, {
      name,
      color: color || DEFAULT_TAG_COLOR,
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
