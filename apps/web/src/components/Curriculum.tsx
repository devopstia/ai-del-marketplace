"use client";
import { useState } from "react";
import { ChevronDown, FileText, ListChecks, PlayCircle, Lock } from "lucide-react";
import type { SectionOutline } from "@/lib/types";
import { clock, hours, plural } from "@/lib/format";
import { PreviewButton } from "./PreviewContext";

export function Curriculum({ sections }: { sections: SectionOutline[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(sections.slice(0, 1).map((s) => s.id)));
  const allOpen = open.size === sections.length;
  const lectures = sections.reduce((a, s) => a + s.lectures.length, 0);
  const total = sections.reduce((a, s) => a + s.lectures.reduce((b, l) => b + l.durationSec, 0), 0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-2">
        <span>{plural(sections.length, "section")}, {plural(lectures, "lecture")}, {hours(total)} total</span>
        <button type="button" className="link" onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map((s) => s.id)))}>
          {allOpen ? "Collapse all sections" : "Expand all sections"}
        </button>
      </div>
      <div className="overflow-hidden rounded-tile border border-line bg-surface">
        {sections.map((s, si) => {
          const isOpen = open.has(s.id);
          const dur = s.lectures.reduce((a, l) => a + l.durationSec, 0);
          return (
            <div key={s.id} className={si ? "border-t border-line" : ""}>
              <h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 bg-surface-2/60 px-4 py-3.5 text-left hover:bg-surface-2"
                  onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                >
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <span className="flex-1 font-display font-bold text-ink">{s.title}</span>
                  <span className="hidden text-sm text-muted sm:inline">{plural(s.lectures.length, "lecture")}, {hours(dur)}</span>
                </button>
              </h3>
              {isOpen ? (
                <ul className="py-1.5">
                  {s.lectures.map((l) => {
                    const Icon = l.type === "article" ? FileText : l.type === "quiz" ? ListChecks : PlayCircle;
                    return (
                      <li key={l.id} className="flex items-center gap-3 px-4 py-2 text-[0.95rem]">
                        <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                        <span className={`flex-1 ${l.isPreview ? "text-ink" : "text-ink-2"}`}>{l.title}</span>
                        {l.isPreview && l.type === "video" ? <PreviewButton lectureId={l.id} /> : <Lock className="size-3.5 text-muted" aria-label="Unlocks after purchase" />}
                        <span className="w-12 text-right text-sm tabular-nums text-muted">{l.durationSec ? clock(l.durationSec) : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
