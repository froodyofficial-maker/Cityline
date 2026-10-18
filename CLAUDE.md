# OFFAL — notes for Claude

First-person horror game (three.js r160), in this repo alongside Cityline. Branch: `claude/cool-euler-bkrns1`.
Owner prefers: low token use (few screenshots, short tests), commit + push after every change, send builds after updates.

## Layout
- `offal/src/*.js` — the game. `main.js` (game loop, states, floors, lockers, hunt mode, debug handle `window.__offal`),
  `cutscenes.js` (death/ending/exit cutscenes, `Cutscene` class; Foreman's-eye `process` cutscene), `monster.js` (Foreman AI + `poseForeman`),
  `foreman.js` (Foreman mesh), `survivor.js` (bot worker in Play as the Foreman), `level.js` (layout + build), `props.js`/`props2.js` (props),
  `puzzles.js`, `audio.js` (WebAudio, `lite` mode on phones), `post.js` (post shader), `touch.js` (phone controls), `ui.js`, `config.js` (floors, difficulty).
- `offal/index.html`, `offal/offal.css` — screens and HUD.
- `dist/offal.html` — single-file build. Build: `node tools/build-offal.mjs`.
- `offal-desktop/` — Electron. `npm run dist:win` (game exe), `dist:cinema` (OFFAL Cinema exe), `dist:mac` (arm64 zip, unsigned).
  Faster Windows build: `node copy-game.cjs && npx electron-builder --win portable --x64` → `release/OFFAL-1.0.0-portable.exe`.
- `offal-android/` — WebView APK, built by GitHub Actions (`.github/workflows/offal-android.yml`) on push; artifact "OFFAL-android".
  Can't build locally (Google hosts blocked).

## Testing
- Dev server: `PORT=8090 node tools/serve.mjs` (run in background) → http://localhost:8090/offal/
- Lint: `npx eslint -c tools/eslint.offal.mjs offal/src` (use `window.location` etc. for browser globals).
- Regression pass (pass/fail text, no screenshots): `node tools/regress-offal.mjs` (needs the dev server; Playwright at
  `/opt/node22/lib/node_modules/playwright`). Covers menu, all 11 story floors, lift, overtime, save/resume, lockers, scale,
  every cutscene, Foreman mode, ending.
- Headless rendering is very slow: drive cutscenes by calling `cs.update(dt)` in a loop rather than waiting in real time.
- Never `pkill -f serve.mjs` (kills your own shell); use `pgrep -f "[s]erve.mjs"`.

## Current state (Oct 2026)
- Crew/multiplayer removed. Play as the Foreman unlocks after winning the story (`save.story.done`).
- First locker opened each shift has a body (jumpscare); 1–2 filled lockers per floor after.
- Scale puzzle accepts any weight >= target.
- Known rough edges: Foreman's arm very close to camera in the `process` cutscene; one odd camera angle mid-fall in `exit`.
- Not yet done: full regression pass on the latest build; real-phone check of audio/touch; Steam (achievements, controller).
