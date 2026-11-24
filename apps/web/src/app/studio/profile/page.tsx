"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { obj } from "@/lib/normalize";
import { PageHead } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/Empty";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/components/AuthProvider";

export default function StudioProfile() {
  const toast = useToast();
  const { me } = useAuth();
  const [f, setF] = useState<{ headline: string; bio: string; website: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/instructor/profile").then((r) => {
      const o = obj(obj(r).profile ?? r);
      setF({ headline: String(o.headline ?? ""), bio: String(o.bio ?? ""), website: String(o.website ?? "") });
    }).catch(() => setF({ headline: "", bio: "", website: "" }));
  }, []);
  return (
    <>
      <PageHead title="Instructor profile" sub="Shown on your public instructor page and on every course you publish." actions={me ? <Link href={`/instructors/${me.id}`} className="btn btn-outline btn-sm">View public page</Link> : null} />
      {!f ? <Skeleton className="h-96 max-w-3xl" /> : (
        <form className="max-w-3xl space-y-6" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try { await api("/instructor/profile", { method: "PUT", body: { ...f, website: f.website || null } }); toast("ok", "Profile saved."); }
          catch (err) { toast("error", errMsg(err)); } finally { setBusy(false); }
        }}>
          <div><label className="label" htmlFor="h">Headline</label><input id="h" className="field" maxLength={120} value={f.headline} onChange={(e) => setF({ ...f, headline: e.target.value })} placeholder="Principal SRE, Kubernetes and GitOps" /></div>
          <div><label className="label" htmlFor="b">Bio</label><textarea id="b" className="field min-h-56" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /><p className="hint">Markdown supported. The first sentence is used as your quote on the home page.</p></div>
          <div><label className="label" htmlFor="w">Website</label><input id="w" type="url" className="field" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="https://" /></div>
          <button className="btn btn-primary" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}Save profile</button>
        </form>
      )}
    </>
  );
}
