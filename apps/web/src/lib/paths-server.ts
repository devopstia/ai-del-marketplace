import "server-only";
import { serverGet } from "./server-api";
import { list } from "./normalize";
import { toPathDetail, toPathSummary, type PathDetail, type PathSummary } from "./paths";

/** Published career paths (empty when none or when the API is unreachable: every entry point then stays hidden). */
export async function getPaths(): Promise<PathSummary[]> {
  const r = await serverGet("/paths");
  return r.ok ? list(r.data, "items").map(toPathSummary) : [];
}

export async function getPath(slug: string): Promise<PathDetail | null> {
  const r = await serverGet(`/paths/${encodeURIComponent(slug)}`);
  return r.ok ? toPathDetail(r.data) : null;
}
