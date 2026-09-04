'use client';

import type { Tag } from '@/lib/db';

/**
 * TagPill component
 * Displays a tag with optional selection state and click handler.
 */
export function TagPill({
  tag,
  selected = false,
  onClick,
}: {
  tag: Tag;
  selected?: boolean;
  onClick?: (tag: Tag) => void;
}) {
  if (selected) {
    return (
      <button
        onClick={() => onClick?.(tag)}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium text-white transition-all hover:opacity-90 cursor-pointer"
        style={{ backgroundColor: tag.color }}
        title={tag.name}
      >
        <span className="truncate max-w-[10rem]">{tag.name}</span>
        <span>✓</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => onClick?.(tag)}
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 transition-all hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
      title={tag.name}
    >
      <span className="truncate max-w-[10rem]">{tag.name}</span>
    </button>
  );
}
