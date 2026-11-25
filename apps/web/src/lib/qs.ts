export function qs(query?: Record<string, string | string[] | number | boolean | undefined | null>): string {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) v.filter(Boolean).forEach((x) => p.append(k, x));
    else if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
