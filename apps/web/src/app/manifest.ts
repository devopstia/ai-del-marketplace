import type { MetadataRoute } from "next";

/** The installable app (PWA). Served as /manifest.webmanifest. Dark is the brand default, so the splash and bars are dark. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?app=del",
    name: "DevOps Easy Learning",
    short_name: "DEL",
    description: "Practical AI and DevOps courses taught by working engineers. Hands-on labs, real cloud demos, lifetime access.",
    start_url: "/my-learning?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0c0f22",
    theme_color: "#0c0f22",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon (Android, desktop Chrome/Edge).
    shortcuts: [
      { name: "My learning", short_name: "Learning", url: "/my-learning?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Browse courses", short_name: "Courses", url: "/courses?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Deals", short_name: "Deals", url: "/deals?source=pwa", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
