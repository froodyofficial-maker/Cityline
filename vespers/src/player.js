// You: Theo Vance. Up the Kessel Pass in a blizzard, looking for your brother.
import * as THREE from 'three';
import { G, T, clamp, damp, toTile } from './state.js';
import * as AU from './audio.js';
import { UI } from './ui.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const keys = {};
let mouseDX = 0, mouseDY = 0;
export function addMouse(dx, dy) { mouseDX += dx; mouseDY += dy; }

export function createPlayer(camera, L) {
  const P = {
    pos: V(0, 0, 0), yaw: 0, pitch: 0, vel: V(0, 0, 0), eye: 1.62, crouching: false, sprinting: false, stamina: 1, exhausted: false,
    hasFlashlight: false, flashOn: false, battery: 1, hidden: false, locker: null, breath: 1, bob: 0, stepAcc: 0, lockerAnim: 0,
    roll: 0, sens: 1, frozen: false, look: null, bestInteract: null, flicker: 0, lockerExitT: 0,
  };
  G.player = P;
  // flashlight: a real spot with shadows, mounted slightly right of the eye
  const spot = new THREE.SpotLight(0xfff1d6, 0, 30, 0.44, 0.6, 1.7);
  spot.castShadow = true; spot.shadow.mapSize.set(512, 512); spot.shadow.camera.near = 0.15; spot.shadow.camera.far = 26; spot.shadow.bias = -0.0008;
  spot.position.set(0.18, -0.15, 0.05); camera.add(spot);
  const tgt = new THREE.Object3D(); tgt.position.set(0.05, -0.05, -3); camera.add(tgt); spot.target = tgt;
  const fill = new THREE.PointLight(0xfff1d6, 0, 4, 2); fill.position.set(0, 0, -0.5); camera.add(fill);
  // the torch in your hand
  const torch = new THREE.Group(); torch.position.set(0.22, -0.22, -0.38); camera.add(torch);
  const tm = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.2, 8), tm); body.rotation.x = Math.PI / 2; torch.add(body);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); lens.position.z = -0.101; lens.rotation.y = Math.PI; torch.add(lens);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshLambertMaterial({ color: 0x8a6a5a })); hand.scale.set(1, 0.8, 1.6); hand.position.set(0, -0.02, 0.05); torch.add(hand);
  torch.visible = false; P.torch = torch; P.spot = spot; P.lens = lens;

  P.place = (p, yaw = 0) => { P.pos.copy(p); P.yaw = yaw; P.pitch = 0; P.vel.set(0, 0, 0); };
  P.setFlash = (on) => {
    if (!P.hasFlashlight) return;
    if (on && P.battery <= 0.001) { AU.click(0.15); return; }
    P.flashOn = on; AU.click(0.14);
  };
  P.enterLocker = (lk) => {
    if (P.hidden || G.state !== 'play') return;
    const M = G.monster;
    P.hidden = true; P.locker = lk; P.lockerAnim = 0; P.breath = Math.max(P.breath, 0.3);
    lk.doorTarget = 1.4; setTimeout(() => { lk.doorTarget = 0; AU.lockerSound(lk.pos, false); }, 450);
    setTimeout(() => { if (P.locker === lk) lk.door.visible = false; }, 650); // you look out through the slats (drawn by the post shader)
    AU.lockerSound(lk.pos, true);
    // seen getting in: it knows exactly where you are
    if (M?.active && M.canSee) { M.startRip(lk); }
    else G.noise?.(lk.pos, 3);
    P.yaw = lk.yaw + Math.PI; P.pitch = 0;
    P.fromPos = P.pos.clone();
  };
  P.exitLocker = () => {
    const lk = P.locker; if (!lk) return;
    lk.door.visible = true; lk.doorTarget = 1.4; AU.lockerSound(lk.pos, true); setTimeout(() => { lk.doorTarget = 0; }, 700);
    P.hidden = false; P.locker = null; AU.A.holding = false; P.pos.set(lk.front.x, 0, lk.front.z); P.lockerExitT = 0.4;
    G.noise?.(lk.pos, 4);
  };

  P.update = (dt) => {
    const M = G.monster;
    // ---- look ----
    if (!P.frozen) {
      P.yaw -= mouseDX * 0.0022 * P.sens; P.pitch -= mouseDY * 0.0022 * P.sens;
      P.pitch = clamp(P.pitch, -1.45, 1.45);
      if (P.hidden) { const base = P.locker.yaw + Math.PI; let d = P.yaw - base; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; d = clamp(d, -0.45, 0.45); P.yaw = base + d; P.pitch = clamp(P.pitch, -0.35, 0.3); }
    }
    mouseDX = mouseDY = 0;

    // ---- hidden in a locker ----
    if (P.hidden) {
      const lk = P.locker;
      P.lockerAnim = Math.min(1, P.lockerAnim + dt * 2.5);
      const holding = !!keys.Space && P.breath > 0;
      if (holding && !AU.A.holding) AU.click(0.03);
      if (!holding && AU.A.holding) { AU.gasp(P.breath < 0.05 ? 0.5 : 0.18); if (P.breath < 0.05) G.noise?.(lk.pos, 6); }
      AU.A.holding = holding;
      if (holding) { P.breath = Math.max(0, P.breath - dt / 7); G.distort = Math.max(G.distort, (1 - P.breath) * 0.6); }
      else P.breath = Math.min(1, P.breath + dt / 4);
      if (P.breath <= 0 && holding) { AU.A.holding = false; AU.gasp(0.55); G.noise?.(lk.pos, 7); keys.Space = false; }
      const ins = lk.inside;
      P.pos.lerpVectors(P.fromPos, V(ins.x, 0, ins.z), P.lockerAnim);
      AU.A.exertion = damp(AU.A.exertion, 0, 1, dt);
      P.sprinting = false;
    } else if (!P.frozen) {
      // ---- move ----
      P.crouching = !!keys.KeyC;
      const want = V(0, 0, 0);
      if (keys.KeyW) want.z -= 1; if (keys.KeyS) want.z += 1; if (keys.KeyA) want.x -= 1; if (keys.KeyD) want.x += 1;
      const moving = want.lengthSq() > 0;
      if (moving) want.normalize().applyAxisAngle(V(0, 1, 0), P.yaw);
      P.sprinting = moving && !!keys.ShiftLeft && !P.crouching && !P.exhausted && keys.KeyW;
      const speed = P.crouching ? 1.25 : P.sprinting ? 5.1 : 2.4;
      if (P.sprinting) { P.stamina -= dt / 5.5; if (P.stamina <= 0) { P.exhausted = true; P.stamina = 0; } }
      else { P.stamina = Math.min(1, P.stamina + dt / (P.exhausted ? 5 : 3.5)); if (P.stamina > 0.45) P.exhausted = false; }
      P.vel.x = damp(P.vel.x, want.x * speed, 10, dt); P.vel.z = damp(P.vel.z, want.z * speed, 10, dt);
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt;
      L.collide(P.pos, 0.3);
      const sp = Math.hypot(P.vel.x, P.vel.z);
      // footsteps + noise
      P.stepAcc += sp * dt;
      const stride = P.sprinting ? 1.5 : P.crouching ? 0.75 : 1.05;
      if (P.stepAcc > stride) {
        P.stepAcc = 0;
        const rid = L.roomAt(P.pos.x, P.pos.z), wet = rid === 'kill' || rid === 'render' || rid === 'shower';
        AU.footstep(P.sprinting ? 'run' : P.crouching ? 'crouch' : 'walk', wet && Math.random() < 0.5);
        G.noise?.(P.pos.clone(), P.sprinting ? 15 : P.crouching ? 1.2 : 4.5);
      }
      P.bob += sp * dt * (P.sprinting ? 1.6 : 2.1);
      AU.A.exertion = damp(AU.A.exertion, P.sprinting ? 1 : P.exhausted ? 0.9 : sp > 0.5 ? 0.25 : 0, 0.8, dt);
      AU.A.holding = false;
    }
    if (P.lockerExitT > 0) P.lockerExitT -= dt;

    // ---- flashlight ----
    if (P.hasFlashlight && P.flashOn) {
      P.battery = Math.max(0, P.battery - dt / 330);
      if (P.battery <= 0) { P.flashOn = false; AU.click(0.12); UI.subs('The torch dies.', 2.5); }
    }
    let fl = P.flashOn ? 1 : 0;
    if (P.flashOn) {
      const low = P.battery < 0.15;
      P.flicker -= dt;
      if (P.flicker < 0) P.flicker = Math.random() < (low ? 0.25 : 0.02) + (G.monster?.active && G.monster.distToPlayer < 9 ? 0.25 : 0) ? -0.4 + Math.random() * 0.35 : Math.random() * 0.3;
      if (P.flicker < -0.05 && P.flicker > -0.4) fl = Math.random() < 0.5 ? 0.05 : 0.4;
      fl *= low ? 0.45 + P.battery * 3 : 1;
    }
    if (P.hidden) fl = 0;
    spot.intensity = fl * 95; fill.intensity = P.hidden ? 1.5 : fl * 1.2; lens.material.color.setScalar(0.15 + fl * 0.85);
    torch.visible = P.hasFlashlight && !P.hidden;
    const sp2 = Math.hypot(P.vel.x, P.vel.z);
    torch.position.set(0.22 + Math.sin(P.bob) * 0.008 * sp2, -0.22 + Math.abs(Math.cos(P.bob)) * 0.01 * sp2, -0.38);

    // ---- camera ----
    P.eye = damp(P.eye, P.hidden ? 1.55 : P.crouching ? 1.0 : 1.62, 10, dt);
    const bobY = P.hidden ? 0 : Math.abs(Math.sin(P.bob)) * 0.045 * Math.min(1, sp2 / 2.4);
    const bobX = P.hidden ? 0 : Math.cos(P.bob) * 0.025 * Math.min(1, sp2 / 2.4);
    const sh = G.shake;
    camera.position.set(P.pos.x + bobX * Math.cos(P.yaw), P.eye + bobY + (Math.random() - 0.5) * sh * 0.1, P.pos.z - bobX * Math.sin(P.yaw));
    if (P.look) { // forced look (scares / death)
      const d = P.look.clone().sub(camera.position), wantYaw = Math.atan2(-d.x, -d.z), wantPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      let dy = wantYaw - P.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283;
      P.yaw += dy * Math.min(1, dt * P.lookK); P.pitch += (wantPitch - P.pitch) * Math.min(1, dt * P.lookK);
    }
    camera.rotation.set(P.pitch + (Math.random() - 0.5) * sh * 0.05, P.yaw + (Math.random() - 0.5) * sh * 0.05, P.roll + (Math.random() - 0.5) * sh * 0.04, 'YXZ');
    G.shake = Math.max(0, G.shake - dt * 0.8);

    // ---- interaction target ----
    P.bestInteract = null;
    if (!P.frozen && G.state === 'play') {
      if (P.hidden) { UI.prompt('Step out &nbsp; <b>SPACE</b> hold breath'); P.bestInteract = { act: P.exitLocker }; }
      else {
        const f = new THREE.Vector3(); camera.getWorldDirection(f);
        let best = null, bs = -1;
        for (const it of L.interact) {
          if (it.on === false) continue;
          const d = it.pos.clone().sub(camera.position), dist = d.length(); if (dist > it.r) continue;
          d.normalize(); const dot = d.dot(f); if (dot < 0.82) continue;
          const score = dot - dist * 0.05; if (score > bs) { bs = score; best = it; }
        }
        P.bestInteract = best;
        UI.prompt(best ? best.prompt() : null);
      }
    } else UI.prompt(null);
  };
  P.interact = () => { if (P.bestInteract && P.bestInteract.act) P.bestInteract.act(); };
  return P;
}
