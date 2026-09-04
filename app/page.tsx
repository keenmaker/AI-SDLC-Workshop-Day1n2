'use client';

import { useState, useEffect } from 'react';
import type { Subtask, Tag } from '@/lib/db';
import { calculateProgress } from '@/lib/db';
import { ManageTagsModal } from '@/app/components/ManageTagsModal';
import { TagSelector } from '@/app/components/TagSelector';

/**
 * ProgressBar component
 * Displays progress of subtask completion with visual bar and percentage.
 */
function ProgressBar({
  completed,
  total,
  percent,
}: {
  completed: number;
  total: number;
  percent: number;
}) {
  // No bar when there are no subtasks
  if (total === 0) return null;

  // Blue below 100%, green at 100%
  const barColor = percent === 100 ? 'bg-green-500' : 'bg-blue-500';

  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span>{completed}/{total} subtasks</span>
        <span>{percent}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-200`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * SubtaskList component
 * Expandable subtask checklist with add/toggle/delete functionality.
 */
function SubtaskList({
  todoId,
  subtasks = [],
  onChange,
}: {
  todoId: number;
  subtasks: Subtask[];
  onChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const progress = calculateProgress(subtasks);
  const { completed, total, percent } = progress;

  const addSubtask = async () => {
    const title = newTitle.trim();
    if (!title) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/todos/${todoId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (response.ok) {
        setNewTitle('');
        onChange();
      }
    } catch (error) {
      console.error('Error adding subtask:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    try {
      const response = await fetch(`/api/subtasks/${subtask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !subtask.completed }),
      });

      if (response.ok) {
        onChange();
      }
    } catch (error) {
      console.error('Error updating subtask:', error);
    }
  };

  const deleteSubtask = async (id: number) => {
    try {
      const response = await fetch(`/api/subtasks/${id}`, { method: 'DELETE' });

      if (response.ok) {
        onChange();
      }
    } catch (error) {
      console.error('Error deleting subtask:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtask();
    }
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        {expanded ? '▼' : '▶'} Subtasks
      </button>

      <ProgressBar completed={completed} total={total} percent={percent} />

      {expanded && (
        <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
          {/* Existing subtasks */}
          {subtasks.map((s) => (
            <div key={s.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={s.completed}
                onChange={() => toggleSubtask(s)}
                className="w-4 h-4 cursor-pointer"
              />
              <span
                className={`flex-1 text-sm ${
                  s.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {s.title}
              </span>
              <button
                onClick={() => deleteSubtask(s.id)}
                className="ml-auto text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Add new subtask */}
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add subtask..."
              disabled={isLoading}
              className="flex-1 border rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 disabled:opacity-50"
            />
            <button
              onClick={addSubtask}
              disabled={isLoading || !newTitle.trim()}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main page component with todo list, subtasks, and tag management.
 */
export default function Home() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [showManageTagsModal, setShowManageTagsModal] = useState(false);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  // Load tags on mount
  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setIsLoadingTags(true);
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        const data = await response.json();
        setTags(data);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleCreateTag = async (input: { name: string; color?: string }) => {
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create tag');
      }

      await loadTags();
    } catch (error) {
      throw error;
    }
  };

  const handleUpdateTag = async (
    id: number,
    input: { name?: string; color?: string },
  ) => {
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tag');
      }

      await loadTags();
    } catch (error) {
      throw error;
    }
  };

  const handleDeleteTag = async (id: number) => {
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete tag');
      }

      await loadTags();
    } catch (error) {
      throw error;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Todo App</h1>
          <button
            onClick={() => setShowManageTagsModal(true)}
            className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            + Manage Tags
          </button>
        </div>

        {/* Tag Selector Section */}
        {!isLoadingTags && tags.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Filter by tags:
            </h2>
            <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
          </div>
        )}

        {/* Placeholder for Todo List Component */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-gray-600 dark:text-gray-400">
            Subtasks & Progress Tracking (PRP-05) + Tag System (PRP-06) - Components ready for
            integration
          </p>
        </div>

        {/* Manage Tags Modal */}
        {showManageTagsModal && (
          <ManageTagsModal
            tags={tags}
            onClose={() => setShowManageTagsModal(false)}
            onCreate={handleCreateTag}
            onUpdate={handleUpdateTag}
            onDelete={handleDeleteTag}
          />
        )}
      </div>
    </main>
  );
}
