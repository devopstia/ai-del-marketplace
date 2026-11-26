import type { Metadata } from "next";
import { InstallGuide } from "@/components/pwa/InstallGuide";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Install the app",
  description: "Install DevOps Easy Learning on your phone, tablet or computer: its own icon, full screen, no app store.",
  path: "/install",
});

export default function InstallPage() {
  return <InstallGuide />;
}
