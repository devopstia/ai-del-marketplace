# The installable app (PWA)

DevOps Easy Learning installs as an app on phones, tablets and computers straight from the browser: its own icon, full
screen, no app store (owner, 2026-11-25). Design taken from the Insurance Knowledge Hub's PWA (docs/research/insurance-hub-reuse.md).

## How people install it
`/install` (public) recognises the device and browser (`lib/pwa.ts::detect`) and shows the one thing to do there:
- **Chrome, Edge, Samsung Internet (Android and desktop):** an **Install app** button when the browser offers its prompt
  (`beforeinstallprompt`), otherwise the menu steps for that browser.
- **iPhone and iPad:** Share → Add to Home Screen → Add (Apple allows no install button). Chrome/Edge on iOS 16.4+ the same.
- **Mac Safari 17+:** File → Add to Dock. **Firefox desktop:** not supported; use Chrome or Edge.
- On a computer the page also shows a **QR code** that opens /install on the phone.

Also found in: the footer (Your account → Install the app), the account menu and phone menu (hidden inside the installed
app), and a dismissible row at the bottom of My learning (`components/pwa/InstallHint.tsx`).

## What makes it an app
- `app/manifest.ts` → `/manifest.webmanifest`: name, short name "DEL", `display: standalone`, start at My learning,
  dark background/theme (`#0c0f22`), icons 192/512 plus maskable versions, shortcuts (My learning, Courses, Deals).
- Icons in `public/icons/` are drawn from the logo by `node scripts/pwa-icons.mjs` (run after a logo change).
- `app/layout.tsx`: Apple home-screen icon and name, `viewport-fit=cover`, keyboard resizes the page; `globals.css` keeps
  phone form fields at 16 px (no iOS zoom) and content clear of a landscape notch; toasts sit above the home indicator.

## Offline and updates
`public/sw.js` does one thing: when a page can't load because the device is offline it shows `public/offline.html`
(self-contained: inline styles and logo; reloads itself when the connection returns). It **never caches pages, scripts, API
responses or videos**, so the installed app always runs the live version and nothing private stays on the device. Bump
`VERSION` in `sw.js` when it changes; to remove it, deploy a worker that calls `self.registration.unregister()`.

## Tests
`apps/web/e2e/pwa.spec.ts`: manifest and icons, Chrome's installability check (no errors), the offline screen, device
detection on /install. Check on real devices after a release: the Android prompt and icon, Add to Home Screen on iPhone,
the desktop install window.
