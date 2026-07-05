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
  // Standalone output for Docker
  output: 'standalone',

  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: remoteHostname,
      },
    ],
  },

  // Prevent double rendering in dev mode
  reactStrictMode: false,
};

export default nextConfig;
