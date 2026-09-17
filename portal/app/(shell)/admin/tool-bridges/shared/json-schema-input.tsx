'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface JsonSchemaInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (raw: string, parsed: Record<string, unknown> | null) => void;
}

// Textarea with live JSON.parse validation. Format button pretty-prints on request.
// Shows inline error when JSON is invalid. Parent receives both raw string + parsed object.
export function JsonSchemaInput({ id, label, value, onChange }: JsonSchemaInputProps) {
  const [parseError, setParseError] = useState<string | null>(null);

  function handleChange(raw: string) {
    if (!raw.trim()) {
      setParseError(null);
      onChange(raw, null);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      setParseError(null);
      onChange(raw, parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
      onChange(raw, null);
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      handleChange(formatted);
    } catch {
      // no-op if not parseable
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <Button type="button" variant="ghost" size="sm" onClick={handleFormat} className="h-6 px-2 text-xs">
          Format
        </Button>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        rows={6}
        className="font-mono text-xs"
        placeholder={'{\n  "type": "object",\n  "properties": {},\n  "required": []\n}'}
      />
      {parseError && (
        <p className="text-xs text-destructive">{parseError}</p>
      )}
    </div>
  );
}
