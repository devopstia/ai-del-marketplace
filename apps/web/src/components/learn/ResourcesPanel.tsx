"use client";
import { useEffect, useState } from "react";
import { Download, FileArchive, FileCode2, FileText, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { list, obj } from "@/lib/normalize";
import { bytes } from "@/lib/format";
import type { ResourceItem } from "@/lib/types";
import { useToast } from "../Toast";

/** Files of one lesson, or (with `items` given) the complete course package. Downloads use short-lived signed links. */
export function ResourcesPanel({ lectureId, items: given, kind = "lesson", compact = false }: { lectureId?: string; items?: ResourceItem[]; kind?: "lesson" | "package"; compact?: boolean }) {
  const toast = useToast();
  const [loaded, setItems] = useState<ResourceItem[] | null>(null);
  const items = given ?? loaded;
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (given || !lectureId) return;
    api(`/lectures/${lectureId}/resources`).then((r) => setItems(list(r, "resources").map((x) => {
      const o = obj(x);
      return { id: String(o.id), title: String(o.title ?? "Resource"), sizeBytes: Number(o.sizeBytes ?? 0), mime: String(o.mime ?? "") };
    }))).catch(() => setItems([]));
  }, [lectureId, given]);

  if (!items) return <Loader2 className="size-6 animate-spin text-violet" />;
  if (!items.length) return <p className="text-ink-2">No downloads for this lesson.</p>;
  return (
    <ul data-testid={kind === "package" ? "package-files" : "lesson-files"} className="max-w-2xl divide-y divide-line rounded-tile border border-line bg-surface">
      {items.map((r) => {
        const Icon = /zip|compressed/.test(r.mime) ? FileArchive : /script|json|yaml|x-sh|text\/x/.test(r.mime) ? FileCode2 : FileText;
        return (
          <li key={r.id} className={`flex items-center gap-4 px-4 ${compact ? "py-2.5" : "py-3.5"}`}>
            <Icon className="size-6 text-violet" />
            <div className="min-w-0 flex-1"><p className="truncate font-bold">{r.title}</p><p className="text-xs text-muted">{bytes(r.sizeBytes)}</p></div>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy === r.id} onClick={async () => {
              setBusy(r.id);
              try {
                const d = obj(await api(kind === "package" ? `/course-files/${r.id}/download` : `/resources/${r.id}/download`, { method: "POST" }));
                window.location.assign(String(d.url));
              } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
            }}>
              {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Download
            </button>
          </li>
        );
      })}
    </ul>
  );
}
