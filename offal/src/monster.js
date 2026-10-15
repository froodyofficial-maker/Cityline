// The Foreman: a flayed, too-tall thing in a butcher's apron, wearing a stitched face, dragging a meat hook.
// It hunts by sound and by light, searches where it lost you, and opens lockers.
import * as THREE from 'three';
import { limb, mesh } from './props.js';
import { lineOfSight, findPath, collide, randomFloorNear } from './level.js';

const V = new THREE.Vector3();

export function createForemanMesh(mats) {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 1.18;
  root.add(hips);
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = limb(mats.flesh, 0.55, 0.075);
    thigh.position.x = s * 0.13;
    const knee = limb(mats.flesh, 0.56, 0.055);
    knee.position.y = -0.62;
    thigh.add(knee);
    const foot = mesh(new THREE.BoxGeometry(0.1, 0.05, 0.24), mats.darkMetal);
    foot.position.set(0, -0.62, 0.06);
    knee.add(foot);
    hips.add(thigh);
    legs.push({ thigh, knee });
  }
  const torso = new THREE.Group();
  torso.position.y = 0.05;
  hips.add(torso);
  const chest = mesh(new THREE.CapsuleGeometry(0.2, 0.55, 3, 10), mats.flesh);
  chest.scale.set(1.15, 1, 0.72);
  chest.position.y = 0.42;
  torso.add(chest);
  for (let i = 0; i < 5; i++) {
    const rib = mesh(new THREE.TorusGeometry(0.17 - i * 0.008, 0.012, 4, 10, Math.PI), mats.bone, false);
    rib.position.set(0, 0.62 - i * 0.075, 0.07);
    rib.rotation.x = Math.PI / 2 + 0.25;
    rib.rotation.z = Math.PI;
    torso.add(rib);
  }
  const spine = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), mats.bone, false);
  spine.position.set(0, 0.45, -0.15);
  torso.add(spine);
  const apron = mesh(new THREE.BoxGeometry(0.52, 1.15, 0.02), mats.apron);
  apron.position.set(0, 0.1, 0.17);
  torso.add(apron);
  for (const s of [-1, 1]) { // apron straps
    const st = mesh(new THREE.BoxGeometry(0.03, 0.4, 0.02), mats.apron, false);
    st.position.set(s * 0.12, 0.78, 0.12);
    st.rotation.x = -0.3;
    torso.add(st);
  }
  // neck and the stitched face
  const neck = new THREE.Group();
  neck.position.set(0, 0.8, 0.02);
  torso.add(neck);
  const neckM = mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.26, 6), mats.flesh);
  neckM.position.y = 0.12;
  neck.add(neckM);
  const head = new THREE.Group();
  head.position.set(0, 0.28, 0.03);
  neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.17, 14, 10), mats.mask);
  skull.scale.set(0.82, 1.18, 0.9);
  head.add(skull);
  const eyes = [];
  for (const s of [-1, 1]) {
    const hole = mesh(new THREE.SphereGeometry(0.038, 8, 6), mats.black, false);
    hole.scale.z = 0.45;
    hole.position.set(s * 0.055, 0.05, 0.135);
    head.add(hole);
    const pupil = mesh(new THREE.SphereGeometry(0.011, 6, 4), mats.eye, false);
    pupil.position.set(s * 0.055, 0.05, 0.152);
    head.add(pupil);
    eyes.push(pupil);
  }
  // the mouth is cut much wider than a mouth should be
  const mouth = mesh(new THREE.BoxGeometry(0.2, 0.1, 0.05), mats.black, false);
  mouth.position.set(0, -0.09, 0.11);
  head.add(mouth);
  const teeth = (y, down, group) => {
    const gum = mesh(new THREE.BoxGeometry(0.2, 0.025, 0.035), mats.meat, false);
    gum.position.set(0, y + (down ? 0.012 : -0.012), 0.13);
    group.add(gum);
    for (let i = 0; i < 13; i++) {
      const a = (i / 12 - 0.5) * 1.7;
      const len = 0.03 + Math.random() * 0.045;
      const t = mesh(new THREE.ConeGeometry(0.007 + Math.random() * 0.006, len, 4), mats.tooth, false);
      t.position.set(Math.sin(a) * 0.095, y - (down ? len / 2 : -len / 2), Math.cos(a) * 0.06 + 0.085);
      t.rotation.set(down ? Math.PI : 0, Math.random() * 3, (Math.random() - 0.5) * 0.5);
      group.add(t);
    }
  };
  teeth(-0.045, true, head);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.08, 0.02);
  head.add(jaw);
  const jawM = mesh(new THREE.BoxGeometry(0.2, 0.035, 0.16), mats.flesh);
  jawM.position.set(0, -0.045, 0.06);
  jaw.add(jawM);
  teeth(-0.03, false, jaw);
  // arms, much too long
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = limb(mats.flesh, 0.6, 0.05);
    sh.position.set(s * 0.3, 0.7, 0);
    const el = limb(mats.flesh, 0.62, 0.042);
    el.position.y = -0.66;
    sh.add(el);
    const hand = new THREE.Group();
    hand.position.y = -0.7;
    el.add(hand);
    const palm = mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), mats.flesh);
    hand.add(palm);
    for (let f = 0; f < 3; f++) {
      const finger = mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.2, 4), mats.flesh, false);
      finger.position.set((f - 1) * 0.025, -0.14, 0.01);
      finger.rotation.x = 0.25;
      hand.add(finger);
    }
    torso.add(sh);
    arms.push({ sh, el, hand });
  }
  // right hand: the hook; left hand: a cleaver
  const hook = new THREE.Group();
  const curve = mesh(new THREE.TorusGeometry(0.13, 0.016, 5, 14, Math.PI * 1.35), mats.steel);
  curve.position.y = -0.25;
  curve.rotation.z = Math.PI * 0.85;
  const shaft = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.25, 5), mats.steel);
  shaft.position.y = -0.1;
  const grip = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), mats.apron);
  hook.add(curve, shaft, grip);
  hook.position.y = -0.05;
  arms[1].hand.add(hook);
  const cleaverG = new THREE.Group();
  const blade = mesh(new THREE.BoxGeometry(0.01, 0.3, 0.16), mats.steel);
  blade.position.set(0, -0.2, 0.06);
  cleaverG.add(blade);
  arms[0].hand.add(cleaverG);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, hips, torso, neck, head, jaw, legs, arms, eyes, hook };
}

// pose the body; `t` is time, `gait` the walk phase, `mode` one of walk/chase/attack/idle/grab
export function poseForeman(f, s) {
  const { gait, speed, mode, t, swing = 0, jawOpen = 0, twitch } = s;
  const stride = Math.min(1, speed / 2.2);
  const run = mode === 'chase';
  const sinP = Math.sin(gait);
  f.hips.position.y = 1.18 + Math.abs(Math.cos(gait)) * 0.05 * stride - (run ? 0.08 : 0);
  f.hips.rotation.y = sinP * 0.12 * stride;
  f.legs.forEach((l, i) => {
    const p = gait + i * Math.PI;
    l.thigh.rotation.x = Math.sin(p) * (run ? 0.75 : 0.45) * stride - (run ? 0.15 : 0);
    l.knee.rotation.x = Math.max(0, Math.cos(p)) * (run ? 1.2 : 0.7) * stride + 0.08;
  });
  const hunch = run ? 0.75 : mode === 'grab' ? 0.35 : 0.5;
  f.torso.rotation.x = hunch + Math.sin(t * 1.3) * 0.03;
  f.torso.rotation.z = Math.sin(gait) * 0.06 * stride;
  f.neck.rotation.x = -hunch * 0.7 + (twitch ? twitch.x : 0);
  f.head.rotation.set(twitch ? twitch.y : 0, twitch ? twitch.z : 0, twitch ? twitch.r : 0);
  f.jaw.rotation.x = 0.1 + jawOpen * 0.9;
  f.arms.forEach((a, i) => {
    const p = gait + (i ? 0 : Math.PI);
    let sh = -hunch + Math.sin(p) * 0.35 * stride;
    let el = -0.15 - Math.max(0, Math.sin(p)) * 0.3 * stride;
    let side = (i ? -1 : 1) * 0.12;
    if (run) { sh = -hunch - 0.9 + Math.sin(p) * 0.5; el = -0.5; side = (i ? -1 : 1) * 0.25; }
    if (mode === 'attack' && i === 1) { sh = -hunch - 2.6 + swing * 3.2; el = -0.6 + swing * 0.5; }
    if (mode === 'grab') { sh = -hunch - 1.35; el = -0.35; side = (i ? 1 : -1) * 0.2; }
    a.sh.rotation.set(sh, 0, side);
    a.el.rotation.x = el;
  });
}

// ---------- the AI ----------
export class Hunter {
  constructor(world, mats, pos, id) {
    this.w = world;
    this.id = id;
    this.body = createForemanMesh(mats);
    this.obj = this.body.root;
    this.pos = pos.clone();
    this.obj.position.copy(this.pos);
    this.yaw = Math.random() * 6;
    this.state = 'patrol';
    this.path = null;
    this.pathT = 0;
    this.target = null;
    this.awareness = 0;
    this.lastSeen = null;
    this.lostT = 0;
    this.stateT = 0;
    this.gait = 0;
    this.speed = 0;
    this.stepAcc = 0;
    this.twitch = { x: 0, y: 0, z: 0, r: 0 };
    this.twitchT = 1;
    this.sinceContact = 0;
    this.stuck = { t: 0, x: pos.x, z: pos.z };
    this.checked = new Set();
    this.lockerTarget = null;
    this.swing = 0;
    this.seesPlayer = false;
    this.voice = world.audio.monsterVoice();
    this.growlT = 3;
  }

  dispose() { this.voice.stop(); }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
    this.path = null;
    this.pathT = 0;
  }

  // anything loud: footsteps, cutting, a scream from a carcass
  hear(n) {
    if (this.state === 'chase' || this.state === 'attack' || this.state === 'recover' || this.state === 'locker' || this.state === 'grab') return;
    const d = this.pos.distanceTo(n.pos);
    const los = lineOfSight(this.w.L, this.pos.x, this.pos.z, n.pos.x, n.pos.z);
    const r = n.radius * this.w.D.hearing * (los ? 1 : 0.6);
    if (d > r) return;
    this.target = n.pos.clone();
    this.lastSeen = n.pos.clone();
    if (this.state === 'patrol') this.w.audio.sniff(this.pos);
    this.setState('investigate');
    this.awareness = Math.max(this.awareness, n.loud && d < r * 0.4 ? 0.7 : 0.3);
  }

  canSee() {
    const pl = this.w.player;
    if (pl.hidden || pl.inLift && this.w.liftSealed) return false;
    const dx = pl.pos.x - this.pos.x, dz = pl.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 26) return false;
    if (!lineOfSight(this.w.L, this.pos.x, this.pos.z, pl.pos.x, pl.pos.z)) return false;
    if (d < 2.2) return true;
    const facing = (Math.sin(this.yaw) * dx + Math.cos(this.yaw) * dz) / d;
    // the torch in its eyes gives you away from anywhere
    const lookAt = pl.lightOn && pl.facingDot(this.pos, 1.9) > 0.94 && d < 16;
    if (lookAt) return true;
    let vis = pl.lightOn ? 1 : 0.38;
    if (pl.crouch) vis *= 0.65;
    if (pl.lit) vis = Math.max(vis, 0.75);
    const range = 3 + 15 * vis;
    const cone = this.state === 'chase' ? -0.2 : 0.45;
    return facing > cone && d < range;
  }

  pathTo(target) {
    this.path = findPath(this.w.L, this.pos.x, this.pos.z, target.x, target.z);
    this.pathT = 0;
  }

  pickPatrol() {
    const L = this.w.L, pl = this.w.player;
    let t = null;
    // it always drifts back toward you eventually
    if (this.sinceContact > 35 || Math.random() < 0.3) t = randomFloorNear(L, pl.pos.x, pl.pos.z, 5);
    if (!t) { const r = L.rooms[1 + ((Math.random() * (L.rooms.length - 1)) | 0)]; t = randomFloorNear(L, (r.cx + 0.5) * 2, (r.cy + 0.5) * 2, 1); }
    this.target = t;
    if (t) this.pathTo(t);
  }

  update(dt, t) {
    const w = this.w, pl = w.player, L = w.L;
    this.stateT += dt;
    this.pathT += dt;
    this.sinceContact += dt;
    const toP = V.set(pl.pos.x - this.pos.x, 0, pl.pos.z - this.pos.z);
    const dP = toP.length();

    // perception
    const sees = this.state !== 'grab' && this.canSee();
    this.seesPlayer = sees;
    if (sees) {
      this.awareness += dt * (1.2 + 7 / (dP + 0.6)) * (pl.lightOn ? 1.4 : 1);
      this.lastSeen = pl.pos.clone();
      this.lastVel = pl.vel.clone();
      this.lostT = 0;
      this.sinceContact = 0;
    } else if (this.state !== 'chase') this.awareness = Math.max(0, this.awareness - dt * 0.2);
    if (this.awareness >= 1 && !['chase', 'attack', 'recover', 'locker', 'grab'].includes(this.state)) {
      this.setState('chase');
      w.audio.stinger();
      w.audio.roar(this.pos);
      w.onSpotted(this);
    } else if (sees && this.state === 'patrol' && this.awareness > 0.3) {
      this.target = pl.pos.clone();
      this.setState('alert');
      w.audio.sniff(this.pos);
    }

    let speed = 0, goal = null, turn = 3;
    const D = w.D;
    switch (this.state) {
      case 'patrol':
        speed = 1.25 * D.speedMul;
        if (!this.path || !this.path.length || this.pathT > 25) this.pickPatrol();
        break;
      case 'alert': // stops dead, head twitching toward you
        speed = 0;
        goal = this.target;
        turn = 2;
        if (this.stateT > 1.1) { this.setState('investigate'); }
        break;
      case 'investigate':
        speed = 2.5 * D.speedMul;
        if (!this.path || this.pathT > 2) this.pathTo(this.target);
        if (this.pos.distanceTo(this.target) < 1.2 || (this.path && !this.path.length)) this.setState('search');
        break;
      case 'search':
        speed = 1.7 * D.speedMul;
        if (this.stateT > 14) { this.setState('patrol'); this.awareness = 0; this.checked.clear(); break; }
        if (!this.path || !this.path.length) {
          // check a locker near where it lost you
          const near = w.B.lockers.filter((lk) => !this.checked.has(lk) && lk.pos.distanceTo(this.lastSeen || this.pos) < 7);
          if (near.length && Math.random() < 0.4) { this.lockerTarget = near[(Math.random() * near.length) | 0]; this.setState('locker'); break; }
          const c = this.lastSeen || this.pos;
          const tgt = randomFloorNear(L, c.x, c.z, 3);
          if (tgt) this.pathTo(tgt);
        }
        break;
      case 'chase': {
        speed = D.chaseSpeed;
        turn = 8;
        if (pl.hidden) {
          // it watched you climb in
          if (pl.hiddenSeenBy.has(this)) { this.lockerTarget = pl.hidden; this.setState('locker'); break; }
          this.setState('search');
          break;
        }
        if (pl.inLift && w.liftSealed) { this.setState('gate'); break; }
        if (!sees) {
          this.lostT += dt;
          if (this.lostT > 4) { this.setState('search'); break; }
        }
        let tgt = this.lastSeen || pl.pos;
        if (!sees && this.lastVel) tgt = tgt.clone().addScaledVector(this.lastVel, Math.min(this.lostT, 1.2));
        if (sees && dP < 7) { goal = pl.pos; this.path = null; } else if (!this.path || this.pathT > 0.35) this.pathTo(tgt);
        if (sees && dP < 1.55) { this.setState('attack'); w.audio.growl(this.pos, 1); }
        break;
      }
      case 'attack':
        goal = pl.pos;
        turn = 6;
        speed = 0.6;
        this.swing = Math.min(1, Math.max(0, (this.stateT - 0.42) / 0.14));
        if (this.stateT > 0.5 && !this.struck) {
          this.struck = true;
          if (dP < 2.1 && !pl.hidden && lineOfSight(L, this.pos.x, this.pos.z, pl.pos.x, pl.pos.z)) w.onHit(this);
          else w.audio.whoosh(this.pos);
        }
        if (this.stateT > 0.75) { this.struck = false; this.swing = 0; this.setState('recover'); }
        break;
      case 'recover': // a beat to let you run
        speed = 0;
        if (this.stateT > 1.1) this.setState('chase');
        break;
      case 'locker': {
        const lk = this.lockerTarget;
        const front = lk.pos.clone().addScaledVector(lk.facing, 0.9);
        speed = pl.hidden === lk && pl.hiddenSeenBy.has(this) ? D.chaseSpeed * 0.8 : 1.9 * D.speedMul;
        turn = 5;
        if (this.pos.distanceTo(front) > 0.5) {
          if (!this.path || this.pathT > 1) this.pathTo(front);
          if (this.path && !this.path.length) goal = front;
        } else {
          speed = 0;
          goal = lk.pos;
          if (!this.opening) { this.opening = true; this.openT = 0; w.audio.lockerOpen(lk.pos); }
          this.openT += dt;
          lk.target = 1;
          if (this.openT > 0.35 && pl.hidden === lk) { this.opening = false; this.setState('grab'); w.onGrab(this, lk); break; }
          if (this.openT > 1.6) {
            lk.target = 0;
            this.opening = false;
            this.checked.add(lk);
            this.lockerTarget = null;
            this.setState('search');
            this.stateT = 6;
          }
        }
        break;
      }
      case 'gate': // you made it in. it is not happy about that
        speed = 2.5;
        goal = w.B.lift.pos.clone().add(new THREE.Vector3(0, 0, -1.6));
        if (this.pos.distanceTo(goal) < 0.6) { speed = 0; goal = w.B.lift.pos; if (Math.random() < dt * 3) w.audio.gateRattle(w.B.lift.pos); }
        else if (!this.path || this.pathT > 1) this.pathTo(goal);
        break;
      case 'grab':
        speed = 0;
        break;
    }

    // steering
    if (!goal && this.path && this.path.length) {
      while (this.path.length > 1 && lineOfSight(L, this.pos.x, this.pos.z, this.path[1].x, this.path[1].z) && this.pos.distanceTo(this.path[0]) < 3) this.path.shift();
      goal = this.path[0];
      if (this.pos.distanceTo(goal) < 0.45) { this.path.shift(); goal = this.path[0] || null; }
    }
    let moveSpeed = 0;
    if (goal) {
      const dx = goal.x - this.pos.x, dz = goal.z - this.pos.z;
      if (Math.hypot(dx, dz) > 0.05) {
        const want = Math.atan2(dx, dz);
        let diff = ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.yaw += Math.max(-turn * dt, Math.min(turn * dt, diff));
        moveSpeed = speed * Math.max(0, Math.cos(diff));
      }
    }
    this.speed += (moveSpeed - this.speed) * Math.min(1, dt * 5);
    this.pos.x += Math.sin(this.yaw) * this.speed * dt;
    this.pos.z += Math.cos(this.yaw) * this.speed * dt;
    collide(L, w.B, this.pos, 0.34, true);

    // unstick
    this.stuck.t += dt;
    if (this.stuck.t > 1.5) {
      const moved = Math.hypot(this.pos.x - this.stuck.x, this.pos.z - this.stuck.z);
      if (moved < 0.15 && speed > 0.5) { this.path = null; if (this.state === 'patrol') this.pickPatrol(); }
      this.stuck = { t: 0, x: this.pos.x, z: this.pos.z };
    }

    // animation
    this.gait += dt * this.speed * 2.6;
    this.twitchT -= dt;
    if (this.twitchT < 0) {
      // the head snaps to odd angles, too fast
      const big = Math.random() < 0.3;
      this.twitch = { x: (Math.random() - 0.5) * (big ? 1.2 : 0.3), y: (Math.random() - 0.5) * 0.5, z: (Math.random() - 0.5) * (big ? 1.4 : 0.4), r: (Math.random() - 0.5) * (big ? 1.6 : 0.3) };
      this.twitchT = this.state === 'chase' ? 0.15 + Math.random() * 0.3 : 0.4 + Math.random() * 2.5;
      if (big && this.state !== 'chase' && dP < 14) w.audio.click(this.pos);
    }
    const mode = this.state === 'chase' ? 'chase' : this.state === 'attack' ? 'attack' : this.state === 'grab' ? 'grab' : 'walk';
    const jaw = this.state === 'chase' ? 0.35 + Math.sin(t * 9) * 0.25 : this.state === 'attack' ? 0.8 : 0.05;
    poseForeman(this.body, { gait: this.gait, speed: this.speed, mode, t, swing: this.swing, jawOpen: jaw, twitch: this.twitch });
    this.obj.position.copy(this.pos);
    this.obj.rotation.y = this.yaw;

    // sound: heavy steps, the hook dragging behind it, wet breathing
    this.stepAcc += this.speed * dt;
    const stride = this.state === 'chase' ? 1.1 : 0.85;
    if (this.stepAcc > stride) { this.stepAcc = 0; w.audio.thud(this.pos, this.state === 'chase' ? 1 : 0.6); }
    const occluded = !lineOfSight(L, this.pos.x, this.pos.z, pl.pos.x, pl.pos.z);
    this.voice.update(this.pos, {
      scrape: this.state === 'chase' ? 0 : Math.min(1, this.speed / 1.2) * (0.5 + Math.random() * 0.5),
      breath: this.state === 'chase' ? 1 : 0.55,
      growl: this.state === 'chase' ? 0.8 : this.state === 'gate' ? 0.6 : 0,
      occluded,
    });
    this.growlT -= dt;
    if (this.growlT < 0) {
      this.growlT = 5 + Math.random() * 9;
      if (this.state !== 'chase' && dP < 20) w.audio.growl(this.pos, 0.6);
    }
  }
}
