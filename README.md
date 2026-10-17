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

**Play:** open `dist/offal.html` (one self-contained file), or run `npm start` and go to `http://localhost:8080/offal/`. Play with headphones and the lights off. It needs a keyboard and mouse. It goes fullscreen on your first click; **F11** or the Fullscreen setting turns it on and off. Alt+Tab works in fullscreen too, and switching away pauses the shift.

**Music:** the heavy drone plays on the menu and under the death screen, always at its own pitch. On the floors it sits far back under a soft pad and a music box, and during a chase it drops out for your heartbeat.

**Performance:** press **F3** to see frames per second and draw calls. When a floor loads, everything on it that never moves is merged into a few large meshes, which cuts draw calls by about 5 to 15 times. On a laptop with two GPUs, set Microsoft Edge (which the launcher uses) to *High performance* in Windows Settings > System > Display > Graphics so it runs on the graphics card.

**Windows launcher (small):** `npm run launcher:win` builds `offal-launcher/OFFAL.exe` (about 2 MB, needs Go). The game is embedded in the launcher. It opens the game in its own window using the Edge that comes with Windows, or Chrome, and saves to `%LOCALAPPDATA%\OFFAL`.

**If the game crashes the browser or the PC:** the launcher passes no graphics flags, so Edge decides what the graphics driver can safely do. Run **OFFAL-safe.exe** (the same launcher under another name), or `OFFAL.exe --safe`, to draw everything on the processor without touching the graphics driver. It's slower but safe, and the menu says when it's on. If a session ends without the game window ever closing (the PC went down mid-game), the launcher switches to safe graphics by itself from then on. `OFFAL.exe --gpu` switches back.

**Windows app (self-contained, about 85 MB, recommended):** `cd offal-desktop && npm ci && npm run dist:win` builds `offal-desktop/release/OFFAL-1.0.0-portable.exe` (run `npm run build:offal` in the repo root first). It's a real standalone app with its own copy of Chromium (Electron), so it doesn't use the browser on the PC. Nothing to install; saves go to `%APPDATA%\OFFAL`, and the first run brings over saves from the small launcher. F11 or Alt+Enter toggles fullscreen. It passes no graphics flags and clears its shader caches on every start. It reloads the game if the page crashes, and you resume exactly where you were. It always uses the graphics card; starting it with `--safe` draws the 3D on the processor instead. Only one copy runs at a time. The *OFFAL desktop app* GitHub Actions workflow builds the same file.

**Story mode (about 2.5 hours or more):** ten floors down to the bottom of the plant, and an ending.

1. On every floor, find the dead workers and hold **E** to cut the brass ID tags out of them. It's slow, but silent: he can't hear it on any difficulty.
2. From B2 on, most floors also have a job before the lift will move (B1 is just tags):
   - **No power:** search body bags for fuses and slot them into the fuse box.
   - **Sealed shutter:** part of the floor is shut off. The code is scrawled in blood on the walls; type it into the keypad. A wrong code sets off an alarm.
   - **Jammed counterweight:** cuts of meat hang around the floor, tagged in kilograms. You can carry two. Make the freight scale by the lift read the exact weight.
   - **Steam on the brake:** find the release order, then turn the hissing valves in it. The wrong valve vents everything, loudly.
   - **Drain the sump** (the drains): open three sluice gates (hold **E**). Until they're open the tunnels are knee deep, wading is slow, and every step splashes loudly.
   - **Management only** (administration): search the managers' desks for the keycard. Every desk rattles.
   - **The cage key** (the deep freeze): cut open the plastic-wrapped carcasses until you find the key. One of them isn't meat. The cold also slows how fast you get your breath back.
   - **Workers on ice** (morgue floors): an intake log lists which freezer drawers hold the missing workers (bank and number, like C-7). Look at the drawer and hold **E** to pull it out. The wrong drawer holds somebody else, it moves, and it slams shut loudly.
3. Feed the tags to the lift, pull the lever and survive the three seconds while the gate grinds shut.
4. B10, *The Line*, is the finale: pull three kill switches to stop the line, then run for the lift with both of them hunting you.

**Crouchways:** low crawl tunnels with hazard-striped frames and plastic strips over the mouth. Every dead-end room and corridor gets one out the back, and each floor has a few more as escape routes. Press **C** to crouch and crawl in (you can't get in standing, or stand up inside). The Foreman can't fit, can't see you in there and ignores what he hears from them: crawl in mid-chase and he gives up and walks off to the far side of the floor. Hold **Q** and the red arrow will route you through them.

**Kinds of floor.** Each has its own layout, surfaces, furniture, light and job:

| Floor | Kind | Layout | What it looks like |
| --- | --- | --- | --- |
| B1, B2, B5, B9, B10 | The meatworks | Rooms joined by narrow corridors | Tiled kill rooms, meat on rails, butcher tables, the pit |
| B3 | Hospital wing (morgue) | Long two-tile halls with rows of rooms off them, joined by stairwell passages | Small white tiles over green paint, chequered lino, drop ceilings with missing panels; wards with beds, curtains and drips; autopsy rooms with instrument carts, sinks and specimen jars; records rooms; freezer rooms of body drawers |
| B4 | The drains | Ragged, winding tunnels between cisterns and pump rooms | Victorian brick with a slime line, cobbles, dark water you wade through, pipes, outflows, ladders, and his nest of bones and rags |
| B6 | Administration | Big open-plan offices of cubicles, joined by two-tile corridors | Wallpaper over wood panelling, carpet tiles, drop ceilings; desks with dead terminals, meeting rooms, a break room with a glowing vending machine, copier rooms, whiteboards (the headcount is going down) |
| B7 | The processing line | Big production halls joined by wide aisles, with packing, mincing and wash-down rooms off them | Painted blockwork with a green dado and a black-and-yellow guard band, red resin floors with yellow walkway lines and drains, exposed steel ceilings, sodium light; rows of conveyors with meat still on them and gaps to cut through, band saws, carcasses on the overhead rail, a mincer with an arm going in, packing tables of film-wrapped cuts, troughs, hoses and rubber aprons on pegs |
| B8 | Deep freeze | A few huge rooms joined by wide aisles | Frosted insulated panels, painted floors, rows of pallet racking with boxes and shrink-wrapped meat, forklifts, coolers with icicles, people frozen standing up |

Overtime mixes all six kinds at random from B2.

**The tannoy:** on every story floor the PA has a line of its own, plus another when the last tag is cut and he's sent after you. It gets stranger the deeper you go.

**Difficulty** is picked when you start a story or an Overtime run:

| | The Foreman's sprint | Noise | When you die |
| --- | --- | --- | --- |
| Easy | Much slower than yours: you can outrun him | Walking, crouching, lockers and puzzle work are silent; running is quieter | Same floor, from its start |
| Normal | A little slower than yours | Everything that makes noise makes noise | Same floor, from its start |
| Hard | A little faster than yours | Footsteps, lockers and machinery carry further | One floor back, from its start |
| Extreme | Faster than yours, even with a syringe | Everything carries much further | Back to B1 |

He doesn't only run faster on the harder settings. He also hesitates less when he first spots you, swings sooner and from further away, and keeps coming after a miss. On every setting he now runs straight at you in a chase instead of slowing for corners, and on Extreme a miss doesn't slow him down at all.

When he gets you, he crosses the last few steps in an eighth of a second. The view punches in on his face, his jaw opens past where a jaw should stop, his head rattles, and the screen strobes white, red and black under a shriek.

The dead are people: jointed bodies with grey, slack faces (half-closed eyes, jaws hanging open), hands and boots. They lie where they fell with their arms out, chests opened to the ribs and lungs, and their bowels heaped in coils beside them with a liver or a stomach. Blood pools are uneven and nearly black where they're deep, with a thinner red film at the edges, clots, runs and a wet sheen; spatter throws stretched droplets away from where it hit. The same body hangs from the hooks, lies in the morgue drawers, and plays you in the death scenes.

A death that would send you to B1 (dying on B1 itself, Hard from B2, or any Extreme death) ends the shift: the next one starts fresh, with a new layout.

**Dev mode:** a checkbox under the four difficulty cards. With it on, every floor starts complete (every worker's tag is already in the lift and every puzzle is solved; you just pull the lever), a DEV MODE badge shows in the corner, and **~** (the key under Esc) opens a dev menu with these options:
- walk through walls
- make the Foreman unable to see or hear you
- whether floors start complete
- complete this floor now (tags and puzzles)

It stays on until you untick it.

**Saving:** the game saves the exact moment you leave. That happens when you pause, quit, close the window or switch away, plus every few seconds. It covers where you're standing and looking, the tags you carry, which bodies are cut (and how far), every puzzle's progress, pickups, battery, stamina, where the Foreman is, and the clock. **Continue** puts you back exactly there. On easy and normal, a story floor also keeps its layout after a death, so what you learned still helps. Hold **Q** to listen: the flies get louder and a red arrow shows the way through the maze to the next body, puzzle piece, or the lift. A single line at the top always says the one thing to do next (CUT THE TAGS 0/3). **TAB** opens the floor's task sheet: every step in order, ticked off as you go, with the optional ones underneath. What you carry sits in **five boxes along the bottom of the screen**: each box holds one kind of thing (tags, syringes, the bolt gun or its parts, fuses, cuts of meat, a keycard, a key), and as many of it as you like. With five kinds already in hand there's no room for a sixth. On the first floors a shift briefing explains each thing as it comes up.

**Overtime:** the endless version. Floors are random, puzzles are random from B2, and where a death sends you depends on the difficulty. Your deepest floor goes on your time card.

**The chase:** chase music kicks in the moment he spots you (a 160 bpm industrial pulse, a bass line that never resolves, sawing strings) and your heartbeat gets louder and faster the closer he is, chase or not. He follows sounds while he hunts, but if he goes **15 seconds** without seeing you he gives up, searches a while and goes back to his rounds. He works out his route on a half-metre grid that knows where every table, gurney and locker is, so he goes round furniture instead of getting stuck on it.

**Lockers:** getting in or out is a short camera move, not a cut, and your own locker door is never muffled. Holding your breath lasts about 20 s on Easy, 12.5 s on Normal, 7.7 s on Hard and 6.7 s on Extreme.

**The bolt gun:** three parts of a captive-bolt gun (the barrel, the firing spring, the grip) turn up one per floor from B2 until you have them all. The last part makes it go together in your hands; until then the parts share one box on the HUD. Bolts are scarce: a box or two per floor once you have most of the gun, at most 6 carried. **Left click** fires; a hit drops the Foreman to his knees for **20 s on Easy, 15 on Normal, 10 on Hard, 5 on Extreme**, then he comes looking. Firing is the loudest thing you can do. A story shift keeps what you carry from floor to floor (as it was at the start of the floor you're on).

**Keepsakes and the Collection:** each floor has a keepsake or two lying about: a photo, a ring, a tape, a toy, a tooth. They do nothing for you; each is a few lines about somebody who worked there. There are 26, kept for good once found. Picking one up puts it in your hands as a 3D model: drag to turn it over, scroll to look closer, and press **E** or **Esc** to pocket it. **Collection** on the menu shows the keepsakes you've found (pick one to turn it over again) and lets you watch any death scene you've seen again, and the ending.

**The ending:** a film. The lift climbs the last floors with light sliding past the gate, the gate goes up on dawn in the loading bay, you walk out toward the open door, then stop and turn round. He is standing in the lift, in the dark, watching you go. He doesn't follow. You walk out into the white.

**Dying:** one hit from his hook kills you. He grabs you, and then one of six deaths plays at random (the third-person ones keep blood off the screen, since the camera isn't you):
- strung up over a fire pit (real-looking fire: flickering tongues, glowing coals, charred logs, sparks and smoke)
- an EXIT door that opens onto a sheer drop
- the meat grinder (third person): he drags you across the floor by the ankle, hoists you over the hopper and drops you in
- the ceiling fan (third person): he holds you up by the throat under the blades, then shoves you into them
- the rack (third person): chained by the wrists and ankles to a winch table; he cranks until your arms and legs come away, one at a time
- eaten on the floor (third person)

A full stamina bar is about 9.5 seconds of sprinting, and it refills in about 6 seconds standing still. Syringes (**R**) give you a few seconds of running that never runs out.

**The Foreman** hunts by sound and by light:
- Running, puzzles and a gasping breath all carry. Cutting tags out is silent. Crouching is nearly silent.
- Crouched with the torch off, he can't see you unless he's right on top of you (about 2.5 m).
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
| F3 | Show frames per second |
| Tab | What you're carrying, and the bolt gun |
| Esc | Pause |
| ~ | Dev menu (dev mode only) |
| Drag, mouse wheel | Turn a keepsake or a page over, and look closer (E or Esc puts it away) |

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
