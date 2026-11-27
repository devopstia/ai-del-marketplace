import "server-only";
import { SERVER_API_URL } from "./config";
import { DEFAULT_IMAGE, shareImageOf, SITE_DESCRIPTION, type ShareImage } from "./seo";

export interface SiteShare { title: string; description: string; image: ShareImage }

/**
 * The site's link-preview defaults from Super Admin › Social Media & Sharing (docs/SOCIAL_SHARING.md): title,
 * description and the versioned banner URL. Cached for a minute; on any API problem the built-in defaults are used, so a
 * page never fails because of its preview.
 */
export async function siteShare(): Promise<SiteShare> {
  const fallback: SiteShare = { title: "DevOps Easy Learning: AI and DevOps courses", description: SITE_DESCRIPTION, image: DEFAULT_IMAGE };
  try {
    const r = await fetch(`${SERVER_API_URL}/social/site`, { headers: { Accept: "application/json" }, next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return fallback;
    const d = (await r.json()) as { title?: unknown; description?: unknown; image?: unknown };
    return {
      title: typeof d.title === "string" && d.title ? d.title : fallback.title,
      description: typeof d.description === "string" && d.description ? d.description : fallback.description,
      image: shareImageOf(d.image) ?? DEFAULT_IMAGE,
    };
  } catch {
    return fallback;
  }
}
