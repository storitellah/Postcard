# Privacy

**Everything stays on your device. Full stop.**

Postcard Press is a local-first application:

- **No accounts** — there is no login or sign-up.
- **No uploads** — your photographs are opened by your browser and never sent anywhere. The app contains no upload code and makes no network requests with your content.
- **No tracking** — no analytics, no cookies, no fingerprinting, no third-party scripts, fonts or CDNs. Zero third-party requests.
- **Local storage only** — your work-in-progress project is autosaved to your browser's IndexedDB, and design presets/theme choice to localStorage, so you can pick up where you left off. This data lives only in your browser and is removed if you clear site data.
- **JSON backups** — "Save backup" downloads a project file to *your* device; "Restore" reads one from it. Nothing passes through a server.
- **Offline by design** — after the first visit the service worker caches the app itself, so it runs with no connection at all.

The only network activity the app ever performs is fetching its **own** static files (HTML/CSS/JS/icons) from wherever you host it.

External links (Storitellah, Patreon, Ko-fi) are ordinary links that open in a new tab when **you** click them.

Questions? <brian@storitellah.com>
