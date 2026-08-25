import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The five-destination IA (docs/06-REDESIGN-PLAN.md, chunk 15) renamed
      // /plan to /program and moved /settings under /profile. Permanent so
      // browsers and any bookmarked/PWA-cached URL update once and stay put.
      { source: '/plan', destination: '/program', permanent: true },
      { source: '/settings', destination: '/profile/settings', permanent: true },
    ];
  },
};

export default nextConfig;
