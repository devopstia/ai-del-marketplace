import { SERVER_API_URL } from "@/lib/config";

// Same-origin proxy for public course images (thumbnails, avatars) served by the API.
// Keeps <img> loads working regardless of the API's Cross-Origin-Resource-Policy.
//
// ?w=<width> returns a smaller WebP copy for phones and grids (speed, docs/SEO.md): a course cover is a 1280×720 PNG
// (~200 KB) but a phone shows it ~380 px wide. Only the widths in WIDTHS are made, and recent results are kept in
// memory. Without sharp, or if resizing fails, the original image is returned unchanged.
const WIDTHS = new Set([320, 480, 640, 960]);
const cache = new Map<string, { body: Uint8Array; type: string }>();
const CACHE_MAX = 300;

type Sharp = (input: Uint8Array) => { resize: (o: { width: number; withoutEnlargement: boolean }) => { webp: (o: { quality: number }) => { toBuffer: () => Promise<Buffer> } } };
let sharpLoad: Promise<Sharp | null> | null = null;
const loadSharp = () => (sharpLoad ??= import("sharp").then((m) => (m.default ?? m) as unknown as Sharp).catch(() => null));

const headers = (type: string) => ({ "Content-Type": type, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" });

export async function GET(req: Request, { params }: { params: Promise<{ owner: string; file: string }> }) {
  const { owner, file } = await params;
  if (!/^[\w-]{1,64}$/.test(owner) || !/^[\w-]{1,64}\.(jpg|png|webp)$/.test(file)) return new Response("Not found", { status: 404 });
  const w = Number(new URL(req.url).searchParams.get("w"));
  const width = WIDTHS.has(w) ? w : 0;
  const key = `${owner}/${file}@${width}`;
  const hit = width ? cache.get(key) : undefined;
  if (hit) return new Response(hit.body as BodyInit, { headers: headers(hit.type) });

  const r = await fetch(`${SERVER_API_URL}/media/images/${owner}/${file}`, { cache: "no-store" }).catch(() => null);
  if (!r || !r.ok || !r.body) return new Response("Not found", { status: 404 });
  const type = r.headers.get("content-type") ?? "application/octet-stream";
  if (!width) return new Response(r.body, { headers: headers(type) });

  const original = new Uint8Array(await r.arrayBuffer());
  const sharp = await loadSharp();
  if (!sharp) return new Response(original as BodyInit, { headers: headers(type) });
  try {
    const body = new Uint8Array(await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer());
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, { body, type: "image/webp" });
    return new Response(body as BodyInit, { headers: headers("image/webp") });
  } catch {
    return new Response(original as BodyInit, { headers: headers(type) });
  }
}
