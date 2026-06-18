import type { NextConfig } from "next";

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
        hostname: "room.ytcb.org",
      },
    ],
  },

  // Prevent double rendering in dev mode
  reactStrictMode: true,
};

export default nextConfig;
