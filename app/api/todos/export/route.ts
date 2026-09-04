import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { formatSingaporeDate, formatSingaporeDateTime, getSingaporeNow } from '@/lib/timezone';
import { toCsv, toExportItem, type TodoExport } from '@/lib/export-import';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const format = request.nextUrl.searchParams.get('format') ?? 'json';
  if (format !== 'json' && format !== 'csv') {
    return NextResponse.json({ error: 'Format must be json or csv' }, { status: 400 });
  }

  const now = getSingaporeNow();
  const date = formatSingaporeDate(now);
  const todos = todoDB.listByUser(session.userId);

  if (format === 'csv') {
    return new NextResponse(toCsv(todos), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="todos-${date}.csv"`,
      },
    });
  }

  const payload: TodoExport = {
    version: 1,
    exported_at: formatSingaporeDateTime(now),
    todos: todos.map(toExportItem),
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="todos-${date}.json"`,
    },
  });
}
