import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";

// The help pages are client components; their title, description and canonical address live here (docs/SEO.md).
export const metadata: Metadata = pageMeta({
  title: "Platform videos and help",
  description: "Short videos that show students and instructors how to use DevOps Easy Learning.",
  path: "/help",
});

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
