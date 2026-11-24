"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useToast } from "./Toast";

type Action = "approve" | "request-changes" | "reject" | "unpublish";
const labels: Record<Action, string> = { approve: "Approve and publish", "request-changes": "Request changes", reject: "Reject", unpublish: "Unpublish" };
const done: Record<Action, string> = { approve: "Course approved and published.", "request-changes": "Changes requested. The instructor has your note.", reject: "Course rejected.", unpublish: "Course unpublished." };

export function AdminDecision({ courseId, actions, onDone }: { courseId: string; actions: Action[]; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Action | null>(null);
  async function act(a: Action) {
    if (a !== "approve" && !note.trim()) return toast("error", "Add a note so the instructor knows what to change.");
    setBusy(a);
    try {
      await api(`/admin/courses/${courseId}/${a}`, { method: "POST", body: { note: note.trim() || undefined } });
      toast("ok", done[a]);
      setNote("");
      onDone();
    } catch (e) { toast("error", errMsg(e)); } finally { setBusy(null); }
  }
  return (
    <div>
      <label className="label" htmlFor={`note-${courseId}`}>Note to the instructor</label>
      <textarea id={`note-${courseId}`} className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required for changes or rejection. Be specific: which lecture, what to fix." />
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a} type="button" disabled={!!busy} onClick={() => act(a)} data-testid={`admin-${a}`}
            className={`btn btn-sm ${a === "approve" ? "btn-primary" : a === "reject" || a === "unpublish" ? "btn-ghost text-rose" : "btn-outline"}`}>
            {busy === a ? <Loader2 className="size-4 animate-spin" /> : null}{labels[a]}
          </button>
        ))}
      </div>
    </div>
  );
}
