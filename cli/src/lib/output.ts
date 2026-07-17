/**
 * output.ts — Simple table/text output helpers. No color libraries.
 * Plain terminal output suitable for SSH sessions and pipe/redirect.
 */

/** Print a markdown-body artifact to stdout (for `show` command). */
export function printMarkdown(body: string): void {
  process.stdout.write(body);
  // Ensure trailing newline
  if (!body.endsWith('\n')) process.stdout.write('\n');
}

/** Print a simple aligned table to stdout.
 *  headers: column names
 *  rows: array of string arrays, same length as headers */
export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }

  // Compute column widths (max of header and each row cell)
  const widths: number[] = headers.map((h) => h.length);
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = stripAnsi(cell).length;
      if (len > (widths[i] ?? 0)) widths[i] = len;
    });
  }

  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');
  const headerLine = headers.map((h, i) => h.padEnd(widths[i] ?? 0)).join(' | ');

  console.log(headerLine);
  console.log(separator);
  for (const row of rows) {
    const line = row.map((cell, i) => {
      // Pad based on visual length (strip ANSI if any slipped through)
      const visual = stripAnsi(cell);
      const pad = (widths[i] ?? 0) - visual.length;
      return cell + ' '.repeat(Math.max(0, pad));
    }).join(' | ');
    console.log(line);
  }
}

/** Print a key-value detail block (for single artifact display header). */
export function printDetail(fields: Array<[string, string | undefined | null]>): void {
  const labelWidth = Math.max(...fields.map(([k]) => k.length));
  for (const [key, val] of fields) {
    if (val == null || val === '') continue;
    console.log(`${key.padEnd(labelWidth)} : ${val}`);
  }
}

/** Print an error message to stderr and exit with code 1. */
export function fatal(message: string, code = 1): never {
  process.stderr.write(`[ERROR] ${message}\n`);
  process.exit(code);
}

/** Print a warning to stderr (non-fatal). */
export function warn(message: string): void {
  process.stderr.write(`[WARN] ${message}\n`);
}

/** Print informational message to stderr (keeps stdout clean for piping). */
export function info(message: string): void {
  process.stderr.write(`${message}\n`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Strip ANSI escape codes from string for width calculation. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
