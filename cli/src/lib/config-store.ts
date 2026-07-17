/**
 * config-store.ts — Read/write ~/.onemcp/config.json with 0600 permissions.
 * Enforces strict file permissions on Linux/macOS; skips chmod on Windows.
 * Config schema: { baseUrl, user, token, defaultService, tlsVerify }
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface OnemcpConfig {
  baseUrl: string;
  user: string;
  token?: string;
  defaultService?: string;
  tlsVerify: boolean;
}

const CONFIG_DIR = path.join(os.homedir(), '.onemcp');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// Permissions mask: owner read/write only (octal 0600)
const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

/** Read config from ~/.onemcp/config.json.
 *  Returns null if file does not exist.
 *  Throws if permissions are too open (non-Windows only). */
export function readConfig(): OnemcpConfig | null {
  if (!fs.existsSync(CONFIG_FILE)) return null;

  // Security: refuse to read if permissions are too open on Linux/macOS
  if (process.platform !== 'win32') {
    checkFilePermissions(CONFIG_FILE);
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<OnemcpConfig>;

    // Normalize: ensure tlsVerify defaults to true when missing
    return {
      baseUrl: parsed.baseUrl ?? '',
      user: parsed.user ?? '',
      token: parsed.token,
      defaultService: parsed.defaultService,
      tlsVerify: parsed.tlsVerify !== false, // default TRUE per RT-4
    };
  } catch (err) {
    throw new Error(`Failed to parse config at ${CONFIG_FILE}: ${(err as Error).message}`);
  }
}

/** Write config to ~/.onemcp/config.json with chmod 0600. */
export function writeConfig(config: OnemcpConfig): void {
  // Ensure directory exists with 0700
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: DIR_MODE });
  }

  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_FILE, json, { encoding: 'utf-8', mode: FILE_MODE });

  // Apply chmod explicitly after write (some systems ignore mode in writeFileSync)
  if (process.platform !== 'win32') {
    fs.chmodSync(CONFIG_FILE, FILE_MODE);
  }
}

/** Resolve config from env vars + config file.
 *  Priority: ENV > config file > defaults. */
export function resolveConfig(): OnemcpConfig {
  const fromFile = readConfig();

  const tlsVerify = resolveBoolean(
    process.env.ONEMCP_INSECURE,
    fromFile?.tlsVerify,
  );

  return {
    baseUrl: process.env.ONEMCP_BASE_URL ?? fromFile?.baseUrl ?? '',
    user: process.env.ONEMCP_USER ?? fromFile?.user ?? '',
    token: process.env.ONEMCP_TOKEN ?? fromFile?.token,
    defaultService: fromFile?.defaultService,
    // ONEMCP_INSECURE=1 means tlsVerify = false
    tlsVerify,
  };
}

/** Validate config has minimum required fields. Throws descriptive error if not. */
export function assertConfigValid(cfg: OnemcpConfig): void {
  if (!cfg.baseUrl) {
    throw new Error(
      'Missing baseUrl. Set ONEMCP_BASE_URL env or run: echo \'{"baseUrl":"https://onemcp.local","user":"alice","tlsVerify":true}\' > ~/.onemcp/config.json',
    );
  }
  if (!cfg.user) {
    throw new Error(
      'Missing user. Set ONEMCP_USER env or add "user" field to ~/.onemcp/config.json',
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Check file permissions — refuse if world/group readable (too open). */
function checkFilePermissions(filePath: string): void {
  try {
    const stat = fs.statSync(filePath);
    // stat.mode & 0o777 → check if group/world bits are set
    const mode = stat.mode & 0o077; // group + other bits
    if (mode !== 0) {
      const octal = (stat.mode & 0o777).toString(8);
      throw new Error(
        `Config file ${filePath} has permissions ${octal} (too open). ` +
          `Run: chmod 600 ${filePath}`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
}

/** Resolve tlsVerify from ONEMCP_INSECURE env + config file value.
 *  ONEMCP_INSECURE=1 → tlsVerify false (with warning printed later by caller). */
function resolveBoolean(
  insecureEnv: string | undefined,
  configValue: boolean | undefined,
): boolean {
  if (insecureEnv === '1' || insecureEnv?.toLowerCase() === 'true') {
    return false; // insecure mode: disable TLS verify
  }
  return configValue !== false; // default true
}
