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

## Build

```bash
npm install          # one dev dependency: esbuild
npm run build        # -> dist/ember-city.html (three.js, game, CSS, fonts and icon inlined)
npm run check        # syntax-check every game source and the combined script
npm run desktop      # run the desktop app (Electron)
npm run desktop:win  # build desktop/release/EmberCity-<version>-portable.exe and a zip
```

## HOLLOW PARK (horror)

A separate first-person survival horror game lives in `hollowpark/`. **Content warning:** extreme graphic gore (flayed and dismembered bodies, a violent death every time you're caught), sudden loud sounds, flashing light and screen distortion.

> Dad stopped answering the phone a week ago. You drive back to the house on Hollow Lane, the one that backs onto the park where Mom disappeared thirty years ago. The kids still sing a rhyme about the man who lives there.

**Play:** open `dist/hollowpark.html` (one self-contained file, runs from disk; the fonts load from Google Fonts when online), or `npm start` and go to http://localhost:8080/hollowpark/. Use headphones, play in the dark, and set graphics and brightness in Settings. Keyboard and mouse only.

**Where it happens:** your father's house (hall, living room with the TV still on, kitchen, garage, the bedrooms, a locked study, your old room), the backyard and shed, and Hollow Park behind the fence: lamp-lit paths, hedges, dead trees, the playground, the pond and pier, a gazebo, the restrooms and the groundskeeper's hut. It's all one connected map.

**How it plays**

- Mr. Smiles is tall, grey and eyeless, with a grin that runs ear to ear. He hunts by **sound** and **light**: running is loud, crouching is quiet, and pointing your flashlight at him gets you noticed.
- **The crickets stop when he's close.** Listen for the silence.
- There's no combat. Break line of sight and hide in a wardrobe, closet, locker or restroom stall. If he watches you get in, he tears the door off. If he stops outside to sniff, hold **Space** to hold your breath.
- Find the car keys, the gas and the battery your father hid in the park. Fix the car, start it, and survive while the garage door grinds open.
- You die in one hit. Your body stays where it fell, and you wake back in the hall.

**Graphics:** full-resolution physically based rendering with procedural albedo, normal and roughness maps for every surface; real thin walls with doors and windows; a moonlit sky with soft moon shadows that follow you; a flashlight with shadows; instanced bare trees and long grass; wet asphalt with puddles; a reflective pond; ground-truth ambient occlusion (High/Ultra), bloom, filmic tone mapping and SMAA. There are four quality presets, plus adaptive resolution that holds the frame rate.

**Loading and menu:** a 3D loading scene shows real build progress (textures, house, park, shader compile), followed by a main menu over a live flythrough of the park, with settings for graphics quality, brightness, mouse sensitivity, field of view and volume.

| Key | Action |
| --- | --- |
| W A S D / Mouse | Move / look |
| Shift | Run (he hears it) |
| C | Crouch |
| F | Flashlight (he sees it) |
| E | Use, hide, step out |
| Space (while hiding) | Hold your breath |
| Tab / Esc | Objective / pause |

`npm run build:hollowpark` rebuilds `dist/hollowpark.html`. Sources: `hollowpark/src/` (`world.js` map, walls, doors, collision, sight and navigation; `furnish.js` the house and park; `pbr.js` procedural materials; `organic.js` the creature's sculpted body; `monster.js` animation and AI; `events.js` story, scares and ending; `post.js` render pipeline; `main.js` loading, menus and loop; `audio.js` synthesised sound).

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
