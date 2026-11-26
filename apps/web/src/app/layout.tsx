import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { themeScript } from "@/components/ThemeToggle";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { QuickSearchProvider } from "@/components/search/QuickSearch";

const display = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", weight: ["500", "600", "700", "800"], display: "swap" });
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson", weight: ["400", "500", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "DevOps Easy Learning: AI and DevOps courses", template: "%s · DevOps Easy Learning" },
  description: "Practical AI and DevOps courses taught by working engineers. Hands-on labs and real cloud demos.",
  metadataBase: new URL(process.env.WEB_URL || "http://127.0.0.1:3000"),
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
      <body className="min-h-dvh">
        <AuthProvider>
          <ToastProvider><QuickSearchProvider>{children}</QuickSearchProvider></ToastProvider>
          <PwaRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
