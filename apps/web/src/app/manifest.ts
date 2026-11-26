import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION } from "@/lib/seo";

/** The installable app (PWA). Served as /manifest.webmanifest. Dark is the brand default, so the splash and bars are dark. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?app=del",
    name: "DevOps Easy Learning",
    short_name: "DEL",
    description: SITE_DESCRIPTION,
    start_url: "/student?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f4f5fa",
    theme_color: "#f4f5fa",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon (Android, desktop Chrome/Edge).
    shortcuts: [
      { name: "My courses", short_name: "Courses", url: "/student/courses?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Browse courses", short_name: "Courses", url: "/courses?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Deals", short_name: "Deals", url: "/deals?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
