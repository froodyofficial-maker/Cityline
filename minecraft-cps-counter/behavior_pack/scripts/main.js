import { DisplaySlotId, ObjectiveSortOrder, system, world } from "@minecraft/server";
import { ClickTracker, IDLE_HIDE_MS, formatCps, nextMode, MODES } from "./cps.js";

const MODE_PROPERTY = "cps:mode"; // per player: auto / always / off
const SIDEBAR_PROPERTY = "cps:sidebar"; // per world: true / false
const BELOW_NAME_PROPERTY = "cps:belowname"; // per world: true / false
const OBJECTIVE_ID = "cps";

const trackers = new Map(); // player id -> ClickTracker
const lastClick = new Map(); // player id -> { tick, source }
const shownScores = new Map(); // player id -> last CPS written to the scoreboard

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

function worldFlag(property) {
  return world.getDynamicProperty(property) !== false; // on unless turned off
}

// One click can be reported twice: as an arm swing and as a block hit. Events from
// different sources within a tick of each other are treated as the same click.
function recordClick(player, source) {
  if (player?.typeId !== "minecraft:player") return;
  const tick = system.currentTick;
  const prev = lastClick.get(player.id);
  if (prev && prev.source !== source && tick - prev.tick <= 1) return;
  lastClick.set(player.id, { tick, source });
  trackerFor(player).click(Date.now());
}

// Every left click swings the arm, including clicks on empty air and on mobs/players.
// Holding the button to mine also swings ("Mine"); that isn't counted, so holding
// down doesn't inflate the number.
world.afterEvents.playerSwingStart.subscribe((event) => {
  if (event.swingSource === "Attack" || event.swingSource === "None") {
    recordClick(event.player, "swing");
  }
});

// A click on a block starts mining instead of attacking, so count the block hit.
world.afterEvents.entityHitBlock.subscribe((event) => recordClick(event.damagingEntity, "block"));

world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) event.player.sendMessage("§eCPS Counter §7- Made by ProMouser");
});

world.afterEvents.playerLeave.subscribe((event) => {
  trackers.delete(event.playerId);
  lastClick.delete(event.playerId);
  shownScores.delete(event.playerId);
});

// ---- Everyone's CPS: a scoreboard shown on the sidebar and under player names ----

function getObjective() {
  return world.scoreboard.getObjective(OBJECTIVE_ID) ?? world.scoreboard.addObjective(OBJECTIVE_ID, "§eCPS");
}

function slotShows(slot, objective) {
  return world.scoreboard.getObjectiveAtDisplaySlot(slot)?.objective?.id === objective.id;
}

function applyDisplaySlots() {
  const objective = getObjective();
  const slots = [
    [DisplaySlotId.Sidebar, worldFlag(SIDEBAR_PROPERTY)],
    [DisplaySlotId.BelowName, worldFlag(BELOW_NAME_PROPERTY)],
  ];
  for (const [slot, on] of slots) {
    const showing = slotShows(slot, objective);
    if (on && !showing) {
      world.scoreboard.setObjectiveAtDisplaySlot(slot, { objective, sortOrder: ObjectiveSortOrder.Descending });
    } else if (!on && showing) {
      world.scoreboard.clearObjectiveAtDisplaySlot(slot);
    }
  }
}

function updateScoreboard(players, now) {
  const objective = getObjective();
  for (const player of players) {
    const cps = trackerFor(player).cps(now);
    if (shownScores.get(player.id) !== cps) {
      objective.setScore(player, cps);
      shownScores.set(player.id, cps);
    }
  }
}

// Players who left stay on the scoreboard as offline entries; remove them.
function removeOfflinePlayers() {
  const objective = getObjective();
  for (const identity of objective.getParticipants()) {
    if (!identity.getEntity()) objective.removeParticipant(identity);
  }
}

// ---- Main loop: 10 times a second ----

system.runInterval(() => {
  const now = Date.now();
  const players = world.getAllPlayers();

  for (const player of players) {
    const mode = getMode(player);
    if (mode === "off") continue;
    const tracker = trackerFor(player);
    if (mode === "auto" && tracker.idleFor(now) > IDLE_HIDE_MS) continue;
    player.onScreenDisplay.setActionBar(formatCps(tracker.cps(now), tracker.best));
  }

  updateScoreboard(players, now);
  if (system.currentTick % 20 === 0) {
    applyDisplaySlots();
    removeOfflinePlayers();
  }
}, 2);

// ---- Commands (need cheats on) ----
//   /scriptevent cps:toggle            your counter: cycle auto -> always -> off
//   /scriptevent cps:mode <mode>       your counter: auto, always or off
//   /scriptevent cps:reset             reset your best score
//   /scriptevent cps:list              everyone's CPS and best score in chat
//   /scriptevent cps:sidebar <on|off>  everyone's CPS on the right of the screen
//   /scriptevent cps:belowname <on|off> CPS under each player's name

function parseOnOff(text) {
  const value = text.trim().toLowerCase();
  if (value === "on") return true;
  if (value === "off") return false;
  return undefined;
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;

  switch (event.id) {
    case "cps:toggle": {
      const mode = nextMode(getMode(player));
      player.setDynamicProperty(MODE_PROPERTY, mode);
      player.sendMessage(`§eCPS counter: §f${mode}`);
      break;
    }
    case "cps:mode": {
      const mode = event.message.trim().toLowerCase();
      if (!MODES.includes(mode)) {
        player.sendMessage(`§cUse one of: ${MODES.join(", ")}`);
        return;
      }
      player.setDynamicProperty(MODE_PROPERTY, mode);
      player.sendMessage(`§eCPS counter: §f${mode}`);
      break;
    }
    case "cps:reset":
      trackerFor(player).reset();
      player.sendMessage("§eCPS best score reset.");
      break;
    case "cps:list": {
      const now = Date.now();
      const rows = world
        .getAllPlayers()
        .map((p) => ({ name: p.name, cps: trackerFor(p).cps(now), best: trackerFor(p).best }))
        .sort((a, b) => b.best - a.best || b.cps - a.cps);
      player.sendMessage("§e--- CPS ---");
      for (const row of rows) player.sendMessage(`§f${row.name}§7: ${row.cps} CPS, best ${row.best}`);
      break;
    }
    case "cps:sidebar":
    case "cps:belowname": {
      const on = parseOnOff(event.message);
      if (on === undefined) {
        player.sendMessage(`§cUse: /scriptevent ${event.id} on   or   /scriptevent ${event.id} off`);
        return;
      }
      world.setDynamicProperty(event.id === "cps:sidebar" ? SIDEBAR_PROPERTY : BELOW_NAME_PROPERTY, on);
      applyDisplaySlots();
      const what = event.id === "cps:sidebar" ? "Sidebar" : "CPS under names";
      world.sendMessage(`§e${what}: §f${on ? "on" : "off"} §7(set by ${player.name})`);
      break;
    }
  }
});
