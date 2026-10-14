# Ember City

An open-world crime game with a full story mode, built on [three.js](https://threejs.org) (r160).

> Six years inside. One last night to settle everything.

## Play

**Quickest:** open `dist/ember-city.html` in a browser. It's one self-contained file, so it runs straight from disk with no install.

**From source:**

```bash
npm start            # serves the project at http://localhost:8080
```

`npm start` needs only Node 18 or newer. It has no dependencies. Any static file server works too, so the repo can be hosted on GitHub Pages as is. Opening `index.html` from disk won't work, because browsers block ES modules on `file://`. Use the dist file for that.

## Build

```bash
npm install          # one dev dependency: esbuild
npm run build        # -> dist/ember-city.html (three.js, game, CSS, fonts and icon inlined)
npm run check        # syntax-check every game source and the combined script
```

## Project layout

```
index.html              page shell: menus, HUD, story UI
css/ui.css              all UI styling
assets/                 icon + self-hosted pixel font (Press Start 2P; SIL OFL)
vendor/three/           three.js r160 + the post-processing addons used
src/boot.js             ES-module bootstrap: loads three.js, then the game scripts
src/manifest.js         load order of the game scripts
src/core/               renderer, scene, input, shared helpers
src/gfx/engine.js       procedural textures/materials, building facades, water, characters, env + reflections
src/gfx/pipeline.js     quality presets, post chain, dynamic lights
src/world/              city layout, interiors, map variants, navigation grid, sky + ambient life
src/gameplay/           player, combat, police, shops, casino, day cycle
src/vehicles/air.js     helicopters + planes
src/net/                optional peer-to-peer multiplayer
src/story/engine.js     mission runner, cinematic camera, NPC actors, saves
src/story/chapters.js   the story: all cutscenes, dialogue and missions
tools/                  dev server, single-file builder, syntax checker
```

The game scripts share one global scope. `boot.js` concatenates them in manifest order and runs them as a single classic script, which is the same thing the bundled build does. A new file goes in `src/manifest.js`.

## Graphics

Graphics quality is set from the Open World setup screen. It has four levels: Low, Medium, High and Ultra. High and Ultra use:

- physically based materials with procedural normal and roughness maps, plus image-based lighting from a live environment cube
- night windows driven by a shader, with lit interiors
- planar-reflection water with waves, foam and depth tint
- GTAO ambient occlusion, an exponential height-fog pass with sun in-scattering, and bloom
- ACES grading with god rays, MSAA and soft shadows
- interiors that switch to warm practical lighting and close off the sky

## Performance

- **Automatic starting quality:** on first launch the game picks Low on phones, Medium on 4-core or 4 GB machines, and High otherwise.
- **Adaptive resolution:** render resolution drops (to as low as 50%) when the frame rate falls, and recovers when there's headroom.
- **Anti-aliasing:** handled once, inside the post-processing chain, and the browser is asked for the high-performance GPU.
- **Throttled extras:** water reflections refresh every other frame on High, and the reflection capture refreshes every 5–12 seconds.
- **No UI blur:** the HUD has no backdrop blur, and its text is rewritten only when it changes.

## Story mode

There are eleven chapters, from *Homecoming* to *Ember Falls*. They are fully staged cutscenes with player choices and two endings. Progress saves automatically.

- Police are capped in story mode: at most 12 on the map, and wanted level builds more slowly.
- Airplanes unlock after Chapter 6 (*The Run*).
- Helicopters unlock after Chapter 8 (*Rooftops*).
- Time of day carries into cutscenes, so a night mission stays night.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Shift | Sprint |
| Mouse | Look (click to lock) |
| Left click / Right click | Shoot / scope |
| F | Enter or exit a vehicle |
| E | Interact |
| 1 to 4 | Weapons |
| I | Inventory |
| M | Map |
| X | Crouch |
| Space | Jump; next line in cutscenes |
| Enter | Skip a cutscene |
| T | Skip time (open world) |

## Credits

- three.js: MIT, © three.js authors. See `vendor/three/LICENSE`.
- Press Start 2P font: SIL Open Font License 1.1. See `assets/fonts/`.
