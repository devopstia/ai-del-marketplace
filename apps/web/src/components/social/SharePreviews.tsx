/* eslint-disable @next/next/no-img-element */

/**
 * Mock link previews (Super Admin › Social Media & Sharing): roughly how WhatsApp, Facebook, LinkedIn and X show a shared
 * link with this banner, title and description. Illustrative only: each app lays out, crops and shortens previews its
 * own way and changes that without notice (docs/SOCIAL_SHARING.md).
 */
export function SharePreviews({ image, title, description, host }: { image: string; title: string; description: string; host: string }) {
  const img = (cls = "") => (image ? <img src={image} alt="" className={`block w-full bg-sunken object-cover ${cls}`} style={{ aspectRatio: "1200 / 630" }} /> : <div className={`w-full bg-sunken ${cls}`} style={{ aspectRatio: "1200 / 630" }} />);
  const label = (s: string) => <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-muted">{s}</p>;
  return (
    <div className="mt-3 space-y-5" data-testid="share-previews">
      <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">Illustrative previews. Each app decides its own layout, cropping and text length, and keeps a copy for a while: see the troubleshooting notes in docs/SOCIAL_SHARING.md.</p>
      <div>
        {label("WhatsApp")}
        <div className="max-w-sm rounded-xl rounded-tr-sm border border-line bg-surface-2 p-1.5 shadow-sm">
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            {img()}
            <div className="px-2.5 py-2">
              <p className="line-clamp-2 text-sm font-bold text-ink">{title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{description}</p>
              <p className="mt-1 text-xs text-muted">{host}</p>
            </div>
          </div>
          <p className="break-all px-1.5 pt-1.5 text-sm text-violet">https://{host}/</p>
        </div>
      </div>
      <div>
        {label("Facebook")}
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          {img()}
          <div className="border-t border-line bg-surface-2 px-3 py-2.5">
            <p className="text-xs uppercase text-muted">{host}</p>
            <p className="mt-0.5 line-clamp-1 font-bold text-ink">{title}</p>
            <p className="line-clamp-1 text-sm text-ink-2">{description}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div className="min-w-0">
          {label("LinkedIn")}
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            {img()}
            <div className="px-3 py-2.5">
              <p className="line-clamp-2 text-sm font-bold text-ink">{title}</p>
              <p className="mt-0.5 text-xs text-muted">{host}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          {label("X")}
          <div className="relative overflow-hidden rounded-2xl border border-line">
            {img()}
            <span className="absolute bottom-2 left-2 max-w-[90%] truncate rounded bg-black/70 px-1.5 py-0.5 text-xs text-white" data-qa-on-media>{host}</span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted">From {host}</p>
        </div>
      </div>
    </div>
  );
}
