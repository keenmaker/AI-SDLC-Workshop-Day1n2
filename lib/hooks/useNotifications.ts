'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Todo } from '@/lib/db';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

const POLL_INTERVAL_MS = 30_000;

/**
 * Requests browser notification permission and polls
 * `/api/notifications/check` every 30 seconds while permission is granted.
 * Each due reminder fires exactly one `Notification` (deduped by `tag`) and
 * immediately stamps `last_notification_sent` server-side so refreshes,
 * multiple tabs, or restarts don't re-fire it.
 */
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  );

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch('/api/notifications/check');
        if (!res.ok || cancelled) return;

        const { data: dueTodos } = (await res.json()) as { data: Todo[] };
        if (cancelled || Notification.permission !== 'granted') return;

        for (const todo of dueTodos) {
          new Notification(todo.title, {
            body: `Due ${formatSingaporeDate(todo.due_date ? new Date(todo.due_date) : getSingaporeNow())}`,
            tag: `todo-${todo.id}`,
          });

          await fetch(`/api/notifications/${todo.id}/sent`, { method: 'POST' });
        }
      } catch {
        // Network hiccups are silently retried on the next poll tick.
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [permission]);

  return { permission, requestPermission };
}
