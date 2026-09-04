import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

export interface CalendarDay {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

export function parseMonthParam(raw: string | null): { year: number; month: number } {
  const now = getSingaporeNow();
  const fallbackYear = Number(formatSingaporeDate(now).slice(0, 4));
  const fallbackMonth = Number(formatSingaporeDate(now).slice(5, 7));

  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const match = raw.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) {
        return { year, month };
      }
    }
  }

  return { year: fallbackYear, month: fallbackMonth };
}

export function generateCalendarGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = formatSingaporeDate(getSingaporeNow());

  const cells: CalendarDay[] = [];
  const totalCells = 42;
  const leadingDays = startWeekday;

  for (let index = 0; index < totalCells; index += 1) {
    const dayOffset = index - leadingDays + 1;
    const cellDate = new Date(Date.UTC(year, month - 1, dayOffset));
    const date = formatSingaporeDate(cellDate);
    const weekday = cellDate.getUTCDay();

    cells.push({
      date,
      isCurrentMonth: dayOffset >= 1 && dayOffset <= daysInMonth,
      isToday: date === today,
      isPast: date < today,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }

  return cells;
}

export function formatMonthQuery(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function getVisibleMonthWindow(year: number, month: number): { start: string; end: string } {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startCellDate = new Date(Date.UTC(year, month - 1, 1 - firstOfMonth.getUTCDay()));
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0));
  const endCellDate = new Date(
    Date.UTC(year, month - 1, lastDayOfMonth.getUTCDate() + (6 - lastDayOfMonth.getUTCDay())),
  );

  return {
    start: formatSingaporeDate(startCellDate),
    end: formatSingaporeDate(endCellDate),
  };
}
