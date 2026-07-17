/**
 * show.ts — `onemcp show <id-or-slug>` command.
 * Smart resolve: numeric → artifact by ID; string → try slug/name on artifacts then skills.
 * Outputs full markdown body to stdout (pipe-friendly).
 */

import { Command } from 'commander';
import { ApiClient, formatApiError, isApiError } from '../lib/api-client';
import { assertConfigValid, resolveConfig } from '../lib/config-store';
import { fatal, printDetail, printMarkdown } from '../lib/output';

interface ArtifactDetail {
  id: number;
  type: string;
  title: string;
  slug?: string;
  status?: string;
  service?: string;
  tags?: string[];
  body?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SkillDetail {
  name: string;
  description?: string;
  body?: string;
  version?: string;
}

export function registerShow(program: Command): void {
  program
    .command('show <id-or-slug>')
    .description('Show full content of an artifact or skill')
    .option('--insecure', 'Disable TLS certificate verification (unsafe)')
    .action(async (idOrSlug: string, opts: { insecure?: boolean }) => {
      const cfg = resolveConfig();
      if (opts.insecure) cfg.tlsVerify = false;

      try {
        assertConfigValid(cfg);
      } catch (err) {
        fatal((err as Error).message);
      }

      const client = new ApiClient(cfg);
      const isNumeric = /^\d+$/.test(idOrSlug);

      if (isNumeric) {
        await showArtifactById(client, idOrSlug);
      } else {
        await showBySlug(client, idOrSlug);
      }
    });
}

async function showArtifactById(client: ApiClient, id: string): Promise<void> {
  let artifact: ArtifactDetail;
  try {
    artifact = await client.get<ArtifactDetail>(`/api/artifacts/${id}`);
  } catch (err) {
    if (isApiError(err)) fatal(formatApiError(err));
    fatal((err as Error).message);
  }
  renderArtifact(artifact);
}

async function showBySlug(client: ApiClient, slug: string): Promise<void> {
  // Try artifact by slug first (GET /api/artifacts/:id supports slug lookup)
  try {
    const artifact = await client.get<ArtifactDetail>(`/api/artifacts/${encodeURIComponent(slug)}`);
    renderArtifact(artifact);
    return;
  } catch (err) {
    // 404 → try skills; other errors → propagate
    if (isApiError(err) && err.status === 404) {
      // fall through to skills lookup
    } else if (isApiError(err)) {
      fatal(formatApiError(err));
    } else {
      fatal((err as Error).message);
    }
  }

  // Fallback: try skill by name
  try {
    const skill = await client.get<SkillDetail>(`/api/skills/${encodeURIComponent(slug)}`);
    renderSkill(skill);
    return;
  } catch (err) {
    if (isApiError(err) && err.status === 404) {
      fatal(`Not found: "${slug}". Try 'onemcp search ${slug}' to find it.`, 1);
    }
    if (isApiError(err)) fatal(formatApiError(err));
    fatal((err as Error).message);
  }
}

function renderArtifact(a: ArtifactDetail): void {
  // Print metadata header to stderr so stdout stays clean for piping
  printDetail([
    ['ID', String(a.id)],
    ['Type', a.type],
    ['Title', a.title],
    ['Slug', a.slug ?? undefined],
    ['Status', a.status ?? undefined],
    ['Service', a.service ?? undefined],
    ['Tags', a.tags?.join(', ') ?? undefined],
    ['Updated', a.updatedAt ?? undefined],
  ]);

  process.stderr.write('\n');

  if (a.body) {
    printMarkdown(a.body);
  } else {
    process.stderr.write('(no body content)\n');
  }
}

function renderSkill(s: SkillDetail): void {
  printDetail([
    ['Name', s.name],
    ['Version', s.version ?? undefined],
    ['Description', s.description ?? undefined],
  ]);

  process.stderr.write('\n');

  if (s.body) {
    printMarkdown(s.body);
  } else {
    process.stderr.write('(no body content)\n');
  }
}
