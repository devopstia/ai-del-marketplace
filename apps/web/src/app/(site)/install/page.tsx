import type { Metadata } from "next";
import { InstallGuide } from "@/components/pwa/InstallGuide";

export const metadata: Metadata = {
  title: "Install the app",
  description: "Install DevOps Easy Learning on your phone, tablet or computer: its own icon, full screen, no app store.",
};

export default function InstallPage() {
  return <InstallGuide />;
}
