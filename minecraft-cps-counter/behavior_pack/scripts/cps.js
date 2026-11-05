// Click counting with no Minecraft imports, so it can be tested outside the game.

export const WINDOW_MS = 1000; // CPS = clicks in the last second
export const IDLE_HIDE_MS = 2000; // "auto" mode hides the counter this long after the last click

export class ClickTracker {
  constructor() {
    this.clicks = []; // timestamps (ms), oldest first
    this.best = 0;
    this.lastClick = -Infinity;
  }

  click(now) {
    this.clicks.push(now);
    this.lastClick = now;
    this.prune(now);
    if (this.clicks.length > this.best) this.best = this.clicks.length;
  }

  prune(now) {
    let drop = 0;
    while (drop < this.clicks.length && now - this.clicks[drop] >= WINDOW_MS) drop++;
    if (drop) this.clicks.splice(0, drop);
  }

  cps(now) {
    this.prune(now);
    return this.clicks.length;
  }

  idleFor(now) {
    return now - this.lastClick;
  }

  reset() {
    this.clicks = [];
    this.best = 0;
    this.lastClick = -Infinity;
  }
}

// Display modes, in the order cps:toggle cycles through them.
export const MODES = ["auto", "always", "off"];

export function nextMode(mode) {
  const i = MODES.indexOf(mode);
  return MODES[(i + 1) % MODES.length];
}

function colorFor(cps) {
  if (cps >= 12) return "§c"; // red
  if (cps >= 8) return "§6"; // gold
  if (cps >= 4) return "§e"; // yellow
  return "§a"; // green
}

export function formatCps(cps, best) {
  return `§lCPS: ${colorFor(cps)}${cps}§r §7| Best: §f${best}`;
}
