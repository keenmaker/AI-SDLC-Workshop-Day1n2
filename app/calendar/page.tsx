'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarGrid } from '@/components/CalendarGrid';
import { DayTodosModal } from '@/components/DayTodosModal';
import { formatMonthQuery, parseMonthParam } from '@/lib/calendar';
import type { Holiday, Todo } from '@/lib/db';

function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedMonth = parseMonthParam(searchParams.get('month'));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const [todoResponse, holidayResponse] = await Promise.all([
          fetch('/api/todos'),
          fetch(`/api/holidays?year=${selectedMonth.year}&month=${selectedMonth.month}`),
        ]);

        const todoData = todoResponse.ok ? await todoResponse.json() : { todos: [] };
        const holidayData = holidayResponse.ok ? await holidayResponse.json() : { holidays: [] };

        if (ignore) return;

        setTodos(Array.isArray(todoData.todos) ? todoData.todos : []);
        setHolidays(Array.isArray(holidayData.holidays) ? holidayData.holidays : []);
      } catch {
        if (!ignore) {
          setTodos([]);
          setHolidays([]);
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [selectedMonth.year, selectedMonth.month]);

  function navigate(nextYear: number, nextMonth: number) {
    const query = formatMonthQuery(nextYear, nextMonth);
    router.push(`/calendar?month=${query}`);
  }

  const selectedTodos = selectedDate
    ? todos.filter((todo) => todo.due_date && todo.due_date.startsWith(selectedDate))
    : [];

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
            Calendar
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Schedule overview</h1>
        </div>
        <Link
          href="/"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Back to list
        </Link>
      </div>

      <CalendarGrid
        year={selectedMonth.year}
        month={selectedMonth.month}
        todos={todos}
        holidays={holidays}
        onSelectDay={setSelectedDate}
        onNavigate={navigate}
      />

      {selectedDate && (
        <DayTodosModal
          date={selectedDate}
          todos={selectedTodos}
          holiday={holidays.find((item) => item.date === selectedDate) ?? null}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </main>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Loading calendar...
          </div>
        </main>
      }
    >
      <CalendarPageContent />
    </Suspense>
  );
}
