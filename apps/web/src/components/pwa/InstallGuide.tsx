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

  const steps = device && here && !canPrompt ? ordered[0]! : null;
  return (
    <div className="pb-6">
      {/* 1. This device: the one thing to do here, with the reasons beside it */}
      <section className="border-b border-line" aria-labelledby="install-h">
        <div className="container-x grid gap-10 py-10 md:py-14 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-192.png" alt="" className="size-12 rounded-xl shadow-lift" />
              <p className="text-sm font-bold text-violet">DevOps Easy Learning app</p>
            </div>
            <h1 id="install-h" className="mt-4 font-display text-[clamp(2rem,4.2vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">Your courses, one tap away</h1>
            <p className="mt-3 max-w-xl text-lg text-ink-2">Install DEL on your phone, tablet or computer. It opens in its own window with its own icon. No app store, nothing to update.</p>

            <div className="mt-7 max-w-xl" data-testid="install-this-device">
              {installed ? (
                <p className="flex items-start gap-3 rounded-tile border border-line bg-surface px-4 py-3.5 text-ink-2"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint" aria-hidden="true" /><span><b className="text-ink">You’re using the installed app.</b> To add DEL to another device, use the QR code or the steps below.</span></p>
              ) : canPrompt ? (
                <div className="flex flex-wrap items-center gap-4">
                  <button type="button" className="btn btn-primary !px-6 !py-3 text-base" onClick={install} data-testid="install-button"><Download className="size-5" />Install the app</button>
                  <span className="text-sm text-muted">Takes a second on this {DEVICE_NAME[platform] ?? "device"}.</span>
                </div>
              ) : steps ? (
                <>
                  <h2 className="text-sm font-bold text-ink">On this {DEVICE_NAME[platform] ?? "device"}{steps.name ? `, in ${steps.name}` : ""}</h2>
                  <ol className="mt-3 space-y-3" data-testid="install-steps">
                    {steps.steps.map((s, i) => (
                      <li key={i} className="flex gap-3 text-ink-2"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-soft text-sm font-extrabold text-violet">{i + 1}</span><span className="pt-0.5">{s}</span></li>
                    ))}
                  </ol>
                  {device?.platform === "iphone" && device.browser !== "safari" ? <p className="mt-3 text-sm text-muted">Don’t see Add to Home Screen? Open this page in Safari.</p> : null}
                </>
              ) : <p className="text-ink-2">Choose your device below for the exact steps.</p>}
            </div>

            <ul className="mt-9 grid max-w-xl gap-4 border-t border-line pt-6 text-sm sm:grid-cols-3">
              <li><Zap className="size-5 text-violet" aria-hidden="true" /><p className="mt-2 font-bold text-ink">Opens like an app</p><p className="text-ink-2">Full screen, no browser tabs.</p></li>
              <li><RefreshCw className="size-5 text-violet" aria-hidden="true" /><p className="mt-2 font-bold text-ink">Always current</p><p className="text-ink-2">The latest version, every time.</p></li>
              <li><Smartphone className="size-5 text-violet" aria-hidden="true" /><p className="mt-2 font-bold text-ink">Light on storage</p><p className="text-ink-2">Progress stays in your account.</p></li>
            </ul>
          </div>

          {qr ? (
            <div className="flex items-center gap-6 rounded-panel border border-line bg-surface p-6 lg:flex-col lg:items-start lg:p-8" data-testid="install-qr">
              <div className="w-36 shrink-0 rounded-xl bg-white p-2 lg:w-44" aria-label="QR code that opens the install page" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
              <div>
                <h2 className="font-display text-lg font-bold">Install it on your phone</h2>
                <p className="mt-1 text-sm text-ink-2">Point your phone’s camera at the code. This page opens there with the steps for your phone.</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* 2. Every device and browser */}
      <section className="container-x pt-12" aria-labelledby="other-devices">
        <h2 id="other-devices" className="font-display text-2xl font-extrabold">Steps for every device</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-[17.5rem_minmax(0,1fr)] md:gap-10">
          <div className="scroll-rail -mx-1 flex gap-1.5 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0" role="tablist" aria-label="Devices" aria-orientation="vertical">
            {GUIDES.map((g) => (
              <button key={g.id} type="button" role="tab" aria-selected={shown === g.id} onClick={() => setTab(g.id)}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left text-sm font-bold ${shown === g.id ? "bg-violet-soft text-violet" : "text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
                <g.icon className="size-[18px]" aria-hidden="true" />{g.label}{g.id === platform ? <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] font-bold text-muted max-md:ml-1">This device</span> : null}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="self-start divide-y divide-line border-y border-line">
            {guide.browsers.map((b) => (
              <div key={b.name} className="grid gap-3 py-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-8">
                <h3 className="font-display font-bold text-ink">{b.name}</h3>
                <ol className="space-y-2 text-ink-2">{b.steps.map((st, i) => <li key={i} className="flex gap-3"><span className="w-4 shrink-0 text-right font-bold tabular-nums text-muted">{i + 1}.</span><span>{st}</span></li>)}</ol>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
