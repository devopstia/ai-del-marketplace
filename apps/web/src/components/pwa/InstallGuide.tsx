"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Download, Laptop, Monitor, RefreshCw, Smartphone, Zap } from "lucide-react";
import QRCode from "qrcode";
import { detect, promptInstall, usePwa, type Platform } from "@/lib/pwa";
import { useToast } from "../Toast";

/** Exact steps per device and browser (Chrome, Edge, Samsung Internet and Firefox on Android also get the Install button). */
const GUIDES: { id: Platform; label: string; icon: typeof Smartphone; browsers: { name: string; steps: string[] }[] }[] = [
  {
    id: "iphone", label: "iPhone and iPad", icon: Smartphone, browsers: [
      { name: "Safari", steps: ["Tap the Share button (the square with an arrow) at the bottom of the screen, or at the top on iPad.", "Scroll down and tap Add to Home Screen.", "Tap Add. DEL appears on your home screen."] },
      { name: "Chrome or Edge (iOS 16.4 and later)", steps: ["Tap the Share button in the address bar.", "Tap Add to Home Screen, then Add.", "On older iOS versions, open this page in Safari instead."] },
    ],
  },
  {
    id: "android", label: "Android", icon: Smartphone, browsers: [
      { name: "Chrome or Edge", steps: ["Open the browser menu (⋮).", "Tap Install app or Add to Home screen (Edge: Add to phone).", "Confirm with Install."] },
      { name: "Samsung Internet", steps: ["Tap the install icon in the address bar.", "Or open the menu (≡), tap Add page to, then Home screen."] },
      { name: "Firefox", steps: ["Open the menu (⋮).", "Tap Install or Add to Home screen."] },
    ],
  },
  {
    id: "windows", label: "Windows", icon: Monitor, browsers: [
      { name: "Chrome", steps: ["Click the install icon at the right of the address bar.", "Or open the menu (⋮) → Cast, save and share → Install page as app."] },
      { name: "Edge", steps: ["Click the app icon at the right of the address bar.", "Or open the menu (…) → Apps → Install this site as an app."] },
      { name: "Firefox", steps: ["Firefox can't install web apps. Open this page in Chrome or Edge."] },
    ],
  },
  {
    id: "mac", label: "Mac", icon: Laptop, browsers: [
      { name: "Safari (macOS Sonoma and later)", steps: ["Open the File menu.", "Choose Add to Dock, then Add."] },
      { name: "Chrome or Edge", steps: ["Click the install icon at the right of the address bar.", "Or open the browser menu and choose Install DevOps Easy Learning."] },
    ],
  },
  {
    id: "linux", label: "Linux and ChromeOS", icon: Laptop, browsers: [
      { name: "Chrome or Edge", steps: ["Click the install icon at the right of the address bar.", "On a Chromebook the app then appears in the launcher."] },
    ],
  },
];

const mobile = (p: Platform) => p === "iphone" || p === "android";
const DEVICE_NAME: Partial<Record<Platform, string>> = { iphone: "iPhone or iPad", android: "Android device", windows: "Windows computer", mac: "Mac", linux: "computer" };
const subscribeNone = () => () => {};
let cachedDevice: ReturnType<typeof detect> | null = null;
const readDevice = () => (cachedDevice ??= detect(navigator.userAgent, navigator.maxTouchPoints ?? 0));

export function InstallGuide() {
  const toast = useToast();
  const { canPrompt, installed } = usePwa();
  // Device detection only exists in the browser; the server renders the generic version.
  const device = useSyncExternalStore(subscribeNone, readDevice, () => null);
  const platform: Platform = device?.platform === "chromeos" ? "linux" : device?.platform ?? "other";
  const [tab, setTab] = useState<Platform | null>(null);
  const shown = tab ?? (GUIDES.some((g) => g.id === platform) ? platform : "android");
  const guide = GUIDES.find((g) => g.id === shown)!;
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!device || mobile(platform)) return;
    QRCode.toString(`${window.location.origin}/install`, { type: "svg", margin: 1, color: { dark: "#0c0f22", light: "#ffffff" } }).then(setQr).catch(() => setQr(null));
  }, [device, platform]);

  async function install() {
    if (await promptInstall()) toast("ok", "Installing DevOps Easy Learning. Look for the DEL icon.");
  }

  const here = GUIDES.find((g) => g.id === platform);
  const browserName = device?.browser;
  // Put the steps for this browser first.
  const ordered = [...guide.browsers].sort((a, b) => Number(shown === platform && !!browserName && b.name.toLowerCase().includes(browserName)) - Number(shown === platform && !!browserName && a.name.toLowerCase().includes(browserName)));

  return (
    <div className="container-x pb-12 pt-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" className="size-16 rounded-2xl shadow-float" />
            <div>
              <h1 className="font-display text-[clamp(1.9rem,3.6vw,2.6rem)] font-extrabold leading-tight text-ink">Install the app</h1>
              <p className="text-ink-2">Your courses one tap away: its own icon, full screen, no app store.</p>
            </div>
          </div>

          <section className="mt-8 rounded-panel border border-line bg-surface p-5 sm:p-6" aria-labelledby="this-device" data-testid="install-this-device">
            {installed ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-mint" aria-hidden="true" />
                <div>
                  <h2 id="this-device" className="font-display text-xl font-bold">You’re using the installed app</h2>
                  <p className="mt-1 text-ink-2">DevOps Easy Learning is installed on this device. To add it to another device, pick it below.</p>
                </div>
              </div>
            ) : (
              <>
                <h2 id="this-device" className="font-display text-xl font-bold">{device ? `On this ${DEVICE_NAME[platform] ?? "device"}` : "On this device"}</h2>
                {canPrompt ? (
                  <>
                    <p className="mt-1 text-ink-2">One click and DEL opens in its own window, with its own icon.</p>
                    <button type="button" className="btn btn-primary mt-4" onClick={install} data-testid="install-button"><Download className="size-4" />Install app</button>
                  </>
                ) : device && here ? (
                  <ol className="mt-3 space-y-2.5" data-testid="install-steps">
                    {ordered[0]!.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-ink-2"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-violet text-xs font-bold text-on-violet">{i + 1}</span><span>{s}</span></li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-1 text-ink-2">Pick your device below for the steps.</p>
                )}
                {device?.platform === "iphone" && device.browser !== "safari" ? <p className="mt-3 text-sm text-muted">Tip: if you don’t see Add to Home Screen, open this page in Safari.</p> : null}
              </>
            )}
          </section>

          <section className="mt-8" aria-labelledby="other-devices">
            <h2 id="other-devices" className="font-display text-lg font-bold">All devices</h2>
            <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Devices">
              {GUIDES.map((g) => (
                <button key={g.id} type="button" role="tab" aria-selected={shown === g.id} onClick={() => setTab(g.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold ${shown === g.id ? "border-violet bg-violet text-on-violet" : "border-line text-ink-2 hover:border-violet hover:text-ink"}`}>
                  <g.icon className="size-4" aria-hidden="true" />{g.label}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2" role="tabpanel">
              {guide.browsers.map((b) => (
                <div key={b.name} className="rounded-tile border border-line bg-surface p-4">
                  <h3 className="font-display font-bold text-ink">{b.name}</h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">{b.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="grid min-w-0 gap-5">
          {qr ? (
            <div className="rounded-panel border border-line bg-surface p-5 sm:p-6" data-testid="install-qr">
              <h2 className="font-display text-lg font-bold">On your phone</h2>
              <p className="mt-1 text-sm text-ink-2">Scan with your phone’s camera to open this page there.</p>
              <div className="mt-4 w-48 rounded-xl bg-white p-2" aria-label="QR code that opens the install page" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
            </div>
          ) : null}
          <div className="rounded-panel border border-line bg-surface p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Why install it</h2>
            <ul className="mt-3 space-y-3 text-sm text-ink-2">
              <li className="flex gap-3"><Zap className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" /><span><b className="text-ink">Opens like an app.</b> Its own icon and window, without browser tabs and bars.</span></li>
              <li className="flex gap-3"><RefreshCw className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" /><span><b className="text-ink">Always up to date.</b> No store updates; you always get the latest version.</span></li>
              <li className="flex gap-3"><Smartphone className="mt-0.5 size-5 shrink-0 text-violet" aria-hidden="true" /><span><b className="text-ink">Light on storage.</b> Your progress, notes and certificates stay on your account.</span></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
