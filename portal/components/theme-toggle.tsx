'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

// Text-only theme toggle — zero new icons (budget preserved ≤5).
// Cycles: dark → light → system → dark.
// Mounted guard avoids hydration mismatch (next-themes SSR pattern).
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="text-xs text-slate-600 cursor-default" aria-label="Loading theme">
        Theme
      </button>
    );
  }

  const labels: Record<string, string> = {
    dark: 'Dark',
    light: 'Light',
    system: 'System',
  };

  const nextTheme: Record<string, string> = {
    dark: 'light',
    light: 'system',
    system: 'dark',
  };

  const current = theme ?? 'dark';

  return (
    <button
      onClick={() => setTheme(nextTheme[current] ?? 'dark')}
      className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
      aria-label={`Switch theme (current: ${labels[current] ?? current})`}
      title="Click to cycle theme"
    >
      Theme: {labels[current] ?? current}
    </button>
  );
}
