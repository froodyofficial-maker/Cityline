// Telling you where to go without holding your hand: an objective line that always says what's next,
// Q to listen (the flies swell up and a red arrow shows the way through the maze), and a shift briefing
// that teaches each mechanic and each puzzle the first time it matters.
import { findPath, lineOfSight, tileCenter } from './level.js';
import * as UI from './ui.js';

const BRIEF = {
  start: 'Your shift has started. Somewhere on this floor are dead workers with brass ID tags inside them. The lift will not move without their tags.\n\nHold Q to listen. The flies get louder, and the red arrow shows the way to whatever you need next.',
  adrenaline: 'One hit from the hook kills you.\n\nIf you find a syringe, press R to use it: a few seconds of running that never runs out of breath.',
  near: 'That’s one of them. Look at the body and hold E to cut the tag out.\n\nIt takes a few seconds and it is loud. He will hear it.',
  quiet: 'Keep moving. Crouch (C) to stay quiet. Running is the loudest thing you can do.\n\nHe sees the torch: switch it off (F) when he’s near. If you hear metal dragging on concrete, that’s him patrolling.',
  close: 'HE’S CLOSE.\n\nBreak his line of sight first, then get into a locker (E). When he comes near, hold SPACE to hold your breath. If he watches you climb in, it will not save you.',
  back: 'That’s every tag. Hold Q: the arrow points to whatever is still stopping the lift, or to the lift itself.\n\nWalk in, feed the panel (E), then pull the lever.',
  lever: 'Pull the lever and the gate comes down. It takes three seconds, and everything on this floor hears it.\n\nIf he gets in before it closes, he’s in the lift with you.',
  fuses: 'This floor has no power, and the lift won’t run without it.\n\nThe fuses were hidden in the body bags. Search the bags (hold E), then slot the fuses into the fuse box. Q shows the way.',
  keypad: 'A steel shutter seals off part of this floor, and some of the dead are behind it.\n\nThe workers scrawled the code on the walls before he got them. Find all four numbers, then type them into the keypad by the shutter. A wrong code sets off an alarm.',
  scale: 'The lift’s counterweight is jammed. The freight scale beside the lift has to read an exact weight.\n\nCuts of meat hang around the floor, each tagged in kilograms. You can carry two at a time. Work out which ones add up exactly.',
  valves: 'Steam pressure has locked the lift’s brake. Somewhere on this floor is a note with the release order.\n\nFind it, then turn the hissing valves in exactly that order. The wrong valve vents everything, very loudly.',
  drawers: 'This is the morgue. Some of the missing workers were filed away in the freezer banks.\n\nFind the intake log, then pull out the drawers it lists (look straight at the drawer and hold E). Leave every other drawer shut. Not everything in them is finished.',
  breakers: 'This is the bottom. The line is still running.\n\nPull the three kill switches to stop it. The first one sets off the alarm. When the line stops, both of them will come for you. Get back to the lift and go UP.',
};

export class Guide {
  constructor(G) {
    this.G = G;
    this.shown = new Set();
    this.reset();
  }

  newRun() { this.shown.clear(); this.reset(); }

  reset() {
    this.queue = [];
    this.pathT = 0;
    this.way = null;
    this.briefT = 0;
    this.objKey = '';
    UI.$('brief').classList.remove('on');
    UI.$('compass').classList.remove('on');
  }

  brief(id) {
    if (!this.G.hints || this.shown.has(id)) return;
    this.shown.add(id);
    if (this.briefT > 0) { this.queue.push(id); return; }
    this.showBrief(id);
  }
  showBrief(id) {
    if (!BRIEF[id]) return;
    UI.$('brief').classList.add('on');
    UI.typewrite(UI.$('briefText'), BRIEF[id], 90);
    this.briefT = id === 'start' ? 20 : 15;
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
    const G = this.G, pl = G.player, B = G.B, L = G.L, pz = G.puzzles;
    const have = pl.tags, fed = B.lift.inserted, need = G.D.tags, all = have + fed >= need;
    const blocker = pz.blocker(), done = all && !blocker;
    const lift = { x: tileCenter(L.alcove.x), z: tileCenter(L.alcove.y) };

    // listening
    const compass = UI.$('compass');
    if (G.listening) {
      this.pathT -= dt;
      if (this.pathT <= 0) {
        this.pathT = 0.35;
        let goals = done ? [lift] : [...(all ? [] : B.corpses.filter((c) => !c.harvested).map((c) => c.pos)), ...pz.goals()];
        if (have > 0 && all) goals.push(lift); // bank what you're carrying
        if (!goals.length) goals = [lift];
        this.way = this.route(goals);
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
        const what = r.goal === lift ? 'THE LIFT' : B.corpses.some((c) => c.pos === r.goal) ? 'A BODY' : 'THE JOB';
        UI.$('compassD').textContent = `${what} · ${Math.max(1, Math.round(r.len))} M`;
        compass.classList.add('on');
      }
    } else compass.classList.remove('on');

    // the objective line
    let obj;
    const phase = G.lift.phase;
    if (phase === 'closing' || phase === 'sealed') obj = '<b>HOLD ON</b>';
    else if (phase === 'opening') obj = 'THE GATE IS OPENING';
    else if (G.D.finale && !blocker) obj = '<b>GET TO THE LIFT. GO UP.</b>';
    else if (!blocker && fed >= need) obj = '<b>PULL THE LEVER</b> IN THE LIFT';
    else if (!blocker && all) obj = pl.inLift ? '<b>FEED THE TAGS</b> TO THE PANEL' : '<b>GET BACK TO THE LIFT</b>';
    else if (!all) obj = `CUT THE TAGS OUT OF THE DEAD  <b>${have + fed} / ${need}</b>`;
    else obj = blocker.title();
    const extra = pz.lines();
    if (all && have && blocker) extra.unshift('FEED YOUR TAGS TO THE LIFT');
    const sub = phase !== 'open' ? '' : `<small>${extra.length ? extra.join(' · ') + ' · ' : ''}<kbd>Q</kbd> LISTEN FOR THE WAY</small>`;
    const key = obj + sub;
    if (key !== this.objKey) { this.objKey = key; UI.$('objective').innerHTML = obj + sub; }

    // the briefing
    if (G.depth === 1 && G.floorTime > 2.5) this.brief('start');
    if (G.depth === 1 && G.floorTime > 3) this.brief('adrenaline');
    if (G.floorTime > 3) for (const p of pz.list) this.brief(p.kind);
    if (this.shown.has('start') && !this.shown.has('near')) {
      if (B.corpses.some((c) => !c.harvested && Math.hypot(c.pos.x - pl.pos.x, c.pos.z - pl.pos.z) < 5)) this.brief('near');
    }
    if (G.runTags >= 1 && !all) this.brief('quiet');
    if (G.hunters.some((h) => h.state === 'chase' || (h.pos.distanceTo(pl.pos) < 13 && lineOfSight(L, h.pos.x, h.pos.z, pl.pos.x, pl.pos.z)))) this.brief('close');
    if (all && fed < need && need > 0) this.brief('back');
    if (fed >= need && !blocker && phase === 'open' && !G.D.finale) this.brief('lever');
    if (this.briefT > 0) {
      this.briefT -= dt;
      if (this.briefT <= 0) {
        UI.$('brief').classList.remove('on');
        if (this.queue.length) setTimeout(() => { if (this.G.state === 'play' && this.queue.length && this.briefT <= 0) this.showBrief(this.queue.shift()); }, 600);
      }
    }
  }
}
