/**
 * submit.ts — `onemcp submit --type <type> --file <path> [--yes]` command.
 * Security checks per RT-4 + Sec-adversary #5:
 *   1. Size cap 256 KB (hard reject)
 *   2. Binary detection (hard reject)
 *   3. Secret-scan regex (hard reject if secrets + --yes; prompt otherwise)
 *   4. Show first 20 lines + size, require [y/N] unless --yes (and no secrets)
 * Auth: Bearer token required (write operation).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import { ApiClient, formatApiError, isApiError } from '../lib/api-client';
import { assertConfigValid, resolveConfig } from '../lib/config-store';
import { confirmScanResult, scanFile } from '../lib/secret-scan';
import { fatal, info } from '../lib/output';

// Artifact types accepted by backend (mirrors artifact-type.enum.ts)
const VALID_TYPES = ['report', 'research', 'kb', 'postmortem', 'runbook'] as const;
type ArtifactType = (typeof VALID_TYPES)[number];

interface SubmitPayload {
  type: ArtifactType;
  title: string;
  slug: string;
  body: string;
  tags: string[];
}

interface SubmitResponse {
  id: number;
  slug: string;
  status: string;
}

export function registerSubmit(program: Command): void {
  program
    .command('submit')
    .description('Submit a markdown file as an artifact')
    .requiredOption('-t, --type <type>', `Artifact type (${VALID_TYPES.join(', ')})`)
    .requiredOption('-f, --file <path>', 'Path to markdown file to submit')
    .option('--title <title>', 'Artifact title (defaults to filename without extension)')
    .option('--slug <slug>', 'URL-safe slug (auto-derived from title if omitted)')
    .option('--tags <tags>', 'Comma-separated tags (e.g. postgres,disk,prod)')
    .option('--yes', 'Skip confirmation prompt (still hard-rejects if secrets detected)')
    .option('--insecure', 'Disable TLS certificate verification (unsafe)')
    .action(async (opts: {
      type: string;
      file: string;
      title?: string;
      slug?: string;
      tags?: string;
      yes?: boolean;
      insecure?: boolean;
    }) => {
      const cfg = resolveConfig();
      if (opts.insecure) cfg.tlsVerify = false;

      try {
        assertConfigValid(cfg);
      } catch (err) {
        fatal((err as Error).message);
      }

      // Validate artifact type
      if (!VALID_TYPES.includes(opts.type as ArtifactType)) {
        fatal(`Invalid type "${opts.type}". Valid types: ${VALID_TYPES.join(', ')}`);
      }

      const filePath = path.resolve(opts.file);

      // ── Step 1: Scan file (size, binary, secrets) ─────────────────────────
      let scanResult;
      try {
        scanResult = scanFile(filePath);
      } catch (err) {
        fatal(`Cannot read file "${filePath}": ${(err as Error).message}`);
      }

      // confirmScanResult prints preview + prompts; returns false → abort
      const confirmed = await confirmScanResult(scanResult, opts.yes ?? false);
      if (!confirmed) {
        info('Submit cancelled.');
        process.exit(1);
      }

      // ── Step 2: Read full file content ────────────────────────────────────
      // scanFile already validated UTF-8 + size; safe to read directly.
      let fullBody: string;
      try {
        fullBody = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        fatal(`Failed to read file: ${(err as Error).message}`);
      }

      // ── Step 3: Derive title / slug ───────────────────────────────────────
      const basename = path.basename(filePath, path.extname(filePath));
      const title = opts.title ?? basename;
      const slug = opts.slug ?? deriveSlug(title);

      if (!isValidSlug(slug)) {
        fatal(
          `Invalid slug "${slug}". Must be lowercase alphanumeric + dashes (min 3, max 160 chars).`,
        );
      }

      // ── Step 4: Parse tags ────────────────────────────────────────────────
      const tags = opts.tags
        ? opts.tags
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0 && t.length <= 32)
        : [];

      // ── Step 5: POST to API ───────────────────────────────────────────────
      const payload: SubmitPayload = {
        type: opts.type as ArtifactType,
        title,
        slug,
        body: fullBody,
        tags,
      };

      const client = new ApiClient(cfg);
      info(`Submitting "${title}" (type=${opts.type}, slug=${slug})...`);

      let result: SubmitResponse;
      try {
        result = await client.post<SubmitResponse>('/api/artifacts', payload);
      } catch (err) {
        if (isApiError(err)) fatal(formatApiError(err));
        fatal((err as Error).message);
      }

      console.log(`\nArtifact created: #${result.id} · ${result.slug} [${result.status}]`);
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Derive URL-safe slug from title string. */
function deriveSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '')      // trim leading/trailing dashes
    .slice(0, 160);
}

/** Validate slug matches backend regex: /^[a-z0-9][a-z0-9-]*$/ (min 3, max 160) */
function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(slug) && slug.length >= 3 && slug.length <= 160;
}
