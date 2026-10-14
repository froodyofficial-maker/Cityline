// You: a night-shift worker with a dying torch. Everything you do makes noise; running makes a lot.
import * as THREE from 'three';
import { collide, toTile } from './level.js';

export const keys = new Set();
let pressed = new Set();
addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
export function tapped(code) { return pressed.has(code); }
export function endFrame() { pressed = new Set(); }

const EYE = 1.62, CROUCH_EYE = 1.0;

export class Player {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.sens = 1;
    this.mouse = { x: 0, y: 0 };
    // the torch hangs off the camera, slightly to the right like it's in your hand
    this.torchPower = 160;
    this.torch = new THREE.SpotLight(0xffe4c4, this.torchPower, 30, 0.55, 0.62, 1.5);
    this.torch.castShadow = true;
    this.torch.shadow.mapSize.set(512, 512);
    this.torch.shadow.camera.near = 0.2;
    this.torch.shadow.bias = -0.0005;
    this.torch.position.set(0.18, -0.16, 0.05);
    this.torch.target.position.set(0, -0.1, -3);
    camera.add(this.torch, this.torch.target);
    // your eyes adjusting to the dark: just enough to make out walls up close
    this.glow = new THREE.PointLight(0x9a8080, 0.9, 5, 2);
    camera.add(this.glow);
    this.reset();
  }

  reset() {
    this.hp = 100;
    this.stamina = 100;
    this.exhausted = false;
    this.battery = 100;
    this.lightOn = true;
    this.crouch = false;
    this.hidden = null;
    this.hiddenSeenBy = new Set();
    this.breath = 100;
    this.holding = false;
    this.tags = 0;
    this.bob = 0;
    this.stepAcc = 0;
    this.shake = 0;
    this.roll = 0;
    this.lit = false;
    this.inLift = true;
    this.bleed = 0;
    this.flickerT = 0;
    this.vel.set(0, 0, 0);
    this.sinceRun = 99;
  }

  spawn(s) {
    this.pos.set(s.x, 0, s.z);
    this.yaw = s.yaw;
    this.pitch = 0;
    this.vel.set(0, 0, 0);
  }

  look(dx, dy) {
    // Chrome sometimes reports one huge jump under pointer lock; drop those instead of snapping the view
    if (Math.abs(dx) > 250 || Math.abs(dy) > 250) return;
    const k = 0.0014 * this.sens;
    this.yaw -= dx * k;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * k * (this.invertY ? -1 : 1)));
    if (this.hidden) {
      // inside a locker you can only look out through the slats
      let rel = ((this.yaw - this.hidden.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      rel = Math.max(-0.5, Math.min(0.5, rel));
      this.yaw = this.hidden.camYaw + rel;
      this.pitch = Math.max(-0.35, Math.min(0.3, this.pitch));
    }
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }
  // how directly you are looking at a point (1 = dead centre)
  facingDot(p, h = 0) {
    const f = this.forward(), dx = p.x - this.pos.x, dy = p.y + h - this.eyeY, dz = p.z - this.pos.z, l = Math.hypot(dx, dy, dz) || 1;
    return (f.x * dx + f.y * dy + f.z * dz) / l;
  }
  flatFacing(p) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), dx = p.x - this.pos.x, dz = p.z - this.pos.z, l = Math.hypot(dx, dz) || 1;
    return (fx * dx + fz * dz) / l;
  }
  get eyeY() { return this.hidden ? 1.55 : this.crouchT !== undefined ? EYE + (CROUCH_EYE - EYE) * this.crouchT : EYE; }

  update(dt, w) {
    const { L, B, audio } = w;
    if (tapped('KeyF') && this.battery > 0 && !this.hidden) { this.lightOn = !this.lightOn; audio.flashlight(); }
    if (tapped('KeyC')) this.crouch = !this.crouch;
    const crouching = this.crouch || keys.has('ControlLeft') || keys.has('ControlRight');
    this.crouchT = (this.crouchT || 0) + ((crouching ? 1 : 0) - (this.crouchT || 0)) * Math.min(1, dt * 10);

    // torch battery
    if (this.lightOn) {
      this.battery = Math.max(0, this.battery - dt * 0.62);
      if (this.battery <= 0) { this.lightOn = false; audio.flashlight(); w.say('The torch dies. The dark comes right up to your face.'); }
    }
    let ti = this.lightOn ? this.torchPower : 0;
    if (this.lightOn && this.battery < 20) {
      this.flickerT -= dt;
      if (this.flickerT < 0) this.flickerT = Math.random() * (this.battery / 10 + 0.2);
      if (this.flickerT < 0.08) ti *= Math.random() * 0.3;
    }
    if (w.torchKill > 0) ti *= Math.random() < 0.5 ? 0 : 0.2;
    this.torch.intensity = ti;

    if (this.hidden) {
      this.vel.set(0, 0, 0);
      this.holding = keys.has('Space');
      if (this.holding) {
        this.breath = Math.max(0, this.breath - dt * 13);
        if (this.breath <= 0) { this.holding = false; this.forceExhale = 1.2; w.gasp(); }
      } else this.breath = Math.min(100, this.breath + dt * 22);
      if (this.forceExhale > 0) { this.forceExhale -= dt; this.holding = false; }
      this.applyCamera(dt, w);
      return;
    }

    // movement
    let ix = 0, iz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    const moving = ix || iz;
    const wantRun = (keys.has('ShiftLeft') || keys.has('ShiftRight')) && moving && iz <= 0 && !crouching && !w.listening;
    const running = wantRun && !this.exhausted;
    if (running) {
      this.stamina = Math.max(0, this.stamina - dt * 19);
      this.sinceRun = 0;
      if (this.stamina <= 0) { this.exhausted = true; w.say('Your lungs are on fire.', 2); }
    } else {
      this.sinceRun += dt;
      if (this.sinceRun > 0.7) this.stamina = Math.min(100, this.stamina + dt * (moving ? 9 : 16));
      if (this.stamina > 35) this.exhausted = false;
    }
    let speed = running ? 5.1 : crouching ? 1.35 : 2.6;
    if (this.hp < 50) speed *= 0.88;
    if (w.slowT > 0) speed *= 0.5;
    if (w.listening) speed = Math.min(speed, 1.3); // you can't listen and hurry
    const len = Math.hypot(ix, iz) || 1;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const tx = ((ix * c + iz * s) / len) * (moving ? speed : 0), tz = ((-ix * s + iz * c) / len) * (moving ? speed : 0);
    const k = Math.min(1, dt * (moving ? 9 : 12));
    this.vel.x += (tx - this.vel.x) * k;
    this.vel.z += (tz - this.vel.z) * k;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    collide(L, B, this.pos, 0.3);

    // footsteps are noise
    const v = Math.hypot(this.vel.x, this.vel.z);
    this.bob += v * dt * 2.3;
    this.stepAcc += v * dt;
    const stride = running ? 1.05 : crouching ? 0.6 : 0.75;
    if (this.stepAcc > stride && v > 0.3) {
      this.stepAcc = 0;
      const wet = B.bloodTiles[toTile(this.pos.z) * L.W + toTile(this.pos.x)] === 1;
      const kind = running ? 'run' : crouching ? 'crouch' : 'walk';
      audio.step(kind, wet);
      w.noise(this.pos, running ? 15 : crouching ? 1.8 : wet ? 7.5 : 5.5, running);
    }
    // breathing: from running, from being hurt, from being afraid
    const pant = Math.max((100 - this.stamina) / 100, this.exhausted ? 1 : 0, w.fear * 0.5, this.hp < 50 ? 0.4 : 0);
    audio.setBreath(pant, 0.45 + pant * 0.9);
    if (this.exhausted && Math.random() < dt * 0.6) w.noise(this.pos, 5, false);
    this.applyCamera(dt, w);
  }

  applyCamera(dt, w) {
    const cam = this.cam;
    const v = Math.hypot(this.vel.x, this.vel.z);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.shakeT = (this.shakeT || 0) + dt;
    const sh = this.shake * w.shakeScale, st = this.shakeT;
    // smooth shake (layered sines), not per-frame noise, so it rattles without strobing
    const nx = Math.sin(st * 31) * 0.6 + Math.sin(st * 17.3) * 0.4, ny = Math.sin(st * 27.1 + 1) * 0.6 + Math.sin(st * 13.7) * 0.4;
    const bob = w.bobScale ?? 1;
    if (this.hidden) {
      const h = this.hidden;
      cam.position.set(h.pos.x - h.facing.x * 0.05, 1.55, h.pos.z - h.facing.z * 0.05);
    } else {
      cam.position.set(this.pos.x, this.eyeY + Math.sin(this.bob * 2) * 0.03 * bob * Math.min(1, v / 2.6), this.pos.z);
    }
    cam.position.x += nx * sh * 0.04;
    cam.position.y += ny * sh * 0.04;
    cam.rotation.set(this.pitch + ny * sh * 0.015, this.yaw + nx * sh * 0.01, Math.sin(this.bob) * 0.004 * v * bob + this.roll, 'YXZ');
  }
}
