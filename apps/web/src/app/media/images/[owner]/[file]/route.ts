import { SERVER_API_URL } from "@/lib/config";

// Same-origin proxy for public course images (thumbnails, avatars) served by the API.
// Keeps <img> loads working regardless of the API's Cross-Origin-Resource-Policy.
export async function GET(_req: Request, { params }: { params: Promise<{ owner: string; file: string }> }) {
  const { owner, file } = await params;
  if (!/^[\w-]{1,64}$/.test(owner) || !/^[\w-]{1,64}\.(jpg|png|webp)$/.test(file)) return new Response("Not found", { status: 404 });
  const r = await fetch(`${SERVER_API_URL}/media/images/${owner}/${file}`, { cache: "no-store" }).catch(() => null);
  if (!r || !r.ok || !r.body) return new Response("Not found", { status: 404 });
  return new Response(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
