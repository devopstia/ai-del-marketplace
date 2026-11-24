"use client";
import { useEffect, useState } from "react";

/** Private notes kept in this browser only (a per-viewer convenience; nothing is sent to the server). */
export function NotesPanel({ lectureId }: { lectureId: string }) {
  const key = `del-notes:${lectureId}`;
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      // Load this lecture's note from browser storage after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(localStorage.getItem(key) ?? "");
    } catch { /* storage blocked */ }
  }, [key]);
  return (
    <div className="max-w-3xl">
      <label htmlFor="notes" className="label">Your notes for this lecture</label>
      <textarea id="notes" className="field min-h-48" value={text} placeholder="Commands to remember, questions to look up, ideas for your own setup…"
        onChange={(e) => { setText(e.target.value); setSaved(false); }}
        onBlur={() => { try { localStorage.setItem(key, text); setSaved(true); } catch { /* ignore */ } }} />
      <p className="hint">{saved ? "Saved in this browser." : "Notes save in this browser when you click away. They aren’t shared or synced."}</p>
    </div>
  );
}
