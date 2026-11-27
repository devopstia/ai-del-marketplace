import { SERVER_API_URL } from "@/lib/config";

// The site's sharing banner at a fixed address (docs/SOCIAL_SHARING.md): pages without their own preview image point
// here. The bytes are the current banner from Super Admin › Social Media & Sharing (always a JPEG), so a change needs no
// redeploy. Link-preview apps cache by URL: after a change, use the platforms' "scrape again" tools.
export const dynamic = "force-dynamic";

export async function GET() {
  const r = await fetch(`${SERVER_API_URL}/social/site-image`, { cache: "no-store", signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r || !r.ok || !r.body) return new Response("Not found", { status: 404 });
  return new Response(r.body, {
    headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "public, max-age=600", "X-Content-Type-Options": "nosniff" },
  });
}
