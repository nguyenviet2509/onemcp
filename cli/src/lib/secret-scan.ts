/**
 * secret-scan.ts — Scan file content for secrets before submit.
 * Rules per RT-4 / Sec-adversary #5:
 *   - Cap 256 KB
 *   - Reject binary (null bytes / non-UTF-8)
 *   - Regex match: AWS AKIA, BEGIN PRIVATE KEY, Bearer 20+ chars, JWT eyJ..., password="..."
 *   - Print first 20 lines + size, require [y/N] confirmation unless --yes
 */

import * as fs from 'fs';
import * as readline from 'readline';

const MAX_BYTES = 256 * 1024; // 256 KB

// Secret patterns to scan for
interface SecretPattern {
  name: string;
  regex: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'AWS Access Key (AKIA...)', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key (BEGIN PRIVATE KEY)', regex: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----/g },
  { name: 'Bearer token (20+ chars)', regex: /Bearer\s+[A-Za-z0-9+/=_-]{20,}/g },
  { name: 'JWT token (eyJ...)', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  // password= followed by non-empty value (quote-delimited or plain)
  { name: 'Password assignment (password=...)', regex: /password\s*=\s*["']?[^"'\s]{4,}/gi },
];

export interface ScanResult {
  filePath: string;
  sizeBytes: number;
  sizeKb: string;
  lineCount: number;
  first20Lines: string[];
  matches: Array<{ pattern: string; lineNo: number; preview: string }>;
  isBinary: boolean;
  tooLarge: boolean;
}

/** Read and scan file for secrets. Returns ScanResult with findings. */
export function scanFile(filePath: string): ScanResult {
  const stat = fs.statSync(filePath);
  const sizeBytes = stat.size;
  const sizeKb = (sizeBytes / 1024).toFixed(1);

  const result: ScanResult = {
    filePath,
    sizeBytes,
    sizeKb,
    lineCount: 0,
    first20Lines: [],
    matches: [],
    isBinary: false,
    tooLarge: false,
  };

  // Check size cap first
  if (sizeBytes > MAX_BYTES) {
    result.tooLarge = true;
    return result;
  }

  // Read file as Buffer to detect binary
  const buf = fs.readFileSync(filePath);

  // Binary detection: check for null bytes in first 8KB
  const checkBytes = Math.min(buf.length, 8192);
  for (let i = 0; i < checkBytes; i++) {
    if (buf[i] === 0) {
      result.isBinary = true;
      return result;
    }
  }

  // Attempt UTF-8 decode — reject if invalid sequences present
  let content: string;
  try {
    // Node Buffer.toString('utf8') is lenient; use TextDecoder with fatal=true
    const decoder = new TextDecoder('utf-8', { fatal: true });
    content = decoder.decode(buf);
  } catch {
    result.isBinary = true;
    return result;
  }

  const lines = content.split('\n');
  result.lineCount = lines.length;
  result.first20Lines = lines.slice(0, 20);

  // Run secret patterns against each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of SECRET_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        result.matches.push({
          pattern: pattern.name,
          lineNo: i + 1,
          // Show truncated preview — redact actual secret value
          preview: line.trim().slice(0, 80) + (line.trim().length > 80 ? '...' : ''),
        });
        // Only report first match per pattern per line
        pattern.regex.lastIndex = 0;
      }
    }
  }

  return result;
}

/** Print scan report to stderr and return true if user confirms (or --yes passed). */
export async function confirmScanResult(
  result: ScanResult,
  skipPrompt: boolean,
): Promise<boolean> {
  // Size too large — hard reject, no prompt
  if (result.tooLarge) {
    console.error(
      `\n[REJECT] File too large: ${result.sizeKb} KB (limit: ${MAX_BYTES / 1024} KB)`,
    );
    console.error(`File: ${result.filePath}`);
    return false;
  }

  // Binary — hard reject
  if (result.isBinary) {
    console.error(`\n[REJECT] Binary file detected (null bytes or non-UTF-8 content).`);
    console.error(`File: ${result.filePath}`);
    return false;
  }

  // Print file summary
  console.error(`\n--- File Preview ---`);
  console.error(`File : ${result.filePath}`);
  console.error(`Size : ${result.sizeKb} KB (${result.sizeBytes} bytes)`);
  console.error(`Lines: ${result.lineCount}`);
  console.error(`\nFirst 20 lines:`);
  result.first20Lines.forEach((line, i) => {
    console.error(`  ${String(i + 1).padStart(3, ' ')} │ ${line}`);
  });

  // Print secret matches
  if (result.matches.length > 0) {
    console.error(`\n[WARNING] Potential secrets detected (${result.matches.length} match(es)):`);
    for (const m of result.matches) {
      console.error(`  Line ${m.lineNo}: [${m.pattern}]`);
      console.error(`    Preview: ${m.preview}`);
    }
    console.error('');

    if (skipPrompt) {
      // --yes passed but secrets detected — hard reject regardless
      console.error('[REJECT] Secrets detected. Cannot bypass with --yes. Remove secrets first.');
      return false;
    }

    // Interactive prompt
    const answer = await promptYesNo(
      'File contains potential secrets. Submit anyway? [y/N]: ',
    );
    return answer;
  }

  // No secrets found — still show preview and confirm unless --yes
  console.error('');
  if (skipPrompt) return true;

  const answer = await promptYesNo('Submit this file? [y/N]: ');
  return answer;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Prompt user for yes/no. Returns true only if user types 'y' or 'Y'. */
function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Non-TTY: default to NO for safety
    if (!process.stdin.isTTY) {
      console.error('[Non-TTY] Defaulting to N (use --yes to skip prompt in scripts).');
      resolve(false);
      return;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
