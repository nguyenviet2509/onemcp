'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Skeleton } from './ui/skeleton';
import { Alert, AlertDescription } from './ui/alert';
import { Template, listTemplates } from '../lib/api/templates';
import { cn } from '../lib/utils';

interface Props {
  selected: string | null;
  onSelect: (key: string) => void;
}

// Grid of template cards — click to select one.
// Fetches from listTemplates() on mount. Shows skeleton while loading.
// Icon budget: 0 (text-only cards).
export function TemplatePicker({ selected, onSelect }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTemplates()
      .then((all) => setTemplates(all.filter((t) => t.isActive)))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active templates available. Contact an admin.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="listbox" aria-label="Select a template">
      {templates.map((t) => {
        const isSelected = selected === t.key;
        return (
          <Card
            key={t.key}
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(t.key)}
            className={cn(
              'cursor-pointer transition-all',
              isSelected
                ? 'ring-2 ring-primary'
                : 'hover:ring-1 hover:ring-primary/40'
            )}
          >
            <CardHeader>
              <CardTitle className="text-sm">{t.label}</CardTitle>
              {t.deptSlug && (
                <span className="font-mono text-xs text-muted-foreground">{t.deptSlug}</span>
              )}
            </CardHeader>
            {t.description && (
              <CardContent>
                <CardDescription className="line-clamp-2 text-xs">
                  {t.description}
                </CardDescription>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
