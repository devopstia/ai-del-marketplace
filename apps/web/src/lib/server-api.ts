import "server-only";
import { cookies, headers } from "next/headers";
import { SERVER_API_URL } from "./config";

/** Server-side GET. Forwards the visitor's cookies so the API can tailor the response (enrolled, in cart). Never throws. */
export async function serverGet<T = unknown>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  try {
    const jar = await cookies();
    const cookie = jar.getAll().map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const res = await fetch(`${SERVER_API_URL}${path}`, {
      headers: { Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(fwd ? { "X-Forwarded-For": fwd } : {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}
