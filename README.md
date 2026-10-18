# Ember City

An open-world crime game with a full story mode, built on [three.js](https://threejs.org) (r160).

> Six years inside. One last night to settle everything.

## Play

**Desktop app (Windows):** run `EmberCity-2.1.0-portable.exe`. It needs no install and runs straight from a USB stick or Downloads. It uses the game's own window instead of a browser tab, asks for the laptop's high-performance graphics card, and isn't slowed down in the background. F11 or Alt+Enter toggles fullscreen.

The **Desktop app** GitHub Actions workflow builds the `.exe` on Windows and publishes it as a GitHub Release (Actions tab → *Desktop app* → *Run workflow*). Pushing a tag such as `v2.1.0` does the same.

**Browser:** open `dist/ember-city.html`. It's one self-contained file, so it runs straight from disk with no install.

**From source:**

```bash
npm start            # serves the project at http://localhost:8080
```

`npm start` needs only Node 18 or newer. It has no dependencies. Any static file server works too, so the repo can be hosted on GitHub Pages as is. Opening `index.html` from disk won't work, because browsers block ES modules on `file://`. Use the dist file for that.

## GearGuide (hardware advisor)

`hardware-advisor/` is GearGuide, a separate static website that recommends gaming hardware (mice, keyboards, headsets, monitors, controllers and wheels) from your games, budget, hands and setup. A short setup (welcome, then games, hand length and product types) builds a dashboard where every preference can be changed live. Each pick comes with a match percentage, the reasons it fits, strengths and weaknesses, and cheaper or pricier alternatives. Open `hardware-advisor/index.html` straight from disk, or browse to `/hardware-advisor/` with `npm start`.

- **Catalog:** `hardware-advisor/data.js`. Each product has a typical US street price and the manufacturer list price, both checked in October 2026.
- **Currencies:** prices convert with live European Central Bank rates (via the free Frankfurter API) and fall back to built-in rates from 15 Oct 2026 when offline.
- **Product photos:** add them in `hardware-advisor/images.js` (a file in `hardware-advisor/img/` or an image URL per product id). Products without a photo show an illustration drawn from their real shape and brand colors.

## Build

```bash
npm install          # one dev dependency: esbuild
npm run build        # -> dist/ember-city.html (three.js, game, CSS, fonts and icon inlined)
npm run check        # syntax-check every game source and the combined script
npm run desktop      # run the desktop app (Electron)
npm run desktop:win  # build desktop/release/EmberCity-<version>-portable.exe and a zip
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
src/world/              city layout + road network, districts.js (everything outside downtown), interiors,
                        map variants, navigation grids, sky + ambient life
src/gameplay/           player, combat, police, shops, casino, day cycle
src/vehicles/air.js     helicopters + planes
src/net/                optional peer-to-peer multiplayer
src/story/engine.js     mission runner, cinematic camera, NPC actors, saves
src/story/chapters.js   the story: all cutscenes, dialogue and missions
tools/                  dev server, single-file builder, syntax checker
desktop/                Electron wrapper + Windows/Linux/macOS packaging (electron-builder)
.github/workflows/      desktop build on GitHub's Windows runners
```

The game scripts share one global scope. `boot.js` concatenates them in manifest order and runs them as a single classic script, which is the same thing the bundled build does. A new file goes in `src/manifest.js`.

## The city

Greater Ember City covers about 780 × 730 m, roughly seven times the old map. It's surrounded by mountains, with the ocean to the south. A river runs north to south through it, with a bridge on every street.

| District | What's there |
| --- | --- |
| Downtown | The original centre: the bank, the casino, your apartment, shops. The story starts here. |
| Ember Heights | Skyscrapers, plazas and the 190 m Ember Tower (north). |
| Palm Grove | Suburban streets with houses, lawns, driveways and mailboxes (west). |
| Foundry | Warehouses, smokestacks, tank farms and truck yards (south-west). |
| Port Ember | Container yards, harbour cranes and moored cargo ships (south-east). |
| Eastside | Apartment blocks, the Ember Mall and car parks. |
| Midtown | Shop rows, gas stations, offices and parks between the districts. |
| Ember Beach | Sand, palms, lifeguard towers, beach huts and the pier with its Ferris wheel. |
| Ember International | The airport. |

A name card shows when you cross into a new district. The minimap covers the whole city, and the full-screen map (M) is drawn at full resolution with district labels.

Traffic and pedestrians spawn on the streets around you wherever you are, and are recycled as you move. Police chase you anywhere on the map using a city-wide pathfinding grid.

## Things to do outside downtown

| Place | What you can do |
| --- | --- |
| Ember Mall (Eastside) | Walk in. Buy outfits at THREADS, guns at EMBER ARMS, and eat at the food court. Rob the LUXE jewellery counter. |
| Ember Motors (Eastside) | Buy a sedan, sports coupe or SUV. It's parked out front. |
| Chop Shop (Foundry) | Drive a car in and sell it. Clean cars pay more, and nobody buys a car while you're wanted. |
| Pier 9 yard (Port Ember) | Steal three smuggled crates (cash and loot). Grabbing one alerts dock security. The harbour crane has a ladder up to its beam. |
| Ember Tower (Heights) | Take the elevator to the observation roof, or crack the NOVA vault: $22k–38k and five stars. |
| Ember Pier & Beach | Ride the Ferris wheel ($20), or eat at the surf shack, ice-cream stand and taco hut. |
| Gas stations | Buy snacks, or rob the counter (R). |
| Palm Grove | At night, break into houses with newspapers piling up on the porch. Sometimes the owners are home. |
| Everywhere | Rooftop ladders, dumpsters to hide in, and 24 hidden Ember Tokens ($250 each, $10,000 for all of them, remembered between sessions). |

## Rosy

Rosy is your golden retriever and goes everywhere with you.
- **Following:** she trots at your side, rides along in any vehicle and follows you into buildings.
- **Waiting:** she waits at the bottom of ladders and the tower elevator.
- **Petting:** when you stand still she sits down; press E to pet her (+10 HP, once every 20 s).
- **Wanted level:** she barks when your wanted level goes up.
- **Invulnerable:** nothing can hurt her.
- **If you go down:** she lies down beside you and keeps watch until you're back on your feet.

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
- **Batching:** static scenery merges into about 420 batches for the whole map. Facades use one material per style, with the colour stored in the geometry.
- **Lighter rendering:** water reflects only the merged city, terrain and sky. Shadows are drawn once per frame instead of once per render pass.
- **Level of detail:** cars past about 70 m draw as just body and glass, and pedestrians past about 170 m aren't drawn.
- **Fast collisions:** collision and line-of-sight checks use a 16 m spatial grid over the buildings.

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
| F11 / Alt+Enter | Fullscreen (desktop app) |

## Credits

- three.js: MIT, © three.js authors. See `vendor/three/LICENSE`.
- Press Start 2P font: SIL Open Font License 1.1. See `assets/fonts/`.
