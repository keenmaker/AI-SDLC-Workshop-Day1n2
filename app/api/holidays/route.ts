import { NextRequest, NextResponse } from 'next/server';
import { holidayDB } from '@/lib/db';
import { formatSingaporeDate } from '@/lib/timezone';

const DEFAULT_HOLIDAYS = [
  { date: '2025-01-01', name: 'New Year\'s Day' },
  { date: '2025-01-29', name: 'Chinese New Year' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-05-01', name: 'Labour Day' },
  { date: '2025-05-12', name: 'Vesak Day' },
  { date: '2025-06-07', name: 'Hari Raya Haji' },
  { date: '2025-08-09', name: 'National Day' },
  { date: '2025-11-06', name: 'Deepavali' },
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-02-17', name: 'Chinese New Year' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-05-31', name: 'Vesak Day' },
  { date: '2026-06-20', name: 'Hari Raya Haji' },
  { date: '2026-08-09', name: 'National Day' },
  { date: '2026-11-08', name: 'Deepavali' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2027-01-01', name: 'New Year\'s Day' },
  { date: '2027-02-07', name: 'Chinese New Year' },
  { date: '2027-03-26', name: 'Good Friday' },
  { date: '2027-05-01', name: 'Labour Day' },
  { date: '2027-05-20', name: 'Vesak Day' },
  { date: '2027-06-09', name: 'Hari Raya Haji' },
  { date: '2027-08-09', name: 'National Day' },
  { date: '2027-10-24', name: 'Deepavali' },
  { date: '2027-12-25', name: 'Christmas Day' },
];

function ensureDefaultsSeeded() {
  if (holidayDB.list().length > 0) return;

  for (const holiday of DEFAULT_HOLIDAYS) {
    holidayDB.upsert(holiday.date, holiday.name);
  }
}

function monthRange(year: number, month: number) {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(Date.UTC(year, month - 1, 1 - firstOfMonth.getUTCDay()));
  const endDay = new Date(Date.UTC(year, month, 0));
  const end = new Date(Date.UTC(year, month - 1, endDay.getUTCDate() + (6 - endDay.getUTCDay())));

  return {
    start: formatSingaporeDate(start),
    end: formatSingaporeDate(end),
  };
}

export async function GET(request: NextRequest) {
  ensureDefaultsSeeded();

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');

  let holidays = holidayDB.list();

  if (yearParam && monthParam) {
    const year = Number(yearParam);
    const month = Number(monthParam);

    if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
      const range = monthRange(year, month);
      holidays = holidays.filter((holiday) => holiday.date >= range.start && holiday.date <= range.end);
    }
  }

  return NextResponse.json({ holidays });
}
