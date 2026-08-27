'use client';

// OAuth 2.1 consent screen — user reviews AI client's request and Allow/Deny.
// Backend redirects browser here after login when consent record missing.
// Query params carry the authorization request; we forward them back on Allow.
// Deny → redirect to redirect_uri?error=access_denied (RFC 6749 §4.1.2.1).

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageShell } from '@/components/page-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiFetch } from '@/lib/api-client';

interface ClientInfo {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  scope?: string;
}

export default function OAuthConsentPage() {
  const search = useSearchParams();
  const clientId = search.get('client_id') ?? '';
  const redirectUri = search.get('redirect_uri') ?? '';
  const scope = search.get('scope') ?? 'mcp';
  const state = search.get('state') ?? '';
  const codeChallenge = search.get('code_challenge') ?? '';
  const codeChallengeMethod = search.get('code_challenge_method') ?? 'S256';

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) {
      setError('Missing client_id parameter');
      return;
    }
    apiFetch<ClientInfo>(`/oauth/client-info?client_id=${encodeURIComponent(clientId)}`)
      .then(setClient)
      .catch((e: Error) => setError(e.message || 'Failed to load client info'));
  }, [clientId]);

  async function onAllow() {
    setSubmitting(true);
    setError(null);
    try {
      const body = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        scope,
        state,
      });
      const res = await apiFetch<{ redirect: string }>('/oauth/authorize/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      window.location.href = res.redirect;
    } catch (e) {
      setSubmitting(false);
      setError((e as Error).message || 'Consent failed');
    }
  }

  function onDeny() {
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    url.searchParams.set('error_description', 'user_denied_consent');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  }

  const scopes = scope.split(/\s+/).filter(Boolean);

  return (
    <PageShell title="Authorize AI Client" breadcrumb={[{ label: 'OAuth Consent' }]}>
      <div className="max-w-lg mx-auto">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-1">
            {client?.client_name ?? 'Loading…'}
          </h2>
          <p className="text-xs text-muted-foreground mb-4 font-mono break-all">
            client_id: {clientId || '(missing)'}
          </p>

          <div className="mb-4">
            <p className="text-sm font-medium mb-2">This app is requesting access to:</p>
            <ul className="text-sm list-disc pl-5 space-y-1">
              {scopes.map((s) => (
                <li key={s}>
                  <span className="font-mono">{s}</span>
                  {s === 'mcp' && (
                    <span className="text-muted-foreground">
                      {' — call MCP tools + read your skills/artifacts as you'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-4">
            <p className="text-sm font-medium mb-1">Will redirect to:</p>
            <p className="text-xs font-mono break-all bg-muted p-2 rounded">
              {redirectUri || '(missing)'}
            </p>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Chỉ Allow nếu bạn đang chủ động cắm client này (Claude Desktop, Cursor, ...) vào OneMCP.
            Bạn có thể revoke bất cứ lúc nào từ trang settings.
          </p>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onDeny} disabled={submitting}>
              Deny
            </Button>
            <Button onClick={onAllow} disabled={submitting || !client || !!error}>
              {submitting ? 'Authorizing…' : 'Allow'}
            </Button>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
