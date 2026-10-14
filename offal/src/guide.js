// Telling you where to go without holding your hand: an objective line that always says what's next,
// Q to listen (the flies swell up and a red arrow shows the way through the maze), and a shift briefing
// that teaches each mechanic the first time it matters.
import { findPath, lineOfSight, tileCenter } from './level.js';
import * as UI from './ui.js';

const BRIEF = {
  start: 'Your shift has started. Somewhere on this floor are dead workers with brass ID tags inside them. The lift will not move without their tags.\n\nHold Q to listen. The flies get louder, and the red arrow shows the way to the nearest body.',
  near: 'That’s one of them. Look at the body and hold E to cut the tag out.\n\nIt takes a few seconds and it is loud. He will hear it.',
  quiet: 'Keep moving. Crouch (C) to stay quiet. Running is the loudest thing you can do.\n\nHe sees the torch: switch it off (F) when he’s near. If you hear metal dragging on concrete, that’s him patrolling.',
  close: 'HE’S CLOSE.\n\nBreak his line of sight first, then get into a locker (E). When he comes near, hold SPACE to hold your breath. If he watches you climb in, it will not save you.',
  back: 'That’s every tag. Hold Q: the arrow now points back to the lift.\n\nWalk in, feed the panel (E), then pull the lever.',
  lever: 'Pull the lever and the gate comes down. It takes three seconds, and everything on this floor hears it.\n\nIf he gets in before it closes, he’s in the lift with you.',
};

export class Guide {
  constructor(G) {
    this.G = G;
    this.shown = new Set();
    this.reset();
  }

  newRun() { this.shown.clear(); this.reset(); }

  reset() {
    this.pathT = 0;
    this.way = null;
    this.dist = 0;
    this.briefT = 0;
    this.objKey = '';
    UI.$('brief').classList.remove('on');
    UI.$('compass').classList.remove('on');
  }

  brief(id) {
    if (!this.G.hints || this.shown.has(id)) return;
    this.shown.add(id);
    UI.$('brief').classList.add('on');
    UI.typewrite(UI.$('briefText'), BRIEF[id], 90);
    this.briefT = id === 'start' ? 22 : 14;
    this.G.audio.chime();
  }

  // the shortest walk to any of the goals
  route(goals) {
    const { L, player: pl } = this.G;
    let best = null;
    for (const g of goals) {
      const path = findPath(L, pl.pos.x, pl.pos.z, g.x, g.z);
      if (!path) continue;
      let len = 0, px = pl.pos.x, pz = pl.pos.z;
      for (const p of path) { len += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
      len += Math.hypot(g.x - px, g.z - pz);
      if (!best || len < best.len) best = { path, len, goal: g };
    }
    return best;
  }

  update(dt) {
    const G = this.G, pl = G.player, B = G.B, L = G.L;
    const have = pl.tags, fed = B.lift.inserted, need = G.D.tags, all = have + fed >= need;
    const lift = { x: tileCenter(L.alcove.x), z: tileCenter(L.alcove.y) };

    // listening
    const compass = UI.$('compass');
    if (G.listening) {
      this.pathT -= dt;
      if (this.pathT <= 0) {
        this.pathT = 0.35;
        const goals = all ? [lift] : B.corpses.filter((c) => !c.harvested).map((c) => ({ x: c.pos.x, z: c.pos.z }));
        const r = this.route(goals);
        this.way = r;
      }
      const r = this.way;
      if (r) {
        // aim at the furthest waypoint you can actually see, so the arrow leads round corners
        let wp = r.goal;
        if (r.len > 2.5 && r.path.length) {
          wp = r.path[0];
          for (let i = Math.min(r.path.length - 1, 5); i >= 0; i--) if (lineOfSight(L, pl.pos.x, pl.pos.z, r.path[i].x, r.path[i].z)) { wp = r.path[i]; break; }
        }
        const dx = wp.x - pl.pos.x, dz = wp.z - pl.pos.z;
        const fx = -Math.sin(pl.yaw), fz = -Math.cos(pl.yaw), rx = Math.cos(pl.yaw), rz = -Math.sin(pl.yaw);
        const a = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
        UI.$('needle').style.transform = `rotate(${a}rad)`;
        UI.$('compassD').textContent = `${all ? 'THE LIFT' : 'A BODY'} · ${Math.max(1, Math.round(r.len))} M`;
        compass.classList.add('on');
      }
    } else compass.classList.remove('on');

    // the objective line
    let obj;
    const phase = G.lift.phase;
    if (phase === 'closing' || phase === 'sealed') obj = '<b>HOLD ON</b>';
    else if (phase === 'opening') obj = 'THE GATE IS OPENING';
    else if (fed >= need) obj = '<b>PULL THE LEVER</b> IN THE LIFT';
    else if (all) obj = pl.inLift && have ? '<b>FEED THE TAGS</b> TO THE PANEL' : '<b>GET BACK TO THE LIFT</b>';
    else obj = `CUT THE TAGS OUT OF THE DEAD  <b>${have + fed} / ${need}</b>`;
    const sub = fed >= need || phase !== 'open' ? '' : `<small><kbd>Q</kbd> HOLD TO LISTEN FOR THE WAY</small>`;
    const key = obj + sub;
    if (key !== this.objKey) { this.objKey = key; UI.$('objective').innerHTML = obj + sub; }

    // the briefing
    if (G.depth === 1 && G.floorTime > 2.5) this.brief('start');
    if (this.shown.has('start') && !this.shown.has('near')) {
      if (B.corpses.some((c) => !c.harvested && Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z) < 5)) this.brief('near');
    }
    if (G.runTags >= 1 && !all) this.brief('quiet');
    if (G.hunters.some((h) => h.state === 'chase' || (h.pos.distanceTo(pl.pos) < 13 && lineOfSight(L, h.pos.x, h.pos.z, pl.pos.x, pl.pos.z)))) this.brief('close');
    if (all && fed < need) this.brief('back');
    if (fed >= need && phase === 'open') this.brief('lever');
    if (this.briefT > 0) {
      this.briefT -= dt;
      if (this.briefT <= 0) UI.$('brief').classList.remove('on');
    }
  }
}
