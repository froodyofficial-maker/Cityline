import { system, world } from "@minecraft/server";
import { ClickTracker, IDLE_HIDE_MS, formatCps, nextMode, MODES } from "./cps.js";

const MODE_PROPERTY = "cps:mode";
const trackers = new Map(); // player id -> ClickTracker

function trackerFor(player) {
  let tracker = trackers.get(player.id);
  if (!tracker) {
    tracker = new ClickTracker();
    trackers.set(player.id, tracker);
  }
  return tracker;
}

function getMode(player) {
  const mode = player.getDynamicProperty(MODE_PROPERTY);
  return MODES.includes(mode) ? mode : "auto";
}

function setMode(player, mode) {
  player.setDynamicProperty(MODE_PROPERTY, mode);
}

function recordClick(entity) {
  if (entity?.typeId !== "minecraft:player") return;
  trackerFor(entity).click(Date.now());
}

// A left click on a mob/player or on a block counts as one click.
world.afterEvents.entityHitEntity.subscribe((event) => recordClick(event.damagingEntity));
world.afterEvents.entityHitBlock.subscribe((event) => recordClick(event.damagingEntity));

world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) event.player.sendMessage("§eCPS Counter §7- Made by ProMouser");
});

world.afterEvents.playerLeave.subscribe((event) => trackers.delete(event.playerId));

// Refresh the action bar (the text above the hotbar) 10 times a second.
system.runInterval(() => {
  const now = Date.now();
  for (const player of world.getAllPlayers()) {
    const mode = getMode(player);
    if (mode === "off") continue;
    const tracker = trackerFor(player);
    if (mode === "auto" && tracker.idleFor(now) > IDLE_HIDE_MS) continue;
    player.onScreenDisplay.setActionBar(formatCps(tracker.cps(now), tracker.best));
  }
}, 2);

// Commands:
//   /scriptevent cps:toggle          cycle auto -> always -> off
//   /scriptevent cps:mode <mode>     set auto, always or off
//   /scriptevent cps:reset           reset your best score
system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;

  switch (event.id) {
    case "cps:toggle": {
      const mode = nextMode(getMode(player));
      setMode(player, mode);
      player.sendMessage(`§eCPS counter: §f${mode}`);
      break;
    }
    case "cps:mode": {
      const mode = event.message.trim().toLowerCase();
      if (!MODES.includes(mode)) {
        player.sendMessage(`§cUse one of: ${MODES.join(", ")}`);
        return;
      }
      setMode(player, mode);
      player.sendMessage(`§eCPS counter: §f${mode}`);
      break;
    }
    case "cps:reset":
      trackerFor(player).reset();
      player.sendMessage("§eCPS best score reset.");
      break;
  }
});
