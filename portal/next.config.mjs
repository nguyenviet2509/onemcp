/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output cuts image size to ~100MB (H6 mitigation).
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Server Actions enabled by default in Next 15
  },
};

export default nextConfig;
