'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from './ui/skeleton';

// @uiw/react-md-editor uses window — must be client-only, no SSR.
// Dynamic import with ssr:false prevents hydration errors.
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Min editor height in px. Defaults to 300. */
  minHeight?: number;
}

// Thin wrapper around @uiw/react-md-editor with live preview split view.
// Dynamic-imported (ssr:false) — safe to use in any client page.
// Keeps bundle impact isolated to pages that render this component.
export function MarkdownEditor({ value, onChange, minHeight = 300 }: Props) {
  return (
    <div data-color-mode="light" className="dark:hidden">
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        preview="live"
        height={minHeight}
        visibleDragbar={false}
      />
    </div>
  );
}

// Dark-mode variant — rendered only in dark context via CSS class toggle.
// @uiw/react-md-editor reads data-color-mode attribute for theme.
export function MarkdownEditorDark({ value, onChange, minHeight = 300 }: Props) {
  return (
    <div data-color-mode="dark" className="hidden dark:block">
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? '')}
        preview="live"
        height={minHeight}
        visibleDragbar={false}
      />
    </div>
  );
}
