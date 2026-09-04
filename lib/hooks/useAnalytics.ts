import { useCallback } from 'react';

export type EventType =
  | 'todo_created'
  | 'todo_completed'
  | 'todo_deleted'
  | 'todo_updated'
  | 'tag_created'
  | 'tag_deleted'
  | 'template_created'
  | 'template_used'
  | 'subtask_created'
  | 'subtask_completed'
  | 'export_initiated'
  | 'import_initiated'
  | 'page_view';

export interface EventMetadata {
  [key: string]: string | number | boolean | null;
}

export function useAnalytics() {
  const logEvent = useCallback(
    async (
      eventType: EventType,
      resourceType?: string,
      resourceId?: number,
      metadata?: EventMetadata,
    ) => {
      try {
        await fetch('/api/analytics/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType,
            resourceType,
            resourceId,
            metadata,
          }),
        });
      } catch (error) {
        console.error('Failed to log event:', error);
      }
    },
    [],
  );

  return { logEvent };
}
