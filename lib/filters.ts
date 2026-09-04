import type { Priority, Todo } from '@/lib/db';
import {
  formatSingaporeDate,
  getSingaporeNow,
  parseSingaporeDateTime,
} from '@/lib/timezone';

export type CompletionFilter = 'all' | 'incomplete' | 'completed';

export interface FilterState {
  search: string;
  priority: Priority | 'all';
  tagId: number | 'all';
  completion: CompletionFilter;
  dueDateFrom: string | null;
  dueDateTo: string | null;
}

export const DEFAULT_FILTER_STATE: FilterState = {
  search: '',
  priority: 'all',
  tagId: 'all',
  completion: 'all',
  dueDateFrom: null,
  dueDateTo: null,
};

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

export const PRESETS_KEY = 'todo-app:filter-presets';

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.priority !== 'all' ||
    filters.tagId !== 'all' ||
    filters.completion !== 'all' ||
    filters.dueDateFrom !== null ||
    filters.dueDateTo !== null
  );
}

export function applyFilters(todos: Todo[], filters: FilterState): Todo[] {
  let result = todos;
  const query = filters.search.trim().toLowerCase();

  if (query) {
    result = result.filter((todo) => {
      if (todo.title.toLowerCase().includes(query)) return true;
      return (todo.subtasks ?? []).some((subtask) =>
        subtask.title.toLowerCase().includes(query),
      );
    });
  }

  if (filters.priority !== 'all') {
    result = result.filter((todo) => todo.priority === filters.priority);
  }

  if (filters.tagId !== 'all') {
    result = result.filter((todo) =>
      (todo.tags ?? []).some((tag) => tag.id === filters.tagId),
    );
  }

  if (filters.completion === 'incomplete') {
    result = result.filter((todo) => !todo.completed);
  } else if (filters.completion === 'completed') {
    result = result.filter((todo) => todo.completed);
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    result = result.filter((todo) => {
      if (!todo.due_date) return false;
      const parsedDueDate = parseSingaporeDateTime(todo.due_date);
      if (!parsedDueDate) return false;
      const dueDate = formatSingaporeDate(parsedDueDate);
      return (
        (!filters.dueDateFrom || dueDate >= filters.dueDateFrom) &&
        (!filters.dueDateTo || dueDate <= filters.dueDateTo)
      );
    });
  }

  return result;
}

function isFilterState(value: unknown): value is FilterState {
  if (!value || typeof value !== 'object') return false;
  const filters = value as Partial<FilterState>;
  return (
    typeof filters.search === 'string' &&
    (filters.priority === 'all' ||
      filters.priority === 'high' ||
      filters.priority === 'medium' ||
      filters.priority === 'low') &&
    (filters.tagId === 'all' ||
      (typeof filters.tagId === 'number' &&
        Number.isInteger(filters.tagId) &&
        filters.tagId >= 0)) &&
    (filters.completion === 'all' ||
      filters.completion === 'incomplete' ||
      filters.completion === 'completed') &&
    (filters.dueDateFrom === null || typeof filters.dueDateFrom === 'string') &&
    (filters.dueDateTo === null || typeof filters.dueDateTo === 'string')
  );
}

function isFilterPreset(value: unknown): value is FilterPreset {
  if (!value || typeof value !== 'object') return false;
  const preset = value as Partial<FilterPreset>;
  return (
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.createdAt === 'string' &&
    isFilterState(preset.filters)
  );
}

export function loadPresets(): FilterPreset[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isFilterPreset) : [];
  } catch (error) {
    console.error('Failed to load filter presets:', error);
    return [];
  }
}

export function savePreset(preset: FilterPreset): FilterPreset[] {
  if (typeof window === 'undefined') {
    throw new Error('Cannot save a filter preset outside the browser');
  }

  const presets = [...loadPresets(), preset];
  try {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (error) {
    console.error('Failed to save filter preset:', error);
    throw new Error('Could not save preset - storage full', { cause: error });
  }
  return presets;
}

export function deletePreset(id: string): FilterPreset[] {
  const presets = loadPresets().filter((preset) => preset.id !== id);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch (error) {
      console.error('Failed to delete filter preset:', error);
      throw new Error('Could not update saved presets', { cause: error });
    }
  }
  return presets;
}

export function createFilterPreset(name: string, filters: FilterState): FilterPreset {
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    filters: { ...filters },
    createdAt: getSingaporeNow().toISOString(),
  };
}

export function getAvailableTagIds(todos: Todo[]): Set<number> {
  return new Set(
    todos.flatMap((todo) => (todo.tags ?? []).map((tag) => tag.id)),
  );
}
