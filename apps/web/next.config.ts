import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: true },
  agentRules: false,
  // Stripe Connect onboarding returns to /instructor/payouts (see docs/API.md); the studio lives at /studio.
  // Security headers on every page (the API sets its own with helmet; Caddy adds HSTS in production).
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self';" },
      ],
    }];
  },
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
