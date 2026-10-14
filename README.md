# Ember City

An open-world crime game with a full story mode, built on [three.js](https://threejs.org) (r160).

> Six years inside. One last night to settle everything.

## Play

**Desktop app (Windows):** run `EmberCity-2.4.0-portable.exe`. It needs no install and runs straight from a USB stick or Downloads. It uses the game's own window instead of a browser tab, asks for the laptop's high-performance graphics card, and isn't slowed down in the background. F11 or Alt+Enter toggles fullscreen.

The **Desktop app** GitHub Actions workflow builds the `.exe` on Windows and publishes it as a GitHub Release (Actions tab → *Desktop app* → *Run workflow*). Pushing a tag such as `v2.4.0` does the same.

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
src/gameplay/           player, combat, police, shops, casino, day cycle, Rosy, side jobs, empire, weather
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

## Side jobs (J)

Press **J** to open the jobs menu. Ride-share and delivery jobs keep coming until you quit. There are no side jobs during story missions.

| Job | How it works |
| --- | --- |
| Ember Ride | Ride-share in whatever car you're driving. Pick up the fare and get them to their address. Arriving fast and without dents earns a bigger tip. |
| Ember Eats | Collect an order from a restaurant and deliver it before the timer runs out, on foot or by car. |
| Street races | Four routes, each with a chequered start gantry. Drive up, pay the entry fee and race three rivals through the checkpoints. First place wins the prize and second gets the entry fee back. |
| Getaway driver | Park outside a store while a crew robs it. Then lose the cops and drop the crew at the hideout. The cut grows with your peak wanted level. |

## Your empire (P)

Press **P** for an overview of everything you own. It's saved separately for story mode and open world.

- **Properties:** seven businesses have FOR SALE signs. Each one fills its till every in-game day, up to three days' worth. Walk up to it to collect.

  | Property | Price | Earns per day | Perk |
  | --- | --- | --- | --- |
  | Surf Shack | $8,000 | $600 | |
  | Paws & Claws | $12,000 | $800 | Rosy's gear at half price |
  | Gas & Go | $15,000 | $1,000 | |
  | Chop Shop | $30,000 | $2,000 | 25% more for chopped cars |
  | The Furnace (nightclub) | $45,000 | $3,000 | |
  | Pier 9 Shipping | $60,000 | $4,000 | Dock security ignores you |
  | Ember Motors | $90,000 | $6,000 | Cars 30% off |

- **Gang turf:** the city is split into 18 turfs, shown in colour on the map. Downtown is yours. The rest belong to Los Vipers, the Harbor Kings, the Foundry Boys and the Heights Syndicate, whose members hang out on street corners.
  - **Warnings:** hang around their corner and they tell you to leave. Shoot near them and they open fire.
  - **Gang war:** kill three of a gang's members on their turf to start one. Survive three waves and the turf is yours, plus $2,500. The cops stay out of gang wars.
  - **Holding turf:** your crew then guards the corner and shoots at anyone hostile. Every turf you hold pays $400 street tax at midnight.
  - **Counter-attacks:** while you're on your own turf, a rival gang sometimes tries to take it back. If you run or go down, they take it.
  - **Protection money:** a business on gang turf pays that gang 40% of its income until you take the turf.

## Weather

The weather changes every few in-game hours between clear, cloudy, rain, storm and fog. Clouds roll in and the light dims. Rain wets the roads, which makes cars slower to turn and stop, and pedestrians put up umbrellas. Storms add lightning and thunder. Fog pulls in the view distance. Story missions keep their own weather.

## Street life

- **Armed civilians:** about 1 in 10 pedestrians carries a gun. They fight back if you shoot near them, hit them, or kill someone close by.
- **Revenge:** killing a civilian (never a cop) has a 1-in-10 chance of starting a revenge hunt. A cutscene shows who you killed and their furious relative across town, who then tracks you down with a gun. They're marked with a skull on the map.
- **Arrests:** at 1–2 stars the police try to cuff you instead of shooting. If they hold on to you, you're **BUSTED**.
  - **Court:** hire a lawyer ($1,500), represent yourself, or bribe the judge ($4,000). Then answer the prosecutor's three questions.
  - **Verdict:** not guilty means you walk free from the courthouse steps (Midtown).
  - **Prison:** guilty means time in Ember State Penitentiary (Foundry). Serve the sentence (the state keeps 15% of your cash), or steal the wire cutters from the workshop toolbox and cut through the weak spot in the yard fence without the guards seeing you. A prison break starts you outside at 3 stars.
- **In the car:** when you drive, you can see yourself at the wheel and Rosy with her head out of the passenger window.

## Rosy

Rosy is your golden retriever and goes everywhere with you.
- **Following:** she trots at your side, rides along in any vehicle and follows you into buildings.
- **Waiting:** she waits at the bottom of ladders and the tower elevator.
- **Petting:** when you stand still she sits down; press E to pet her (+10 HP, once every 20 s).
- **Fighting:** she charges anyone fighting you (cops when you're wanted, armed civilians, revenge hunters, story enemies) and bites until they go down.
- **Wanted level:** she barks when your wanted level goes up.
- **Fetch:** press Q to throw her tennis ball. She chases it down and drops it at your feet.
- **Tricks:** press H for her menu. She starts out knowing Sit. Coach Dana at the Bark Park teaches Shake, Spin, Roll Over, Play Dead and Backflip. Passers-by sometimes tip a good trick.
- **Collars and outfits:** PAWS & CLAWS at the Bark Park sells collars (blue, pink, spiked, neon, gold) and outfits (bandana, sunglasses, party hat, raincoat, hero cape, golden crown). She wears them in the car too.
- **Bark Park:** a fenced dog park in Midtown with an agility course and five other dogs. Stand around for a while and Rosy runs off to play with them.
- **Saved:** her look, her tricks and her fetch count are remembered between sessions.
- **Invulnerable:** nothing can hurt her.
- **If you go down:** she lies down beside you and keeps watch until you're back on your feet.

## Graphics

Graphics quality is set from the Open World setup screen. It has four levels: Low, Medium, High and Ultra. High and Ultra use:

- a blocky-realistic look: ground and wall textures are painted in chunky pixel blocks that read clearly up close and blend smoothly into the distance, under realistic lighting
- physically based materials with soft normal and roughness maps, plus image-based lighting from a live environment cube
- night windows driven by a shader, with steady lit interiors (no flickering windows or twinkling stars)
- planar-reflection water with waves, foam and depth tint
- bloom, and ACES grading with god rays, MSAA and soft shadows
- interiors that switch to warm practical lighting and close off the sky

## Performance

- **Automatic starting quality:** on first launch the game picks Low on phones, Medium on 4-core or 4 GB machines, and High otherwise.
- **Adaptive resolution:** render resolution drops (to as low as 50%) when the frame rate falls, and recovers when there's headroom.
- **Anti-aliasing:** handled once, inside the post-processing chain, and the browser is asked for the high-performance GPU.
- **Throttled extras:** water reflections refresh every other frame on High (every frame on Ultra), and the reflection capture refreshes every 5–12 seconds.
- **No UI blur:** the HUD has no backdrop blur, and its text is rewritten only when it changes.
- **Batching:** static scenery merges into about 420 batches for the whole map. Facades use one material per style, with the colour stored in the geometry.
- **Lighter rendering:** no screen-space ambient occlusion or full-screen fog pass, and bloom runs at half resolution. Water reflects only the merged city, terrain and sky. Shadows are drawn once per frame instead of once per render pass.
- **No hitches:** the reflection cube is re-captured one face per frame instead of all six at once.
- **Stable image:** ground layers sit far enough apart that they don't flicker (z-fight) as the camera moves, and the sun's shadow map is snapped to whole texels so shadow edges don't crawl.
- **Level of detail:** cars past about 70 m draw as just body and glass, and pedestrians past about 170 m aren't drawn.
- **Fast collisions:** collision and line-of-sight checks use a 16 m spatial grid over the buildings.
- **Fewer per-frame updates:** object positions are updated once per frame instead of once per render pass.
- **FPS counter:** F3 shows frame rate and draw calls.

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
| J | Side jobs |
| P | Empire: properties and turf |
| H | Rosy menu |
| Q | Throw Rosy's ball |
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
