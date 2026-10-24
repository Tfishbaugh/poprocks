# PopRocks

A light, kid-friendly web app for making beats and music videos.

Everything runs in the browser. PopRocks never uploads anything: beats stay on the device, and a video only goes where the device's own share sheet sends it.

**Open it:** https://tfishbaugh.github.io/poprocks/ and add it to the home screen. After the first visit it works with Wi-Fi off.

## What kids can do

- Tap the colored pads to make a beat (8 sounds × 16 steps). Tap a sound's picture to hear it.
- ▶ Play, 🐢 Slower and 🐇 Faster.
- 🎲 Surprise for a starter beat, 🧽 Clear, and ↩ Undo.
- Beats 1 to 4: one slot per kid. Each slot saves itself.
- 🎥 Make video: 3-2-1, then the beat plays while the camera films. Watch it back, then 💾 Save it to Photos/Gallery (or Downloads on a laptop).

## Safety

- No accounts, ads, chat or outside links.
- A strict Content-Security-Policy blocks requests to other sites.
- The camera and mic turn on only after 🎥 and turn off when you leave the record screen.
- 💾 Save opens the device's share sheet, which lists Save Video next to Messages, AirDrop and other apps. The device's parental controls decide what those can do.
- Every sound is synthesized in the browser, and the icons are drawn for this app.

## Development

Plain HTML, CSS and JavaScript modules: no build step and no runtime packages.

```sh
npm install        # dev only: Playwright (Apache-2.0)
npm run check      # syntax, offline file list, relative paths, CSP, no outside URLs
npm test           # unit tests, then browser tests
npm run icons      # rebuild the PNG icons from icons/icon.svg (needs rsvg-convert)
```

The browser tests use Chromium's fake camera and mic, and check recorded videos with `ffprobe` and `ffmpeg`. They use `/usr/bin/chromium` when it exists (set `CHROMIUM_PATH` to change it), and otherwise Playwright's own Chromium (`npx playwright install chromium`).
