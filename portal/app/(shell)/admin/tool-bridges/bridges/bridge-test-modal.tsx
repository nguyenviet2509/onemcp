'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ToolBridge, DryRunResult, testBridge } from '@/lib/api/tool-bridges-api';
import { ApiError } from '@/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bridge: ToolBridge | null;
}

const DISPLAY_LIMIT = 10_000;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function BridgeTestModal({ open, onOpenChange, bridge }: Props) {
  const [argsRaw, setArgsRaw] = useState('{}');
  const [argsError, setArgsError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  function handleArgsChange(raw: string) {
    setArgsRaw(raw);
    try {
      JSON.parse(raw);
      setArgsError(null);
    } catch (e) {
      setArgsError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }

  async function handleSend() {
    if (!bridge) return;
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(argsRaw) as Record<string, unknown>;
    } catch (e) {
      setArgsError(e instanceof Error ? e.message : 'Invalid JSON');
      return;
    }
    setBusy(true);
    setResult(null);
    setCallError(null);
    try {
      const res = await testBridge(bridge.id, args);
      setResult(res);
    } catch (e) {
      setCallError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
    setResult(null);
    setCallError(null);
    setArgsRaw('{}');
    setArgsError(null);
  }

  const headersText = result
    ? JSON.stringify(result.would_send_headers, null, 2)
    : '';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Test bridge: {bridge?.name ?? ''}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="test-args">Args (JSON object)</Label>
            <Textarea
              id="test-args"
              value={argsRaw}
              onChange={(e) => handleArgsChange(e.target.value)}
              rows={5}
              className="font-mono text-xs"
              placeholder="{}"
            />
            {argsError && <p className="text-xs text-destructive">{argsError}</p>}
          </div>

          {callError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{callError}</p>
          )}

          {result && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Schema valid:</span>
                <Badge variant={result.schema_valid ? 'secondary' : 'destructive'}>
                  {result.schema_valid ? 'yes' : 'no'}
                </Badge>
              </div>

              {result.errors && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-destructive">Errors</span>
                  <ul className="list-disc pl-4 text-xs text-destructive space-y-0.5">
                    {result.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Resolved URL</span>
                <pre className="rounded bg-muted px-3 py-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {escapeHtml(result.resolved_url).slice(0, DISPLAY_LIMIT)}
                </pre>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Would send headers</span>
                <pre className="max-h-40 overflow-y-auto rounded bg-muted px-3 py-2 text-xs whitespace-pre-wrap">
                  {escapeHtml(headersText).slice(0, DISPLAY_LIMIT)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Close</Button>
          <Button onClick={handleSend} disabled={busy || !!argsError}>
            {busy ? 'Testing…' : 'Send dry-run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
