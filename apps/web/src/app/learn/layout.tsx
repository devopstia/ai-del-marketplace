import type { Metadata } from "next";
export const metadata: Metadata = { title: "Learning", robots: { index: false } };
export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
