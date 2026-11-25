import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: true },
  agentRules: false,
  // Stripe Connect onboarding returns to /instructor/payouts (see docs/API.md); the studio lives at /studio.
  async redirects() {
    return [{ source: "/instructor/payouts", destination: "/studio/payouts", permanent: false }];
  },
};

export default nextConfig;
