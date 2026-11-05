# CPS Counter for Minecraft Education

Made by ProMouser.

A behavior pack (add-on) that shows your **clicks per second** above the hotbar:

```
CPS: 7 | Best: 11
```

The number changes colour as you speed up: green under 4, yellow from 4, gold from 8, red from 12. "Best" is your highest CPS since you joined the world.

You can also see **everyone else's CPS**:

- **Sidebar**: a live list of every player's CPS on the right of the screen, fastest first.
- **Under names**: each player's CPS appears under their name tag.
- **`/scriptevent cps:list`**: prints everyone's CPS and best score in chat.

## Install

1. Download `CPS-Counter.mcpack`.
2. Double-click it (or open it with Minecraft Education). Minecraft imports it and shows "Successfully imported".
3. Create or edit a world, go to **Behavior Packs**, and activate **CPS Counter**.
4. Play. The counter shows up as soon as you start clicking.

In a hosted world, the **host** turns the pack on for the world. Everyone who joins gets it automatically.

If double-clicking doesn't work (for example on a locked school computer), rename the file to `.zip`, unzip it, and copy the folder into
`%LOCALAPPDATA%\Packages\Microsoft.MinecraftEducationEdition_8wekyb3d8bbwe\LocalState\games\com.mojang\behavior_packs\`.
Then activate it on the world as in step 3.

Needs Minecraft Education 26.32 or newer. It uses only the stable script API, so no experiments have to be turned on.

## What counts as a click

Every left click counts: on empty air, on mobs, on players and on blocks. Holding the button down to mine doesn't count as extra clicks.

## Commands

These need cheats on for the world.

| Command | What it does |
|---|---|
| `/scriptevent cps:toggle` | Cycle your own counter between `auto`, `always` and `off` |
| `/scriptevent cps:mode auto` | Show your counter while you click, hide it 2 seconds after you stop (default) |
| `/scriptevent cps:mode always` | Always show your counter |
| `/scriptevent cps:mode off` | Hide your counter |
| `/scriptevent cps:reset` | Reset your best score |
| `/scriptevent cps:list` | Everyone's CPS and best score in chat |
| `/scriptevent cps:sidebar on` / `off` | Show or hide the sidebar for the whole world (on by default) |
| `/scriptevent cps:belowname on` / `off` | Show or hide CPS under names for the whole world (on by default) |

Your counter mode is saved per player. The sidebar and under-name settings are saved with the world. The sidebar replaces any other scoreboard the world shows there, so turn it off if your world uses the sidebar for something else.

## Build from source

```bash
./build.sh
```

This zips `behavior_pack/` into `CPS-Counter.mcpack`.
