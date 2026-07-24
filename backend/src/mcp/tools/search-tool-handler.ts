// Handler for MCP `search` tool.
// Routes between legacy FTS path (backward-compat) and Phase 2C hybrid path
// based on presence of mode/space/template_key/tags params.

import { AuthedRequest } from '../../common/user-request';
import { SearchEntityKind, SearchService } from '../../search/search.service';
import { SpacesService } from '../../spaces/spaces.service';
import { McpToolResult } from '../mcp-jsonrpc.types';

export async function handleSearchTool(
  args: Record<string, unknown>,
  req: AuthedRequest,
  searchSvc: SearchService,
  spacesService: SpacesService,
): Promise<McpToolResult> {
  const q = String(args.q ?? '').trim();
  if (!q) return errorResult('q is required');

  const modeRaw = typeof args.mode === 'string' ? args.mode.trim() : undefined;
  const spaceSlug = typeof args.space === 'string' ? args.space.trim() : undefined;
  const templateKey = typeof args.template_key === 'string' ? args.template_key.trim() : undefined;
  const tagsArg = Array.isArray(args.tags)
    ? (args.tags as unknown[]).filter((t) => typeof t === 'string').map((t) => String(t))
    : undefined;

  // Phase 2C: if any hybrid params present, route through hybrid().
  // Backward compat: old callers passing only q/kind/limit/service get the original FTS path.
  const hasHybridParams = modeRaw || spaceSlug || templateKey || (tagsArg && tagsArg.length > 0);

  if (hasHybridParams) {
    const validModes = new Set(['hybrid', 'fts', 'semantic']);
    const mode = modeRaw && validModes.has(modeRaw) ? (modeRaw as 'hybrid' | 'fts' | 'semantic') : 'hybrid';
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 100) : undefined;

    // Resolve space slug → id via SpacesService
    let spaceId: string | undefined;
    if (spaceSlug) {
      try {
        const space = await spacesService.findBySlug(spaceSlug);
        spaceId = space.id;
      } catch {
        return errorResult(`space "${spaceSlug}" not found`);
      }
    }

    const hits = await searchSvc.hybrid(req.user!, { query: q, mode, spaceId, templateKey, tags: tagsArg, limit });
    if (hits.length === 0) return { content: [{ type: 'text', text: `No results for "${q}"` }] };
    const lines = hits.map((h, i) =>
      `${i + 1}. #${h.artifactId} — ${h.title}\n   snippet: ${h.snippet.slice(0, 200)}\n   tags: ${h.tags.join(', ') || '-'} · source=${h.source} · rrf=${h.rrfScore.toFixed(4)}`,
    );
    return { content: [{ type: 'text', text: `Found ${hits.length} result(s) for "${q}" [${mode}]:\n\n${lines.join('\n\n')}` }] };
  }

  // Legacy FTS path — unchanged for old callers (kind, service, limit params).
  const kind = (args.kind as SearchEntityKind | 'all' | undefined) ?? 'all';
  const limit = typeof args.limit === 'number' ? args.limit : undefined;
  const service = typeof args.service === 'string' && args.service.trim() ? args.service.trim() : null;
  const hits = await searchSvc.search(req.user!, { q, kind, limit, service });
  if (hits.length === 0) return { content: [{ type: 'text', text: `No results for "${q}"` }] };
  const lines = hits.map((h, i) => {
    const idPart = h.kind === 'skill' ? h.name : `#${h.id}`;
    return `${i + 1}. [${h.kind}] ${idPart} — ${h.name}\n   snippet: ${h.snippet.slice(0, 200)}\n   tags: ${h.tags.join(', ') || '-'} · rank=${h.rank.toFixed(3)}`;
  });
  return { content: [{ type: 'text', text: `Found ${hits.length} result(s) for "${q}":\n\n${lines.join('\n\n')}` }] };
}

function errorResult(msg: string): McpToolResult {
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
}
