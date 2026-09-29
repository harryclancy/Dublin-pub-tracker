# Gym

Personal gym tracker, installed on the iPhone Home Screen as its own standalone app.

- Live: https://harryclancy.github.io/Dublin-pub-tracker/gym/ (deployed with the pub tracker by the existing GitHub Pages workflow)
- No account, no backend: all data is stored on the phone in IndexedDB, mirrored to localStorage, with a daily snapshot (last 7 kept). Export/Import backup in Settings.
- Offline: `public/gym/sw.js` caches the whole app; updates load in the background and apply on next launch.

Source is plain JavaScript in `gym-app/src/`. After editing, rebuild the published files:

```bash
node gym-app/build.cjs      # writes public/gym/index.html, sw.js, manifest.webmanifest
node gym-app/icon.cjs       # (only if the icon/splash design changes; needs playwright)
```
