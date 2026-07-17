import CIDRMatcher from 'cidr-matcher';

// Parse comma-separated CIDR list vào CIDRMatcher — evaluate O(1) per request.
export function parseCidrList(csv: string): CIDRMatcher {
  const cidrs = csv
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (cidrs.length === 0) {
    throw new Error('CIDR list rỗng — kiểm tra env USER_ALLOW_CIDR / ADMIN_ALLOW_CIDR');
  }
  return new CIDRMatcher(cidrs);
}

// Normalize v4-mapped v6 (::ffff:1.2.3.4 → 1.2.3.4) để CIDR match hoạt động đúng.
export function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) return ip.slice('::ffff:'.length);
  return ip;
}
