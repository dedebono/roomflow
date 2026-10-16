import type { NextConfig } from "next";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

// Extract hostname from BASE_URL for remote image patterns
let remoteHostname = 'localhost';
try {
  if (baseUrl) {
    remoteHostname = new URL(baseUrl).hostname;
  }
} catch {
  // fallback
}

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
  return [
    {
     source: '/api/:path*',
     destination: 'http://100.127.221.23:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
