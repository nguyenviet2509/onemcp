'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToolUpstream, ToolBridge, listUpstreams, listBridges } from '@/lib/api/tool-bridges-api';
import { ApiError } from '@/lib/api-client';
import { UpstreamsTable } from './upstreams/upstreams-table';
import { BridgesTable } from './bridges/bridges-table';

type Tab = 'upstreams' | 'bridges';

const TABS: { key: Tab; label: string }[] = [
  { key: 'upstreams', label: 'Upstreams' },
  { key: 'bridges', label: 'Bridges' },
];

export function ToolBridgesTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get('tab');
  const activeTab: Tab = rawTab === 'bridges' ? 'bridges' : 'upstreams';

  const [upstreams, setUpstreams] = useState<ToolUpstream[]>([]);
  const [bridges, setBridges] = useState<ToolBridge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listUpstreams(), listBridges()])
      .then(([us, bs]) => { setUpstreams(us); setBridges(bs); })
      .catch((e) => setError(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e)))
      .finally(() => setLoading(false));
  }, []);

  function switchTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`?${params.toString()}`);
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => switchTab(key)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === key
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {activeTab === 'upstreams' && (
        <UpstreamsTable upstreams={upstreams} loading={loading} onListChange={setUpstreams} />
      )}
      {activeTab === 'bridges' && (
        <BridgesTable bridges={bridges} upstreams={upstreams} loading={loading} onListChange={setBridges} />
      )}
    </div>
  );
}
