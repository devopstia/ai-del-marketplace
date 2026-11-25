import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";
import { themeScript } from "@/components/ThemeToggle";

const display = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", weight: ["500", "600", "700", "800"], display: "swap" });
const body = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson", weight: ["400", "500", "700"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "DevOps Easy Learning: AI and DevOps courses", template: "%s · DevOps Easy Learning" },
  description: "Practical AI and DevOps courses taught by working engineers. Hands-on labs, real cloud demos, lifetime access.",
  metadataBase: new URL(process.env.WEB_URL || "http://127.0.0.1:3000"),
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0c0f22",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
