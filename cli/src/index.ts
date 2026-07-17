#!/usr/bin/env node
/**
 * index.ts — OneMCP CLI entry point.
 * Commands: search, show, submit (V5 scope — 3 commands only per plan validation).
 * Uses commander@11 for argument parsing.
 */

import { Command } from 'commander';
import { registerSearch } from './commands/search';
import { registerShow } from './commands/show';
import { registerSubmit } from './commands/submit';

const program = new Command();

program
  .name('onemcp')
  .description('OneMCP CLI — search, show, and submit artifacts from your terminal')
  .version('0.1.0', '-v, --version', 'Print version number')
  .option('--insecure', 'Disable TLS certificate verification globally (unsafe)')
  .addHelpText(
    'after',
    `
Examples:
  onemcp search "disk full"
  onemcp search "postgres oom" --service postgres --limit 5
  onemcp show 42
  onemcp show postgres-disk-full-runbook
  onemcp submit --type runbook --file ./runbook.md
  onemcp submit --type postmortem --file ./postmortem.md --yes

Config:
  ~/.onemcp/config.json  (chmod 600)
  { "baseUrl": "https://onemcp.local", "user": "alice", "token": "...", "tlsVerify": true }

Env overrides:
  ONEMCP_BASE_URL    — API base URL
  ONEMCP_USER        — Username sent as X-Onemcp-User header
  ONEMCP_TOKEN       — Bearer token for write operations
  ONEMCP_INSECURE=1  — Disable TLS verification (prints warning)
`,
  );

// Register the 3 commands (search, show, submit) — V5 scope only
registerSearch(program);
registerShow(program);
registerSubmit(program);

// Parse argv — commander handles --help and unknown commands
program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`[ERROR] ${(err as Error).message ?? String(err)}\n`);
  process.exit(1);
});
