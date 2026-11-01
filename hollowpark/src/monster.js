// The thing that came up the rendering drain and learned the work.
import * as THREE from 'three';
import { G, T, rr, pick, clamp, angDiff, toTile, W3 } from './state.js';
import * as GO from './gore.js';
import * as AU from './audio.js';
import { buildCreature } from './organic.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildMonsterModel() { return buildCreature(); }

// procedural animation: gait from speed, plus the wrongness
export function animateModel(md, a, dt) {
  if (a.applied) { const { o, r } = a.applied; o.rotation.x -= r.x; o.rotation.y -= r.y; o.rotation.z -= r.z; a.applied = null; }
  const amp = clamp(a.speed / 1.6, 0, 1.6);
  a.phase += dt * (1.8 + a.speed * 1.55);
  const s = Math.sin(a.phase), c = Math.cos(a.phase);
  md.legs[0].hip.rotation.x = s * 0.55 * amp; md.legs[1].hip.rotation.x = -s * 0.55 * amp;
  md.legs[0].knee.rotation.x = Math.max(0, c) * 0.9 * amp; md.legs[1].knee.rotation.x = Math.max(0, -c) * 0.9 * amp;
  md.hips.position.y = 1.4 - Math.abs(s) * 0.07 * amp - (a.crouch || 0) * 0.4;
  md.hips.rotation.y = s * 0.12 * amp; md.hips.rotation.z = c * 0.05 * amp;
  md.spine.rotation.x = 0.5 + (a.lean || 0) + Math.sin(a.phase * 2) * 0.04 * amp + (a.crouch || 0) * 0.5;
  const reach = a.reach || 0;
  md.arms[0].sh.rotation.x = -s * 0.45 * amp - reach * 1.3; md.arms[1].sh.rotation.x = s * 0.45 * amp - reach * 1.1 + (a.raise || 0) * -2.6;
  md.arms[0].sh.rotation.z = -0.28 - reach * 0.2; md.arms[1].sh.rotation.z = 0.24 + reach * 0.2;
  md.arms[0].el.rotation.x = -0.55 - reach * 0.3; md.arms[1].el.rotation.x = -0.45 - reach * 0.2 - (a.raise || 0) * 0.8;
  // head: looks where it wants, tilts too far, snaps
  a.twitchT -= dt;
  if (a.twitchT < 0) { a.twitchT = rr(0.6, 4); a.twitch.set(rr(-0.5, 0.5), rr(-0.8, 0.8), rr(-0.9, 0.9)); if (Math.random() < 0.5) a.twitch.multiplyScalar(0.3); }
  const tx = (a.lookPitch || 0) + a.twitch.x * 0.6, ty = (a.lookYaw || 0) + a.twitch.y * 0.5, tz = a.twitch.z * 0.7 + (a.tilt || 0);
  const k = a.snappy ? 30 : 9;
  md.head.rotation.x += (tx - md.head.rotation.x) * Math.min(1, dt * k);
  md.head.rotation.y += (ty - md.head.rotation.y) * Math.min(1, dt * k);
  md.head.rotation.z += (tz - md.head.rotation.z) * Math.min(1, dt * k);
  md.neck.rotation.x = -0.55 + (a.neckFwd || 0);
  const jawT = (a.jawOpen ?? 0.06) + Math.max(0, Math.sin(G.time * 13)) * 0.03;
  md.jaw.rotation.x += (jawT - md.jaw.rotation.x) * Math.min(1, dt * 12);
  // glitch: one limb jerks to an impossible angle for a few frames
  a.glitchT -= dt;
  if (a.glitchT < 0 && !a.glitch) { a.glitch = { o: pick([md.arms[0].sh, md.arms[1].el, md.head, md.spine, md.arms[0].el]), r: V(rr(-1.2, 1.2), rr(-1.2, 1.2), rr(-1.2, 1.2)), t: rr(0.06, 0.18) }; a.glitchT = rr(1.5, 6); }
  if (a.glitch) { const g = a.glitch; g.o.rotation.x += g.r.x; g.o.rotation.y += g.r.y; g.o.rotation.z += g.r.z; a.applied = { o: g.o, r: g.r }; g.t -= dt; if (g.t < 0) a.glitch = null; }
  return s;
}
export function newAnim() { return { phase: 0, speed: 0, twitchT: 1, twitch: V(0, 0, 0), glitchT: 3, glitch: null, jawOpen: 0.06 }; }

// =====================================================================
export function createMonster(scene, L) {
  const md = buildMonsterModel(); scene.add(md.root); md.root.visible = false;
  const anim = newAnim();
  const M = {
    md, anim, active: false, state: 'off', pos: V(0, 0, 0), yaw: 0, path: null, pi: 0, speed: 0, awareness: 0,
    lastKnown: V(0, 0, 0), lostT: 0, timer: 0, searchCenter: V(0, 0, 0), voiceT: 3, repathT: 0, canSee: false, seenT: 0,
    lockerTarget: null, checked: new Set(), retreat: false, lastNearT: 0, lastStep: 0, scripted: false, hearAcc: 0, wpLast: -1, sinceChase: 99, distToPlayer: 99,
  };
  G.monster = M;
  const eye = () => V(M.pos.x, 2.3, M.pos.z);
  const player = () => G.player;
  const muffled = () => !L.los(eye(), G.camera.position);

  M.spawn = (p, state = 'patrol') => {
    M.active = true; md.root.visible = true; M.pos.copy(p); M.state = state; M.path = null; M.awareness = 0; M.speed = 0; M.timer = rr(1, 3);
    M.checked.clear(); M.lockerTarget = null; M.retreat = false;
  };
  M.despawn = () => { M.active = false; md.root.visible = false; M.state = 'off'; };
  M.goTo = (p, state, speed) => { M.path = L.path(M.pos, p); M.pi = 0; M.state = state; M.moveSpeed = speed; return !!M.path; };

  function pickWaypoint() {
    const wps = L.waypoints.map((p, i) => ({ p, i })).filter(o => o.i !== M.wpLast && L.path(M.pos, o.p));
    if (!wps.length) return null;
    const pp = player().pos;
    let choice;
    if (M.retreat) { wps.sort((a, b) => b.p.distanceTo(pp) - a.p.distanceTo(pp)); choice = pick(wps.slice(0, 3)); M.retreat = false; }
    else if (Math.random() < (G.time - M.lastNearT > 45 ? 0.75 : 0.45)) { wps.sort((a, b) => a.p.distanceTo(pp) - b.p.distanceTo(pp)); choice = pick(wps.slice(0, 3)); }
    else choice = pick(wps);
    M.wpLast = choice.i; return choice.p;
  }
  M.hear = (p, radius) => {
    if (!M.active || M.scripted || M.state === 'chase' || M.state === 'rip' || M.state === 'kill') return;
    const d = M.pos.distanceTo(p), eff = L.los(eye(), V(p.x, 1.5, p.z)) ? radius : radius * 0.65;
    if (d > eff) return;
    const pl = player();
    if (pl.hidden && pl.locker && p.distanceTo(pl.locker.pos) < 2 && d < 4) { M.startRip(pl.locker, 'breath'); return; }
    M.searchCenter.copy(p); M.awareness = Math.max(M.awareness, 0.35);
    if (M.goTo(p, 'investigate', 2.3)) { if (Math.random() < 0.6) AU.monsterClicks(M.pos, muffled(), 0.5); }
  };
  M.startChase = () => {
    if (M.state === 'chase') return;
    M.state = 'chase'; M.lostT = 0; M.repathT = 0; M.awareness = 1.5; M.sinceChase = 0;
    AU.monsterScream(eye(), 0.9, muffled()); G.fear = Math.max(G.fear, 0.95); G.shake = Math.max(G.shake, 0.3);
    G.onChaseStart?.();
  };
  M.startRip = (lk, reason = 'seen') => { M.ripReason = reason; M.lockerTarget = lk; M.goTo(lk.front, 'rip', 4.4); if (!M.path) { M.path = []; } };

  function follow(dt, speed) {
    if (!M.path || M.pi >= M.path.length) return true;
    const tgt = M.path[M.pi], dx = tgt.x - M.pos.x, dz = tgt.z - M.pos.z, d = Math.hypot(dx, dz);
    // doors ahead: it doesn't knock
    const door = L.doorBetween(M.pos, tgt);
    if (door && Math.abs(door.target) < 0.1 && door.pos.distanceTo(V(M.pos.x, 1.2, M.pos.z)) < 2.4) { door.open(M.pos, true); G.noise?.(door.pos, 0); G.shake = Math.max(G.shake, muffled() ? 0.03 : 0.12); }
    if (d < 0.35) { M.pi++; return M.pi >= M.path.length; }
    move(dx / d, dz / d, speed, dt);
    return false;
  }
  function move(nx, nz, speed, dt) {
    M.speed += (speed - M.speed) * Math.min(1, dt * 4);
    M.pos.x += nx * M.speed * dt; M.pos.z += nz * M.speed * dt;
    const want = Math.atan2(nx, nz); M.yaw += angDiff(M.yaw, want) * Math.min(1, dt * 6);
  }
  function faceTo(p, dt, k = 5) { const want = Math.atan2(p.x - M.pos.x, p.z - M.pos.z); M.yaw += angDiff(M.yaw, want) * Math.min(1, dt * k); }

  function perceive(dt) {
    const pl = player(), pp = pl.pos;
    const dx = pp.x - M.pos.x, dz = pp.z - M.pos.z, dist = Math.hypot(dx, dz);
    M.distToPlayer = dist;
    if (dist < 14) M.lastNearT = G.time;
    M.canSee = false;
    if (pl.hidden || G.state !== 'play') { M.awareness = Math.max(0, M.awareness - dt * 0.2); return; }
    let vis = 0.35 + (pl.flashOn ? 0.5 : 0) + (L.litAt(pp) ? 0.4 : 0) + (pl.sprinting ? 0.25 : 0);
    if (pl.crouching) vis *= 0.55;
    const range = 3.5 + 22 * vis;
    const ang = Math.abs(angDiff(M.yaw, Math.atan2(dx, dz)));
    const fov = dist < 2.6 ? Math.PI : 1.15;
    if (dist < range && ang < fov && L.los(eye(), G.camera.position)) {
      M.canSee = true;
      M.awareness += dt * ((1 - dist / range) * 1.9 + 0.35) * (M.state === 'search' || M.state === 'investigate' ? 2 : 1);
    } else M.awareness = Math.max(0, M.awareness - dt * 0.12);
    // your torch in its face
    if (pl.flashOn && dist < 20) {
      const f = new THREE.Vector3(); G.camera.getWorldDirection(f);
      const to = V(M.pos.x - G.camera.position.x, 1.9 - G.camera.position.y, M.pos.z - G.camera.position.z).normalize();
      if (f.dot(to) > 0.93 && L.los(eye(), G.camera.position)) M.awareness += dt * 2.5;
    }
    if (dist < 1.6) M.awareness += dt * 5;
    if (M.awareness >= 1 && M.state !== 'chase' && M.state !== 'rip') M.startChase();
  }

  M.update = (dt) => {
    if (!M.active) return;
    M.sinceChase += dt;
    const pl = player();
    if (!M.scripted && G.state === 'play') perceive(dt);
    const pp = pl.pos;
    let speedTarget = 0;
    switch (M.state) {
      case 'idle': {
        M.timer -= dt; M.speed *= 0.9; anim.lookYaw = Math.sin(G.time * 0.7) * 0.8;
        if (M.timer < 0) { const wp = pickWaypoint(); if (wp) M.goTo(wp, 'patrol', 1.3); else M.timer = 2; }
        break;
      }
      case 'patrol': case 'investigate': {
        anim.lookYaw = M.state === 'investigate' ? Math.sin(G.time * 1.6) * 0.5 : 0;
        if (follow(dt, M.moveSpeed || 1.3)) {
          if (M.state === 'investigate') { M.state = 'search'; M.timer = rr(10, 16); M.checked.clear(); M.subT = 0; }
          else { M.state = 'idle'; M.timer = rr(1.5, 5); }
        }
        break;
      }
      case 'search': {
        M.timer -= dt; M.subT -= dt;
        anim.lookYaw = Math.sin(G.time * 2.2) * 0.9;
        // lockers nearby? it remembers how people hide
        if (pl.hidden && pl.locker && !M.checked.has(pl.locker) && pl.locker.pos.distanceTo(M.pos) < 8) {
          M.checked.add(pl.locker);
          if (Math.random() < 0.6) { M.lockerTarget = pl.locker; M.goTo(pl.locker.front, 'lockerGo', 1.6); break; }
        }
        if (!M.path || M.pi >= M.path.length) { if (M.subT < 0) { M.goTo(L.randomFloorNear(M.searchCenter, 3), 'search', 1.6); M.subT = rr(1.5, 3.5); } else M.speed *= 0.9; }
        else follow(dt, 1.6);
        if (M.timer < 0) { M.retreat = true; const wp = pickWaypoint(); if (wp) M.goTo(wp, 'patrol', 1.5); else M.state = 'idle'; }
        break;
      }
      case 'lockerGo': {
        if (follow(dt, 1.6)) { M.state = 'sniff'; M.timer = 5.5; M.hearAcc = 0; M.sniffT = 0; AU.monsterBreath(eye(), false, 0.5); }
        break;
      }
      case 'sniff': {
        const lk = M.lockerTarget; faceTo(lk.pos, dt, 8); M.speed *= 0.8; M.timer -= dt; M.sniffT -= dt;
        anim.neckFwd = 0.85; anim.lookPitch = 0.45; anim.tilt = Math.sin(G.time * 1.3) * 0.7; anim.crouch = Math.min(0.75, (anim.crouch || 0) + dt * 0.6);
        if (M.sniffT < 0) { AU.sniff(V(lk.pos.x, 1.8, lk.pos.z), 0.6); M.sniffT = rr(0.8, 1.6); }
        if (pl.hidden && pl.locker === lk && M.timer < 5.0) {
          if (!AU.A.holding) M.hearAcc += dt; else M.hearAcc = Math.max(0, M.hearAcc - dt * 0.3);
          if (M.hearAcc > 0.55) { M.startRip(lk, 'breath'); break; }
        }
        if (M.timer < 0) { anim.neckFwd = 0; anim.lookPitch = 0; anim.tilt = 0; anim.crouch = 0; M.retreat = true; const wp = pickWaypoint(); if (wp) M.goTo(wp, 'patrol', 1.4); else M.state = 'idle'; }
        break;
      }
      case 'rip': {
        const lk = M.lockerTarget, df = Math.hypot(lk.front.x - M.pos.x, lk.front.z - M.pos.z);
        // no route (or route finished short): close the last stretch directly
        const done = (M.path && M.pi < M.path.length) ? follow(dt, 4.4) : true;
        if (done && df > 0.7) { move((lk.front.x - M.pos.x) / df, (lk.front.z - M.pos.z) / df, 4.4, dt); }
        else if (df <= 0.7 || done) {
          faceTo(lk.pos, dt, 20); M.speed = 0; anim.reach = 1;
          lk.doorTarget = 2.4; AU.metalHit(lk.pos, 0.9, false, 200); AU.thud(lk.pos, 1);
          M.state = 'kill'; G.killPlayer?.('locker');
        }
        break;
      }
      case 'chase': {
        anim.lookYaw = 0; anim.neckFwd = 0.2; anim.reach = 0.5;
        if (M.canSee) { M.lastKnown.copy(pp); M.lostT = 0; }
        else { M.lostT += dt; if (M.lostT < 1.6 && !pl.hidden) M.lastKnown.copy(pp); }
        if (pl.hidden && pl.locker && M.lostT < 0.6) { M.startRip(pl.locker); break; }
        const dist = Math.hypot(pp.x - M.pos.x, pp.z - M.pos.z);
        const sp = 4.35 + (dist > 15 ? 0.6 : 0);
        if (M.canSee && dist < 7) { const dx = pp.x - M.pos.x, dz = pp.z - M.pos.z; move(dx / dist, dz / dist, sp, dt); }
        else {
          M.repathT -= dt;
          if (M.repathT < 0 || !M.path) { M.path = L.path(M.pos, M.lastKnown); M.pi = 0; M.repathT = 0.35; }
          if (follow(dt, sp) && !M.canSee) { M.state = 'search'; M.searchCenter.copy(M.lastKnown); M.timer = rr(12, 18); M.subT = 0; M.checked.clear(); M.awareness = 0.4; G.onChaseEnd?.(); }
        }
        if (M.lostT > 7) { M.state = 'search'; M.searchCenter.copy(M.lastKnown); M.timer = rr(10, 15); M.subT = 0; M.checked.clear(); M.awareness = 0.3; G.onChaseEnd?.(); }
        if (dist < 1.05 && !pl.hidden && G.state === 'play') { M.state = 'kill'; G.killPlayer?.('caught'); }
        break;
      }
      case 'kill': case 'script': case 'off': break;
    }
    if (M.state !== 'chase' && M.state !== 'rip') anim.reach = Math.max(0, (anim.reach || 0) - dt * 2);
    anim.lean = M.state === 'chase' ? 0.35 : 0;
    anim.jawOpen = M.state === 'chase' ? 0.75 : M.state === 'sniff' ? 0.3 : 0.06;
    anim.snappy = M.state === 'chase' || M.state === 'sniff';
    // looking at you when it can see you
    if (M.canSee && M.state !== 'chase') { const want = Math.atan2(pp.x - M.pos.x, pp.z - M.pos.z); anim.lookYaw = clamp(angDiff(M.yaw, want), -1.2, 1.2); }
    anim.speed = M.speed;
    if (M.state !== 'script' && M.state !== 'kill') {
      md.root.position.copy(M.pos); md.root.rotation.y = M.yaw;
      const s = animateModel(md, anim, dt);
      if (Math.sign(s) !== Math.sign(M.lastStep) && M.speed > 0.4) AU.monsterStep(M.pos, muffled(), M.state === 'chase' ? 1.2 : 0.8);
      M.lastStep = s;
    }
    // voice
    M.voiceT -= dt;
    if (M.voiceT < 0 && M.state !== 'off' && M.state !== 'kill') {
      const muf = muffled();
      if (M.state === 'chase') { AU.monsterBreath(eye(), muf, 0.8); if (Math.random() < 0.25) AU.monsterScream(eye(), 0.5, muf); M.voiceT = rr(1, 2.2); }
      else { (Math.random() < 0.5 ? AU.monsterBreath : AU.monsterClicks)(eye(), muf, 0.55); M.voiceT = rr(3, 7); }
    }
  };
  return M;
}
