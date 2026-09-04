# Analytics - User Behavior Tracking

**Status**: ✅ **IMPLEMENTED & PRODUCTION-READY**  
**Date**: 2026-09-04  
**Type**: Optional Enhancement

---

## Overview

The Analytics feature tracks user behavior across the todo app, providing insights into usage patterns, feature adoption, and user activity. This enables data-driven feature decisions and user engagement monitoring.

### Key Metrics Tracked

- **Event Types**: todo_created, todo_completed, todo_deleted, todo_updated, tag_created, tag_deleted, template_created, template_used, subtask_created, subtask_completed, export_initiated, import_initiated
- **Resource Tracking**: Event type, resource type (todo/tag/template/subtask), resource ID, and metadata
- **Time-based Analytics**: Daily, weekly, and monthly activity summaries
- **Event Breakdown**: Count of each event type over custom time periods

---

## Architecture

### Database Schema

**New Table: `events`**
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);
```

**Metadata Structure** (JSON-serialized):
```typescript
interface EventMetadata {
  [key: string]: string | number | boolean | null;
}
```

### CRUD Operations

**`lib/db.ts`** exports `eventDB` object with 4 methods:

1. **`log(userId, eventType, resourceType?, resourceId?, metadata?)`**
   - Creates and logs a new event
   - Returns the created Event object
   - Auto-timestamps with server time
   - Metadata is JSON-serialized for storage

2. **`getStats(userId, since?)`**
   - Returns `{ eventType: string; count: number }[]`
   - Groups by event type and counts occurrences
   - Optional `since` parameter filters by date (ISO 8601)
   - Sorted by count (descending)

3. **`getActivity(userId, limit?)`**
   - Returns array of Event objects (most recent first)
   - Default limit: 50, max: 500
   - Useful for activity feed displays

4. **`getSummary(userId)`**
   - Returns aggregate metrics:
     ```typescript
     {
       totalEvents: number;
       today: number;
       thisWeek: number;
       thisMonth: number;
     }
     ```

---

## API Endpoints

### `POST /api/analytics/log`
**Log a new event (client-side)**

```bash
curl -X POST http://localhost:3000/api/analytics/log \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "todo_created",
    "resourceType": "todo",
    "resourceId": 42,
    "metadata": {
      "priority": "high",
      "hasDueDate": true
    }
  }'
```

**Response** (201 Created):
```json
{
  "id": 1,
  "user_id": 1,
  "event_type": "todo_created",
  "resource_type": "todo",
  "resource_id": 42,
  "metadata": "{\"priority\":\"high\",\"hasDueDate\":true}",
  "created_at": "2026-09-04T17:24:57Z"
}
```

### `GET /api/analytics/stats`
**Get event type breakdown**

```bash
curl http://localhost:3000/api/analytics/stats
curl 'http://localhost:3000/api/analytics/stats?since=2026-09-01T00:00:00Z'
```

**Response** (200 OK):
```json
[
  { "eventType": "todo_created", "count": 15 },
  { "eventType": "todo_completed", "count": 8 },
  { "eventType": "tag_created", "count": 3 }
]
```

### `GET /api/analytics/summary`
**Get time-based activity summary**

```bash
curl http://localhost:3000/api/analytics/summary
```

**Response** (200 OK):
```json
{
  "totalEvents": 50,
  "today": 5,
  "thisWeek": 18,
  "thisMonth": 42
}
```

### `GET /api/analytics/activity`
**Get activity feed**

```bash
curl http://localhost:3000/api/analytics/activity?limit=20
```

**Response** (200 OK):
```json
[
  {
    "id": 10,
    "user_id": 1,
    "event_type": "todo_created",
    "resource_type": "todo",
    "resource_id": 42,
    "metadata": null,
    "created_at": "2026-09-04T17:24:50Z"
  },
  ...
]
```

---

## Client Integration

### useAnalytics Hook

**Location**: `lib/hooks/useAnalytics.ts`

```typescript
import { useAnalytics } from '@/lib/hooks/useAnalytics';

function MyComponent() {
  const { logEvent } = useAnalytics();

  const handleCreateTodo = async (todo) => {
    // ... create logic ...
    
    // Log the event (non-blocking, errors silently caught)
    void logEvent('todo_created', 'todo', todo.id, {
      priority: todo.priority,
      hasDueDate: !!todo.due_date,
    });
  };

  return <button onClick={handleCreateTodo}>Create Todo</button>;
}
```

**Type-Safe Event Types**:
```typescript
type EventType =
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
```

### Current Instrumentation

**In `app/page.tsx`:**
- ✅ `logEvent('todo_created', ...)` when a todo is created
- ✅ `logEvent('todo_completed', ...)` when a todo is marked complete
- ✅ `logEvent('todo_deleted', ...)` when a todo is deleted

---

## Analytics Dashboard

**Location**: `app/components/AnalyticsDashboard.tsx`

A ready-to-use React component that displays:
- **Summary Cards**: Total events, today's activity, this week, this month
- **Event Breakdown**: Bar chart of event types with counts
- **Real-time Fetch**: Fetches from `/api/analytics/summary` and `/api/analytics/stats`
- **Dark Mode Support**: Full Tailwind CSS 4 theming

**Usage**:
```typescript
import AnalyticsDashboard from '@/app/components/AnalyticsDashboard';

export default function AdminPage() {
  return <AnalyticsDashboard />;
}
```

---

## Implementation Details

### Auto-Instrumentation Points

The following events are **automatically logged** when users interact with the app:

1. **Todo Creation** (`todo_created`)
   - Triggered: After successful POST to `/api/todos`
   - Metadata: priority, hasDueDate
   - Resource: todo ID

2. **Todo Completion** (`todo_completed`)
   - Triggered: When marking incomplete todo as complete
   - Metadata: priority, isRecurring
   - Resource: todo ID

3. **Todo Deletion** (`todo_deleted`)
   - Triggered: After successful DELETE
   - Resource: todo ID

### Manual Event Logging

For additional events (tags, templates, subtasks), call `logEvent()` directly:

```typescript
const { logEvent } = useAnalytics();

// Tag creation
await createTag(name, color);
void logEvent('tag_created', 'tag', tagId);

// Template usage
await useTemplate(templateId);
void logEvent('template_used', 'template', templateId);

// Export/Import
await exportTodos();
void logEvent('export_initiated');
```

---

## Use Cases

### 1. **Feature Adoption Tracking**
Track how often different features are used:
```typescript
const stats = await fetch('/api/analytics/stats').then(r => r.json());
const templateUsage = stats.find(s => s.eventType === 'template_used')?.count || 0;
```

### 2. **User Engagement Metrics**
Monitor daily/weekly/monthly activity:
```typescript
const summary = await fetch('/api/analytics/summary').then(r => r.json());
console.log(`User completed ${summary.today} todos today`);
```

### 3. **Activity Timeline**
Show recent user actions in a dashboard:
```typescript
const activity = await fetch('/api/analytics/activity?limit=10').then(r => r.json());
activity.forEach(event => console.log(`${event.event_type} at ${event.created_at}`));
```

### 4. **Behavior Analysis**
Analyze patterns (e.g., which priorities are most often completed):
```typescript
// Completed todos with high priority have metadata.priority = 'high'
const highPriorityCompletions = events.filter(
  e => e.event_type === 'todo_completed' && 
       e.metadata.priority === 'high'
);
```

---

## Performance Characteristics

- **Write**: O(1) - Single INSERT statement with prepared query
- **Read (Stats)**: O(n) - Single full-table scan with GROUP BY (indexed on event_type)
- **Read (Activity)**: O(log n) - Index on created_at, LIMIT clause
- **Storage**: ~200 bytes per event (event metadata can be up to ~1KB)
- **Index Size**: ~3 indexes (user_id, event_type, created_at)

### Data Retention Strategy

Consider implementing a cleanup policy for old events (optional):
```sql
-- Delete events older than 90 days
DELETE FROM events WHERE created_at < datetime('now', '-90 days');
```

---

## Security

- ✅ **Auth Required**: All endpoints require valid session (401 if not authenticated)
- ✅ **Tenant Isolation**: Events only visible to their own user_id
- ✅ **No Sensitive Data**: Only event types, resource IDs, and generic metadata stored
- ✅ **No Personal Information**: Metadata kept minimal; avoid storing user PII

### Best Practices

1. **Avoid Logging PII**: Don't store names, emails, or sensitive data in metadata
2. **Sanitize Metadata**: Validate metadata keys/values before logging
3. **Rate Limiting**: Consider adding rate limits to `/api/analytics/log` in production

---

## Testing

### Manual Testing

```bash
# 1. Log an event
curl -X POST http://localhost:3000/api/analytics/log \
  -H "Content-Type: application/json" \
  -d '{"eventType":"todo_created","resourceType":"todo","resourceId":1}'

# 2. Get summary
curl http://localhost:3000/api/analytics/summary

# 3. Get stats
curl http://localhost:3000/api/analytics/stats

# 4. Get activity feed
curl http://localhost:3000/api/analytics/activity
```

### E2E Testing

```bash
# Run tests with analytics verification
npx playwright test --grep analytics
```

---

## Future Enhancements

- 🔄 **Advanced Filtering**: Filter by date range, event type, resource type
- 📊 **Export Analytics**: CSV/JSON export of event data
- 📈 **Trends**: Calculate week-over-week or month-over-month growth
- 🎯 **Funnels**: Track user journey through features (e.g., create → add subtasks → complete)
- 🔔 **Alerts**: Notify on anomalies (e.g., unusual activity drop)
- 🗂️ **Retention Policy**: Auto-delete events older than N days
- 🔐 **Privacy Mode**: Opt-out mechanism for analytics collection

---

## Files Added/Modified

### New Files (5)
- `lib/db.ts` → Added `Event` interface and `eventDB` CRUD object
- `lib/hooks/useAnalytics.ts` → Analytics logging hook
- `app/api/analytics/log/route.ts` → Event logging endpoint
- `app/api/analytics/stats/route.ts` → Stats breakdown endpoint
- `app/api/analytics/summary/route.ts` → Activity summary endpoint
- `app/api/analytics/activity/route.ts` → Activity feed endpoint
- `app/components/AnalyticsDashboard.tsx` → Dashboard component

### Modified Files (1)
- `app/page.tsx` → Integrated `useAnalytics()` hook and logging calls

---

## Summary

The Analytics enhancement provides:
- ✅ Real-time user behavior tracking
- ✅ Time-based activity insights
- ✅ Type-safe event logging
- ✅ Production-ready API endpoints
- ✅ Pre-built dashboard component
- ✅ Zero breaking changes to existing features
- ✅ Optional, fire-and-forget logging (no performance impact on failures)

Deploy with confidence — all analytics calls are non-blocking and gracefully degrade if the logging endpoint is unavailable.
