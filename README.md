# Player Cultivation Hub

Vite + React app with PWA support (installable on iPhone and other browsers that support web app manifests).

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Preview the production bundle:

```bash
npm run preview
```

## PWA icons (replace with your artwork)

Placeholder icons use a simple 3×3 pixel grid on `#0b1020`, defined in `public/icons/icon-source.svg`. Regenerate the PNGs on Windows with:

`powershell -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1`

**Files to overwrite when you have final assets**

| File | Size |
|------|------|
| `public/icons/icon-source.svg` | Vector source (also used as the SVG favicon in `index.html`) |
| `public/icons/icon-192.png` | 192×192 |
| `public/icons/icon-512.png` | 512×512 (manifest + maskable) |
| `public/icons/apple-touch-icon.png` | 180×180 (iOS Home Screen) |

## Deploy on Vercel

Connect the repo to Vercel and use the default settings for a Vite project (build command `npm run build`, output directory `dist`). The included `vercel.json` rewrites client-side routes to `index.html` while static files such as `sw.js`, `manifest.webmanifest`, and `icons/` are served from the build output.

## Install on iPhone (Safari)

1. Open the deployed site in **Safari** (not another browser) over **HTTPS** (e.g. your Vercel URL).
2. Tap the **Share** button (square with an arrow pointing up) in the toolbar.
3. Scroll the share sheet and tap **Add to Home Screen**.
4. Edit the name if you like, then tap **Add**.
5. Open the app from the new home screen icon. It runs in **standalone** mode (full screen, no Safari UI).

**Notes**

- Adding to the Home Screen must be done from Safari on iOS.
- On **iPhone Safari** (not standalone), you may see a small install hint. You can dismiss it; it stays hidden until you clear site data for this origin.
- After installation, updates roll out on the next visit when the new version is online; the service worker caches core assets for faster repeat loads and basic offline resilience.
