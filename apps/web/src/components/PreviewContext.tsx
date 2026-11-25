"use client";
import { createContext, useContext, useState } from "react";
import { PlayCircle } from "lucide-react";
import type { LectureOutline } from "@/lib/types";
import { PreviewModal } from "./PreviewModal";

const Ctx = createContext<(id: string) => void>(() => {});

export function PreviewProvider({ courseTitle, slug, previews, children }: { courseTitle: string; slug: string; previews: LectureOutline[]; children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <Ctx.Provider value={setId}>
      {children}
      <PreviewModal courseTitle={courseTitle} slug={slug} previews={previews} lectureId={id} onClose={() => setId(null)} />
    </Ctx.Provider>
  );
}

export function PreviewButton({ lectureId, children, className = "link text-sm inline-flex items-center gap-1" }: { lectureId: string; children?: React.ReactNode; className?: string }) {
  const open = useContext(Ctx);
  return (
    <button type="button" className={className} onClick={() => open(lectureId)} data-testid="preview-button">
      {children ?? <><PlayCircle className="size-4" />Preview</>}
    </button>
  );
}
