import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { themeScript } from "@/components/ThemeToggle";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { SessionGuard } from "@/components/SessionGuard";
import { SITE_DESCRIPTION, SITE_URL, siteIndexable } from "@/lib/seo";
import { QuickSearchProvider } from "@/components/search/QuickSearch";
import { SupportBanner } from "@/components/assist/SupportBanner";

const display = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", weight: ["500", "600", "700", "800"], display: "swap" });
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson", weight: ["400", "500", "700"], display: "swap" });

const indexable = siteIndexable();

export const metadata: Metadata = {
  title: { default: "DevOps Easy Learning: AI and DevOps courses", template: "%s · DevOps Easy Learning" },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  // Search engines and link previews (docs/SEO.md). Only production is indexed; pages set their own canonical address.
  robots: indexable ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } } : { index: false, follow: false },
  openGraph: { type: "website", siteName: "DevOps Easy Learning", locale: "en_US", title: "DevOps Easy Learning: AI and DevOps courses", description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", site: "@devopseasylearn", title: "DevOps Easy Learning: AI and DevOps courses", description: SITE_DESCRIPTION },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  // Installed on an iPhone or iPad: the home-screen name; the status bar follows the page (light by default).
  appleWebApp: { capable: true, title: "DEL", statusBarStyle: "default" },
  applicationName: "DevOps Easy Learning",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f4f5fa",
  width: "device-width",
  initialScale: 1,
  // Content can use the whole screen in the installed app; fixed elements keep clear with env(safe-area-inset-*).
  viewportFit: "cover",
  // The on-screen keyboard shrinks the page instead of covering forms (Android).
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`light ${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh pb-[var(--assist-bar,0px)]">
        <AuthProvider>
          <ToastProvider><QuickSearchProvider>{children}</QuickSearchProvider></ToastProvider>
          <PwaRegister />
          <SessionGuard />
          <SupportBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
