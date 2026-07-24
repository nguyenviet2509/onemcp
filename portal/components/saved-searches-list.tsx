'use client';

// SavedSearchesList — sidebar slot placeholder for Phase 3D implementation.
// Renders a static stub so layout.tsx can mount it without compile errors.
// Full list rendering (fetch, click-to-rerun) is Phase 3D scope.
export function SavedSearchesList() {
  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary-400 dark:text-secondary-600">
        Saved searches
      </p>
      {/* TODO(3D): replace with actual saved-searches list from useSavedSearches() hook */}
      <p className="text-xs text-secondary-400 dark:text-secondary-600">
        No saved searches yet.
      </p>
    </div>
  );
}
