'use client';

import { useState } from 'react';
import type { Tag } from '@/lib/db';
import { TagPill } from './TagPill';

/**
 * ManageTagsModal component
 * Modal for managing tags: create, edit, and delete.
 */
export function ManageTagsModal({
  tags,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  tags: Tag[];
  onClose: () => void;
  onCreate: (input: { name: string; color?: string }) => Promise<void>;
  onUpdate: (id: number, input: { name?: string; color?: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      setError('Tag name is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onCreate({ name, color: newTagColor });
      setNewTagName('');
      setNewTagColor('#3B82F6');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTag = async () => {
    if (!editingId) return;

    const updates: { name?: string; color?: string } = {};
    if (editName.trim()) {
      updates.name = editName.trim();
    }
    if (editColor) {
      updates.color = editColor;
    }

    if (Object.keys(updates).length === 0) {
      setEditingId(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await onUpdate(editingId, updates);
      setEditingId(null);
      setEditName('');
      setEditColor('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm('Delete this tag?')) return;

    setIsLoading(true);
    setError(null);
    try {
      await onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manage Tags</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Create New Tag Section */}
          <div className="border-b dark:border-gray-700 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Create New Tag
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name..."
                  disabled={isLoading}
                  className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Color
                </label>
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  disabled={isLoading}
                  className="w-12 h-10 border rounded cursor-pointer disabled:opacity-50"
                />
              </div>
              <button
                onClick={handleCreateTag}
                disabled={isLoading || !newTagName.trim()}
                className="w-full bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Tag
              </button>
            </div>
          </div>

          {/* Tags List Section */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              All Tags ({tags.length})
            </h3>
            {tags.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No tags yet.</p>
            ) : (
              <div className="space-y-3">
                {tags.map((tag) =>
                  editingId === tag.id ? (
                    <div key={tag.id} className="border dark:border-gray-700 rounded p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tag Name
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={isLoading}
                          className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Color
                        </label>
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          disabled={isLoading}
                          className="w-12 h-10 border rounded cursor-pointer disabled:opacity-50"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateTag}
                          disabled={isLoading}
                          className="flex-1 bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={isLoading}
                          className="flex-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 px-4 py-2 rounded hover:bg-gray-400 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-3 border dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <TagPill tag={tag} selected={true} />
                        <span className="text-gray-600 dark:text-gray-400 text-sm">
                          {tag.name}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(tag)}
                          disabled={isLoading}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          disabled={isLoading}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
