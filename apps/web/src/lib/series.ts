/** Bucket rows into the last `days` UTC days (oldest first). */
export function dailySeries(rows: { at: string; cents: number }[], days = 30) {
  const out: { key: string; label: string; value: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({ key, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }), value: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.key, i]));
  for (const r of rows) {
    const i = idx.get((r.at || "").slice(0, 10));
    if (i !== undefined) out[i]!.value += r.cents;
  }
  return out;
}
export function daysAgoIso(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}
