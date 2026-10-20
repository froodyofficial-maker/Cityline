# CLAUDE.md — OFFAL 2

You are helping build **OFFAL 2**, the sequel to **OFFAL**, a first-person horror game. This file is the handover:
what OFFAL 1 is, how it was built, what the owner likes and dislikes, and what was learned the hard way.
Read it fully before writing code. The OFFAL 1 source lives in the `Cityline` repo
(`froodyofficial-maker/Cityline`, branch `claude/cool-euler-bkrns1`, folder `offal/`): reuse from it freely.

---

## 1. Working with the owner

- **Be conservative with tokens.** Few screenshots (one composite image instead of many), short tests, numeric checks
  instead of images where possible, batch changes. Long sessions get expensive: suggest a fresh session when one runs long.
- **Commit and push after every change**, with clear messages. Don't open PRs unless asked.
- **Send builds after updates**: the Windows exe (the main deliverable), the Mac `.app` zip only when asked
  (Apple Silicon M1–M4 only), and the Android APK via a GitHub Actions link (it can't be built in the cloud sandbox).
- The owner tests on Windows, a Mac and an Android phone, and reports problems in short messages, often with a screenshot.
  Take each report literally, fix it, verify it, and say plainly what you did and didn't check.
- They care most about: **things looking real** (they'll call out anything that "looks fake"), **no clipping**
  (bodies through floors, the camera inside models), **readable darkness** (dark, but you can still see what matters),
  and cutscenes that actually show what they're meant to show.
- They plan to sell on **Steam** (store page, trailer, thumbnails) and maybe the Play Store later.
- When unsure what they meant, pick the most likely reading, do it, and say which reading you took.

## 2. OFFAL 1 — the game

**Premise.** Hollow Pines Meatworks, 1998. Workers have been going missing. You're hired (an anonymous letter signed
UNKNOWN) to find out why. You go down floor by floor in a freight lift. **The Foreman** — a flayed, too-tall thing in a
butcher's apron and a stitched face, dragging a meat hook — is still on shift.

**Structure**
- **Intro**: a small, bright hiring office (no torch needed) with the job notice on the desk; the lift only goes down.
- **Story**: 10 floors (B1–B10) plus the finale, *The Line*. Floor themes include the meatworks, the Morgue, the Drains,
  Evisceration, Administration, the Processing Line, Deep Freeze, the Quiet Line. Each theme has its own layout,
  textures, props and puzzle.
- **On each floor**: cut ID tags out of dead workers, feed them to the lift, solve the floor's puzzle, pull the lever.
- **Puzzles**: fuses, keypad wing (with a shutter), the meat scale (any weight at or over the target), steam valves in
  order, breakers (finale), morgue drawers, keycard, sluices, meat key.
- **Overtime**: an endless mode on random floors. Difficulty: Easy / Normal / Hard / Extreme (noise, hearing, deaths).
- **Ending**: a cinematic escape. The Foreman chases you and a door slams on him. Then a white end card with stats.
  After finishing you can pick any floor.
- **Play as the Foreman**: unlocks after winning. You hunt a bot worker who cuts tags and runs for the lift.
  - The bot sees you from 20 m; you can make him out within 20 m.
  - His running and tag-cutting are heard across the whole floor.
  - Catching him plays a Foreman's-eye cutscene: the drag to the grinder.
- **Multiplayer ("Crew")** was prototyped and then **removed**. The owner may make it a separate game later.

**The Foreman (AI)**
- Hunts by **sound** and **light**: footsteps, running, the torch in his face.
- Patrols, investigates noises, pauses and looks around, searches where he lost you, and opens lockers.
- Two Foremen on later floors, which split up.
- Can't enter **crouchways** (low tunnels).
- Running animation: a low, lunging lope where the hips follow the planted foot.

**Player systems**
- Torch with a battery.
- Stamina and crouching; hiding in lockers, holding your breath (Space) while he's near.
- Listening (hold Q) points you the way.
- A 5-slot hotbar and a TAB objectives screen.
- Adrenaline syringes; one-shot deaths.
- A gun you can find (in one piece), with limited bolts: it stuns rather than kills.
- Keepsakes: collectibles with a 3D viewer, kept in the Collection screen along with cutscenes you've seen.
- Saves at the exact moment; resume mid-floor.

**Scares and death**
- Death cutscenes, chosen at random: rope over a fire pit, grinder, fan, eaten, rack.
  - Rack: he tears your arms off by hand.
  - Grinder: you're dragged by the ankle.
- Locker scare: the first locker opened each shift has a body in it, with a jumpscare. After that, 1–2 filled lockers
  per floor.
- No blood drips on screen (removed at the owner's request).

**Platforms**
- **Windows exe** (Electron, portable).
- **Mac**: an Apple Silicon zip. It's unsigned, so users run `xattr -cr` and `codesign --force --deep -s -` on it.
- **Android APK**: a WebView app with full touch controls:
  - a stick and drag-to-look
  - USE / CROUCH / LISTEN / TORCH buttons; FIRE only with the gun, BREATH only in a locker
  - TASKS button top left; tap hotbar items to use them; number buttons on the keypad
  - phone-specific settings: UI size sliders (1–100%), touch look sensitivity, lighter audio, no dither on phones
- **OFFAL Cinema**: a separate app of staged shots for recording the trailer, with no game in it. It was used for the
  Steam trailer and the YouTube thumbnail (a close-up of the Foreman's face on the right with black beside it).

## 3. How OFFAL 1 is built (reuse this)

- **three.js r160**, plain JS modules, bundled by esbuild into **one HTML file** (`node tools/build-offal.mjs` → `dist/offal.html`).
- **Everything is procedural.** No asset files:
  - models from primitives (`props.js`, `props2.js`, `foreman.js`)
  - textures drawn on canvases (`textures.js`)
  - sound synthesised in WebAudio (`audio.js`), with HRTF panning on desktop and a lite mode on phones
  - this keeps the game a single small file
- **Post shader** (`post.js`): low internal resolution, grain, Bayer dither, scanlines, fear/damage/flash/blackout.
  - The grain hash must not use `sin()`: it breaks into a checker pattern on phone GPUs.
  - Phones turn the dither and scanlines off.
- **Levels** (`level.js`): seeded layouts made of tiles (TILE = 2 m) and themed rooms. Everything static is baked into
  a few big meshes for speed (`bake.js`). Moving things (swinging meat, lockers, doors) are left out of the bake.
- **Cutscenes** (`cutscenes.js`): each is its own small scene with a `Build` and an `Update(dt)` on a timeline.
  `this.at(t, key, fn)` fires one-off events. Gore is a particle system plus decals.
- **Desktop**: Electron in `offal-desktop/`.
  - Faster Windows build: `node copy-game.cjs && npx electron-builder --win portable --x64`.
  - The Cinema build injects `window.OFFAL_CINEMA = true`.
- **Android**: `offal-android/`, a Gradle project with a WebView `MainActivity` that loads the HTML with `?android=1`.
  It's built by `.github/workflows/offal-android.yml` on push.
- **Testing**: Playwright with headless Chromium on swiftshader. `window.__offal` exposes the game state and functions.
  - `tools/regress-offal.mjs` is a pass/fail regression run with no screenshots.
  - Lint: `npx eslint -c tools/eslint.offal.mjs offal/src`.

## 4. Lessons learned (avoid repeating these)

**Bodies and clipping**
- **The body model's origin is at the hips**, not the feet. A body standing at y=0 is buried to the waist; put the root
  about 0.93 m up (scaled).
- **Check clipping with numbers.** After posing, find each mesh's lowest world point (and which limb it is) over the
  whole timeline. This caught a body hanging 1.6 m through the floor that screenshots missed.
- Anything hanging from a hand must lie along the floor until the hand is high enough (`hangFromHand` in `cutscenes.js`).

**Cutscenes and the camera**
- Never do `cam.position.lerp(target, k)` every frame. It compounds and ends up inside the model. Lerp from a stored
  start point to a stop point set a fixed distance from the face.
- To have the Foreman grab something, solve where he stands and how high he lifts his arm. Keep him on one side,
  facing it; don't let the solver turn him, or it diverges.
- Tear the real limb off and attach it to his hand (`hand.attach(limb)`). Hiding the limb and spawning a random gore
  piece reads as glitchy.
- Headless rendering is very slow. Drive cutscenes by calling `update(dt)` in a loop, then grab single frames.

**Looking real**
- Anything set into a wall (pipes, holes) must sit **in front of** the wall plane, or the wall hides its inside.
- Water needs a moving ripple normal map so the torch glints off it. A flat translucent sheet looks fake.
- Debris lies on the floor in heaps, not floating at random tilts. Give bones knuckled ends and skulls sockets and teeth.
- Big spaces in dark cutscenes need surfaces that light themselves a little (emissive) and landmarks such as landings,
  railings, doorways and lamps, so the shape reads.

**Phones**
- Phone audio crackles if the CPU is overloaded. Use a 22 kHz context, a short reverb, equal-power panning and fewer
  voices.

**Gameplay and UI**
- Hanging puzzle items shouldn't swing when the player walks up to them.
- Don't nag: the crouchway hint was removed.
- Exact-sum puzzles frustrated the owner. Prefer "at least".

**Sandbox and tools**
- Never `pkill -f` a pattern that matches your own command line. Use `pgrep -f "[s]erve.mjs"`.
- `dl.google.com` is blocked in the cloud sandbox, so Android builds go through GitHub Actions.

## 5. Known rough edges in OFFAL 1

- In the Foreman's-eye `process` cutscene, his arm is very large and close to the camera while lifting.
- One odd camera angle mid-fall in the `exit` cutscene.
- Not yet run: a full regression pass on the final build, and a real-phone check of audio and touch.
- The lobby looked bad and was dropped. If multiplayer comes back, it needs a 3D lobby with animated players.

## 6. Ideas carried over for OFFAL 2

These came from the owner or were recommended to them; confirm before building.
- Expand the story: the owner wants to continue it whatever OFFAL 1's sales are. Who sent the UNKNOWN letter? What is
  the Foreman? What's above and below the meatworks?
- **Controller support and Steam achievements** from the start (Steam Deck matters).
- Scripted one-off scares on specific floors: a lift stopping between floors, a body that's gone when you look back,
  the hook scraping in the vents.
- Sound captions/subtitles, key rebinding, and a "previously…" recap on loading a save.
- Playable Foreman as an unlockable again, if wanted.
- Multiplayer only as its own project.
- Keep the single-file, all-procedural approach unless there's a strong reason not to: it's what made shipping to
  Windows, Mac and Android cheap.
