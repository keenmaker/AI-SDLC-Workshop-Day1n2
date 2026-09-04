'use client';

import { useEffect, useState } from 'react';

interface AnalyticsSummary {
  totalEvents: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface EventStat {
  eventType: string;
  count: number;
}

export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [stats, setStats] = useState<EventStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [summaryRes, statsRes] = await Promise.all([
          fetch('/api/analytics/summary'),
          fetch('/api/analytics/stats'),
        ]);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading analytics...</div>;
  }

  if (!summary) {
    return <div className="p-6 text-center text-gray-500">No analytics data available</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Analytics Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Events</div>
          <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {summary.totalEvents}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Today</div>
          <div className="mt-2 text-3xl font-bold text-blue-600">{summary.today}</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">This Week</div>
          <div className="mt-2 text-3xl font-bold text-green-600">{summary.thisWeek}</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">This Month</div>
          <div className="mt-2 text-3xl font-bold text-purple-600">{summary.thisMonth}</div>
        </div>
      </div>

      {/* Event Type Breakdown */}
      <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Event Breakdown</h3>
        </div>
        <div className="p-4">
          {stats.length > 0 ? (
            <div className="space-y-3">
              {stats.map((stat) => (
                <div key={stat.eventType} className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {stat.eventType.replace(/_/g, ' ')}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-32 rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-2 rounded-full bg-blue-500"
                        style={{ width: `${Math.min((stat.count / Math.max(...stats.map((s) => s.count)) || 1) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {stat.count}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500">No events logged yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
