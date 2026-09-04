'use client';

import { useState } from 'react';
import type { Tag } from '@/lib/db';
import { TagPill } from './TagPill';

/**
 * TagSelector component
 * Displays all user's tags as pills for selection.
 */
export function TagSelector({
  tags,
  selectedIds = [],
  onChange,
}: {
  tags: Tag[];
  selectedIds?: number[];
  onChange: (selectedIds: number[]) => void;
}) {
  const handleToggle = (tag: Tag) => {
    const newSelectedIds = selectedIds.includes(tag.id)
      ? selectedIds.filter((id) => id !== tag.id)
      : [...selectedIds, tag.id];
    onChange(newSelectedIds);
  };

  if (tags.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No tags available. Create one using Manage Tags.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <TagPill
          key={tag.id}
          tag={tag}
          selected={selectedIds.includes(tag.id)}
          onClick={() => handleToggle(tag)}
        />
      ))}
    </div>
  );
}
