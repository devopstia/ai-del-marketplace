import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: true },
  agentRules: false,
  // Stripe Connect onboarding returns to /instructor/payouts (see docs/API.md); the studio lives at /studio.
  async redirects() {
    return [
      { source: "/instructor/payouts", destination: "/studio/payouts", permanent: false },
      // The student pages moved into the Student Studio (owner 2026-11-25); old links keep working.
      { source: "/my-learning", destination: "/student/courses", permanent: false },
      { source: "/orders", destination: "/student/purchases", permanent: false },
      { source: "/orders/:id", destination: "/student/purchases/:id", permanent: false },
      { source: "/account", destination: "/student/account", permanent: false },
    ];
  },
};

export default nextConfig;
