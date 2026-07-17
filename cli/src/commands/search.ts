/**
 * search.ts — `onemcp search <query>` command.
 * Calls GET /search?q=...&limit=...&service=... and renders tabular results.
 */

import { Command } from 'commander';
import { ApiClient, formatApiError, isApiError } from '../lib/api-client';
import { assertConfigValid, resolveConfig } from '../lib/config-store';
import { fatal, printTable, warn } from '../lib/output';

interface SearchHit {
  id: number;
  type: string;
  title: string;
  slug?: string;
  rank?: number;
  service?: string;
  score?: number;
}

interface SearchResponse {
  hits?: SearchHit[];
  results?: SearchHit[];
  data?: SearchHit[];
  total?: number;
}

export function registerSearch(program: Command): void {
  program
    .command('search <query>')
    .description('Search artifacts and skills')
    .option('-l, --limit <n>', 'Max results to return', '10')
    .option('-s, --service <name>', 'Filter/boost by service tag')
    .option('--insecure', 'Disable TLS certificate verification (unsafe)')
    .action(async (query: string, opts: { limit: string; service?: string; insecure?: boolean }) => {
      const cfg = resolveConfig();

      // --insecure flag overrides config
      if (opts.insecure) cfg.tlsVerify = false;

      try {
        assertConfigValid(cfg);
      } catch (err) {
        fatal((err as Error).message);
      }

      const limit = parseInt(opts.limit, 10);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        fatal('--limit must be a number between 1 and 100');
      }

      const client = new ApiClient(cfg);

      // Build query string
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (opts.service) params.set('service', opts.service);

      let data: SearchResponse;
      try {
        data = await client.get<SearchResponse>(`/api/search?${params.toString()}`);
      } catch (err) {
        if (isApiError(err)) fatal(formatApiError(err));
        fatal((err as Error).message);
      }

      // Normalize response shape — backend may return hits/results/data
      const hits: SearchHit[] = data.hits ?? data.results ?? (data as unknown as SearchHit[]) ?? [];

      if (!Array.isArray(hits) || hits.length === 0) {
        console.log(`No results for "${query}"`);
        process.exit(0);
      }

      const rows = hits.map((h) => [
        `[${h.type ?? '?'}]`,
        `#${h.id}`,
        h.title ?? '(untitled)',
        h.slug ?? '-',
        h.service ?? '-',
      ]);

      printTable(['type', 'id', 'title', 'slug', 'service'], rows);

      if (data.total !== undefined && data.total > hits.length) {
        warn(`Showing ${hits.length} of ${data.total} results. Use --limit to see more.`);
      }
    });
}
