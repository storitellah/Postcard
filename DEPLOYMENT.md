# Deploying Postcard Press

Postcard Press is a **plain static site** — no build step, no server code, no environment variables. Any static host works.

## Files that must be deployed

```
index.html  styles.css  script.js
manifest.json  service-worker.js  favicon.svg  icons/
```

(`samples/` and the Markdown docs are optional.)

## Cloudflare Pages (recommended)

1. Push this repository to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository and use:
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
4. Deploy. Done — HTTPS, HTTP/2 and global caching are automatic.

Direct upload alternative:

```bash
npx wrangler pages deploy . --project-name postcard-press
```

## GitHub Pages

1. Repository → **Settings → Pages**.
2. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. The app will be served at `https://<user>.github.io/<repo>/`.

All paths in the app are relative, so serving from a sub-path works.

## Netlify / Vercel / any static host

Drag-and-drop the folder, or point the host at the repo with **no build command** and output directory `/`.

## Self-hosting / offline use

- Any web server (nginx, Apache, Caddy) serving the folder works.
- Opening `index.html` directly from disk (`file://`) also works — the service worker is skipped, but the app itself is fully functional.

## Notes

- **HTTPS is required** for the service worker / installable PWA (localhost is exempt).
- Set long cache headers for `icons/` and let `index.html` revalidate; the service worker versions its own cache (`postcard-press-v…` in `service-worker.js` — bump it when deploying changes).
- No analytics, fonts or CDNs are fetched: the app makes **zero third-party requests**, so no cookie banner is needed.

## Updating

Bump the `CACHE` version string at the top of `service-worker.js` with every release so returning offline users pick up the new files.
