import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output cuts image size to ~100MB (H6 mitigation).
  // Windows local: pnpm symlink EPERM may fail — safe to ignore (Docker Linux build unaffected).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server Actions enabled by default in Next 15
  },
};

export default withNextIntl(nextConfig);
