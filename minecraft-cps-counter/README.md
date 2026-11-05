# CPS Counter for Minecraft Education

Made by ProMouser.

A behavior pack (add-on) that shows your **clicks per second** above the hotbar:

```
CPS: 7 | Best: 11
```

The number changes colour as you speed up: green under 4, yellow from 4, gold from 8, red from 12. "Best" is your highest CPS since you joined the world.

## Install

1. Download `CPS-Counter.mcpack`.
2. Double-click it (or open it with Minecraft Education). Minecraft imports it and shows "Successfully imported".
3. Create or edit a world, go to **Behavior Packs**, and activate **CPS Counter**.
4. Play. The counter shows up as soon as you start clicking.

If double-clicking doesn't work (for example on a locked school computer), rename the file to `.zip`, unzip it, and copy the folder into
`%LOCALAPPDATA%\Packages\Microsoft.MinecraftEducationEdition_8wekyb3d8bbwe\LocalState\games\com.mojang\behavior_packs\`.
Then activate it on the world as in step 3.

Needs Minecraft Education 1.21 or newer. It uses only the stable script API, so no experiments have to be turned on.

## What counts as a click

Each left click that hits a mob, a player or a block counts. **Clicks on empty air don't count**, because Minecraft's script API doesn't report them. To test your CPS, click on a block or a mob.

## Commands

These need cheats on for the world.

| Command | What it does |
|---|---|
| `/scriptevent cps:toggle` | Cycle between `auto`, `always` and `off` |
| `/scriptevent cps:mode auto` | Show the counter while you click, hide it 2 seconds after you stop (default) |
| `/scriptevent cps:mode always` | Always show the counter |
| `/scriptevent cps:mode off` | Hide the counter |
| `/scriptevent cps:reset` | Reset your best score |

Each player's mode is saved with the world.

## Build from source

```bash
./build.sh
```

This zips `behavior_pack/` into `CPS-Counter.mcpack`.
