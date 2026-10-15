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

## OFFAL (horror game)

The repo also holds **OFFAL**, a separate first-person horror game. You work the night shift at the Hollow Pines Meatworks, a slaughterhouse that goes down further than the plans say.

**Play:** open `dist/offal.html` (one self-contained file), or run `npm start` and go to `http://localhost:8080/offal/`. Play with headphones and the lights off. It needs a keyboard and mouse.

**Windows launcher (small):** `npm run launcher:win` builds `offal-launcher/OFFAL.exe` (about 2 MB, needs Go). The game is embedded in the launcher. It opens the game in its own window using the Edge that comes with Windows, or Chrome, and saves to `%LOCALAPPDATA%\OFFAL`.

**Windows app (self-contained, about 80 MB):** `cd offal-desktop && npm ci && npm run dist:win` builds `offal-desktop/release/OFFAL-1.0.0-portable.exe` (run `npm run build:offal` in the repo root first). It needs no install. F11 or Alt+Enter toggles fullscreen. The *OFFAL desktop app* GitHub Actions workflow builds the same file.

**Story mode (about 2.5 hours or more):** ten floors down to the bottom of the plant, and an ending.
1. On every floor, find the dead workers and hold **E** to cut the brass ID tags out of them. It's slow and loud.
2. Most floors also have a job before the lift will move:
   - **No power:** search body bags for fuses and slot them into the fuse box.
   - **Sealed shutter:** part of the floor is shut off. The code is scrawled in blood on the walls; type it into the keypad. A wrong code sets off an alarm.
   - **Jammed counterweight:** cuts of meat hang around the floor, tagged in kilograms. You can carry two. Make the freight scale by the lift read the exact weight.
   - **Steam on the brake:** find the release order, then turn the hissing valves in it. The wrong valve vents everything, loudly.
   - **Workers on ice** (morgue floors): an intake log lists which freezer drawers hold the missing workers (bank and number, like C-7). Look at the drawer and hold **E** to pull it out. The wrong drawer holds somebody else, it moves, and it slams shut loudly.
3. Feed the tags to the lift, pull the lever and survive the three seconds while the gate grinds shut.
4. B10, *The Line*, is the finale: pull three kill switches to stop the line, then run for the lift with both of them hunting you.

**Morgue floors** (B3 *The Morgue* and B7 *The Cold Room*, and sometimes in Overtime) are cold and blue: glazed tile walls with frost, freezer rooms lined with banks of body drawers (some hanging open), and autopsy tables.

**Difficulty** is picked when you start a story or an Overtime run:

| | The Foreman's sprint | Noise | When you die |
| --- | --- | --- | --- |
| Easy | Much slower than yours: you can outrun him | Walking, crouching, lockers and puzzle work are silent; cutting and running are quieter | Same floor, from its start |
| Normal | A little slower than yours | Everything that makes noise makes noise | Same floor, from its start |
| Hard | A little faster than yours | Footsteps, cutting, lockers and machinery carry further | One floor back, from its start |
| Extreme | Faster than yours, even with a syringe | Everything carries much further | Back to B1 |

**Saving:** the game saves the exact moment you leave. That happens when you pause, quit, close the window or switch away, plus every few seconds. It covers where you're standing and looking, the tags you carry, which bodies are cut (and how far), every puzzle's progress, pickups, battery, stamina, where the Foreman is, and the clock. **Continue** puts you back exactly there. On easy and normal, a story floor also keeps its layout after a death, so what you learned still helps. Hold **Q** to listen: the flies get louder and a red arrow shows the way through the maze to the next body, puzzle piece, or the lift. An objective line at the top always says what's next, and on the first floors a shift briefing explains each thing as it comes up.

**Overtime:** the endless version. Floors are random, puzzles are random from B2, and where a death sends you depends on the difficulty. Your deepest floor goes on your time card.

**Dying:** one hit from his hook kills you. He grabs you, and then one of five deaths plays at random:
- strung up over a fire pit
- an EXIT door that opens onto a sheer drop
- the meat grinder (third person)
- the ceiling fan
- eaten on the floor (third person)

Syringes (**R**) give you a few seconds of running that never runs out.

**The Foreman** hunts by sound and by light:
- Running, cutting, puzzles and a gasping breath all carry. Crouching is nearly silent.
- Shining your torch in his face gives you away.
- If you hear the hook dragging, he's patrolling. If it goes quiet, he's running, and all you'll hear is your heart.
- Hide in lockers. If he comes close, hold **Space** to hold your breath. If he watched you climb in, he will open it.
- He searches where he lost you and checks the lockers nearby.

From B5 there are two of him.

Everything is procedural: textures, models and gore are painted and built in code, and all sound is synthesised with Web Audio, positional and with HRTF. The scene renders at low resolution through a grading pass that keeps only blood saturated, with dithering, grain and a vignette that closes in as he gets close.

| Key | Action |
| --- | --- |
| W A S D | Move |
| Shift | Run (loud) |
| C | Crouch on/off (quiet) |
| F | Torch on/off (the battery drains) |
| E | Use: cut, search, take, read, hide, turn, pull a drawer, feed the lift, pull the lever |
| Space | Hold your breath (in a locker); skip a death scene |
| Q (hold) | Listen: show the way to whatever is next |
| R | Use a syringe (sprint without running out) |
| 0–9, Enter | Type a code at a keypad |
| F11 | Fullscreen |
| Esc | Pause |

Source is in `offal/` (ES modules on the vendored three.js). `npm run build:offal` writes `dist/offal.html`.

## Build

```bash
npm install          # one dev dependency: esbuild
npm run build        # -> dist/ember-city.html (three.js, game, CSS, fonts and icon inlined)
npm run build:offal  # -> dist/offal.html (the horror game, same idea)
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
