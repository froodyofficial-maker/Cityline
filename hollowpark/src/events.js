// Story, scares, the director, hallucinations, dying, and the drive out.
import * as THREE from 'three';
import { G, T, W3, rr, pick, clamp, damp, after, toTile, angDiff } from './state.js';
import * as AU from './audio.js';
import * as GO from './gore.js';
import { UI } from './ui.js';
import { buildMonsterModel, animateModel, newAnim } from './monster.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const START = { pos: W3(7.5, 2.8), yaw: Math.PI }; // in the hall, just inside the front door, facing in

const NOTES = {
  note_dad: ['A note on the hall table, in Dad\'s writing', `Alex,<br><br>If you're reading this, you came. I asked you not to. You never listen. You get that from your mother.<br><br>I know what you think. That I never got over her. That I sit in the study with the park map and the newspaper clippings and talk to myself. You're right about all of it except one thing:<br><br><b>he's real.</b><br><br>The thing the kids call Mr. Smiles. He took your mother out of that park thirty years ago, and every few years since, he takes somebody else. This autumn he started coming to the fence at night. Last week he came into the house.<br><br>The car keys, the battery, the gas: I hid them so I couldn't drive off and leave you here alone if you came. I'm sorry. I hid them in the park.<br><br>Lock the doors. Keep the lights off. <b>Don't run.</b> He hears running.<br><br>— Dad`],
  note_journal: ["Dad's journal, the last pages", `<b>Oct 2.</b> The crickets stopped again last night. They always stop when he's near. Thirty years and I still sleep with the window open so I'll hear them stop.<br><b>Oct 9.</b> Saw him under the lamp by the gate. Tall. Grey. That smile. He has no eyes and he was looking right at the house.<br><b>Oct 15.</b> The Hendersons' boy is missing. The police found his shoes on the roundabout.<br><b>Oct 22.</b> He was in the kitchen. He'd laid the table. He wanted me to sit down and eat with him. I hid in the pantry and held my breath until he left. <b>He can't see you in the dark if you're still. He hears you breathe. He hears you run.</b><br><b>Oct 28.</b> I've hidden the car parts in the park: keys in the sandbox, gas in the groundskeeper's hut, battery in the shed. If Alex comes, the note on the hall table will tell them.<br><b>Oct 30.</b> He asked me, in your mother's voice, if I'd like to come and play.<br><br><span class="scrawl">i said yes</span>`],
  note_kids: ['Scratched into the restroom wall, very old', `<span class="scrawl big">MISTER SMILES AT THE PLAYGROUND GATE<br>COUNTS TO TEN AND THEN HE'LL WAIT<br>IF YOU RUN HE'LL HEAR YOUR FEET<br>IF YOU HIDE HE'LL HEAR YOU BREATHE<br>IF HE FINDS YOU, DON'T YOU CRY<br>HE'LL WEAR YOUR SMILE WHEN YOU SAY GOODBYE</span><br><br>Underneath, in newer marker: <i>he took jenny. he took jenny. he took jenny.</i>`],
  note_run: ['A page torn out of a library book, written over in blood', `<span class="scrawl big">DON'T RUN. HE HEARS RUNNING.<br><br>HE CAN'T SEE YOU IN THE DARK UNLESS YOU SHINE THAT LIGHT AT HIM.<br><br>IF HE COMES, HIDE. NEVER LET HIM WATCH YOU GET IN.<br><br>LISTEN FOR THE CRICKETS. WHEN THEY STOP, HE'S CLOSE.<br><br>IF HE STOPS OUTSIDE<br>DON'T BREATHE</span>`],
  note_watch: ["Dad's wristwatch, on the floor of the back room", `A steel Seiko with a cracked face. Stopped at 3:06. The back is engraved:<br><br><b>To Walt, all my love, forever. — E.</b><br><br>The strap is still buckled. There's no wrist in it.`],
};
const DEATHS = {
  caught: [['HE FOUND YOU.', 'Mr. Smiles wears your smile now.'], ['YOU CAME TO PLAY.', 'He was so happy you came.'], ['COUNTED TO TEN.', 'Then he stopped waiting.']],
  ran: [['YOU RAN.', 'He hears running. Walk. Crouch. Hide.']],
  seen: [['HE WATCHED YOU HIDE.', 'Never let him see you get in.']],
  breath: [['HE HEARD YOU BREATHE.', 'When he stops outside, hold SPACE. Don\'t breathe.']],
};

export function createEvents(L, M, P) {
  const E = { deathT: 0, endT: 0, flags: {} };
  const F = E.flags;
  let dirT = 25, halluT = 40, faceCount = 0, lastFace = -999, lastPhantom = -999;
  const inRoom = (id) => L.roomAt(P.pos.x, P.pos.z) === id;
  const camFwd = () => { const f = V(0, 0, 0); G.camera.getWorldDirection(f); return f; };
  const inView = (p, dot = 0.75) => { const d = p.clone().sub(G.camera.position).normalize(); return d.dot(camFwd()) > dot && L.los(G.camera.position, p); };
  G.noise = (pos, radius) => { if (radius > 0) M.hear(pos, radius); };
  G.onChaseStart = () => { F.chases = (F.chases || 0) + 1; };
  G.onChaseEnd = () => { };
  G.parts = { keys: false, gas: false, battery: false };

  // ---------------- phantom ----------------
  const ph = buildMonsterModel(); G.scene.add(ph.root); ph.root.visible = false; const phA = newAnim();
  const showPhantom = (p, yaw, dur, opts = {}) => {
    ph.root.position.copy(p); ph.root.rotation.y = yaw; ph.root.visible = true;
    phA.speed = 0; phA.jawOpen = opts.jaw ?? 0.1; phA.tilt = opts.tilt ?? 0.9; phA.lookYaw = 0; phA.lookPitch = opts.pitch ?? 0; animateModel(ph, phA, 0.016);
    E.phantom = { t: dur, look: opts.vanishOnLook };
  };
  const hidePhantom = () => { ph.root.visible = false; E.phantom = null; };
  E.phantomModel = ph;

  // ---------------- items ----------------
  const partsLeft = () => ['keys', 'gas', 'battery'].filter(k => !G.parts[k]);
  const partName = { keys: 'the car keys', gas: 'gas', battery: 'a battery' };
  L.onPanelPrompt = () => {
    if (F.driving) return null;
    if (G.elevatorArrived) return 'DRIVE';
    if (F.carStarted) return null;
    if (F.carFixed) return F.crankFails ? 'Try it again' : 'Start the car';
    const left = partsLeft();
    if (!left.length) return 'Put the battery in and fill the tank';
    return `Dad's car. It needs ${left.map(k => partName[k]).join(', ').replace(/, ([^,]*)$/, ' and $1')}`;
  };
  L.onItem = (id, it) => {
    if (id === 'flashlight') { L.removeItem(it); P.hasFlashlight = true; P.flashOn = true; AU.pickup(); AU.click(0.2); UI.subs('F  flashlight · SHIFT  run (loud) · C  crouch · TAB  objective', 6, 'hint'); return; }
    if (id.startsWith('cell')) { L.removeItem(it); P.battery = Math.min(1, P.battery + 0.45); AU.pickup(); UI.subs('Batteries. The torch steadies.', 2.5); return; }
    if (id === 'key') { L.removeItem(it); G.hasKey = true; AU.pickup(); UI.subs('A small brass key on a tag in Dad\'s writing: STUDY.', 3); return; }
    if (id === 'keys' || id === 'gas' || id === 'battery') {
      L.removeItem(it); G.parts[id] = true; G.fuses = 3 - partsLeft().length; AU.pickup();
      UI.subs({ keys: 'The car keys. Dad\'s keyring, the plastic fob from Mom\'s old bank.', gas: 'A full can of gas. Heavy. It sloshes when you move.', battery: 'The car battery. It weighs a ton.' }[id], 3.5);
      UI.objective(partsLeft().length ? `Find ${partsLeft().map(k => partName[k]).join(' and ')} for the car (${G.fuses}/3).` : 'You have everything. Get back to the garage.');
      if (id === 'keys') sandboxDrop();
      if (id === 'battery') { AU.thud(P.pos.clone(), 0.3); G.noise(P.pos.clone(), 6); }
      return;
    }
    if (id === 'unlock') { UI.subs('The lock turns. The study smells of pipe smoke and something under it.', 3); return; }
    if (id === 'lockedDoor') { if (!F.lockSeen) { F.lockSeen = true; UI.subs('Locked. Dad kept the study locked.', 2.5); } return; }
    if (id === 'frontdoor') { UI.subs(pick(['It won\'t open. Something is leaning on it from outside.', 'The handle turns. The door doesn\'t move.', 'Through the letterbox: nothing but dark, and breathing.']), 3); return; }
    if (id === 'panel') return car();
    if (id === 'corpseLocker') return corpseLocker(it);
    if (NOTES[id]) { openNote(id); return; }
  };
  const openNote = (id) => { const [t, b] = NOTES[id]; G.state = 'note'; UI.note(t, b); AU.pickup(); E.noteId = id; };
  E.closeNote = () => {
    UI.hide('note'); G.state = 'play'; const id = E.noteId; E.noteId = null;
    if (id === 'note_dad' && !F.readDad) { F.readDad = true; UI.objective('Find Dad. Find the car keys, the gas and the battery (0/3).'); }
    if (id === 'note_journal' && !F.readJournal) { F.readJournal = true; UI.objective(`Keys in the sandbox. Gas in the groundskeeper's hut. Battery in the shed (${G.fuses}/3).`); }
    if (id === 'note_watch' && !F.readWatch) { F.readWatch = true; watchReveal(); }
  };

  // ---------------- scares ----------------
  function corpseLocker(lk) {
    lk.used = true; lk.doorTarget = 2.3; AU.metalHit(lk.pos, 0.3, false, 240); AU.doorCreak(lk.pos, 0.3);
    const body = GO.foldedCorpse(); const g = new THREE.Group(); g.add(body);
    g.position.copy(lk.pos).addScaledVector(lk.nrm, 0.25); g.position.y = 0; g.rotation.y = lk.yaw; L.root.add(g); body.position.z = -0.25;
    let t = 0;
    G.updaters.push(function fall(dt) {
      t += dt; const a = clamp((t - 0.05) / 0.45, 0, 1); g.rotation.x = a * a * 1.12;
      if (t > 0.5 && !fall.done) { fall.done = true; AU.thud(lk.front, 1); AU.squelch(lk.front, 1); AU.boneCrack(lk.front, 0.5); AU.stinger(0.55); G.shake = 0.5; G.fear = Math.max(G.fear, 0.7); G.flash = 0.2; G.flashCol.set(0.3, 0, 0); L.burst(V(lk.front.x, 0.3, lk.front.z), 50, 2.5); L.decalFloor(lk.front.x, lk.front.z, 1.6, 1.6, 'pool'); return true; }
    });
  }
  // through the fence: under the lamp by the park gate, it's standing, looking at the house
  function sighting() {
    F.sighting = 'running';
    const light = L.specials.sightLight, spot = V(light.pos.x + 1.2, 0, light.pos.z + 0.6);
    light.forced = 1;
    [0.08, 0, 0.1, 1, 0.05, 0, 0.12, 1].forEach((v, i) => after(i * 0.07, () => { light.forced = v ? 1 : 0; }));
    after(0.6, () => { showPhantom(spot, Math.atan2(P.pos.x - spot.x, P.pos.z - spot.z), 99, { tilt: 1.1, jaw: 0.05 }); AU.swell(0.5, 3); });
    after(3.1, () => { light.forced = 0; AU.monsterClicks(V(spot.x, 2, spot.z), false, 0.6); });
    after(3.25, hidePhantom);
    after(3.3, () => { light.forced = 1; }); after(3.42, () => { light.forced = 0; }); after(3.55, () => { light.forced = 1; });
    after(3.7, () => { light.forced = null; for (let i = 0; i < 6; i++) setTimeout(() => AU.monsterStep(V(spot.x + 3 + i, 0, spot.z), true, 0.9), i * 160); });
    after(4.5, () => { F.sighting = 'done'; G.fear = Math.max(G.fear, 0.6); UI.objective(F.readDad ? `Find the car keys, the gas and the battery (${G.fuses}/3).` : 'Find Dad.'); });
    after(140, () => activateMonster(W3(40.5, 22), 'patrol'));
  }
  function activateMonster(p, state = 'patrol') { if (M.active || G.state === 'ending' || G.state === 'end') return; M.spawn(p, state === 'patrol' ? 'idle' : state); }
  // taking the keys: one of them drops off the climbing frame behind you
  function sandboxDrop() {
    const h = L.specials.dropper; if (!h || h.dropped) return; h.dropped = true;
    const piv = h.pivot; let vy = 0, t = 0; AU.chain(V(h.x, 2.5, h.z), 0.5);
    G.updaters.push(function drop(dt) {
      t += dt; vy -= 9.8 * dt; piv.position.y = Math.max(0.2, piv.position.y + vy * dt);
      const fold = clamp((2.55 - piv.position.y) / 2.3, 0, 1); piv.rotation.x = fold * fold * 1.52; piv.rotation.z = fold * 0.2;
      if (piv.position.y <= 0.2 && !drop.hit) {
        drop.hit = true; const p = V(h.x, 0.3, h.z);
        AU.thud(p, 1); AU.squelch(p, 1); setTimeout(() => AU.squelch(p, 0.8), 120); AU.boneCrack(p, 0.8); AU.stinger(0.6);
        G.shake = 0.6; G.fear = Math.max(G.fear, 0.85); L.burst(p, 80, 3.5); L.decalFloor(h.x + 0.6, h.z, 2, 2, 'pool');
        after(2.2, () => AU.monsterScream(W3(40.5, 22, 2), 0.6, true));
        after(2.8, () => { if (!M.active) activateMonster(W3(40.5, 20)); M.hear(W3(30, 32), 999); });
      }
      if (drop.hit && t > 1.4) return true;
    });
  }
  function watchReveal() {
    AU.swell(0.6, 5);
    after(1.5, () => UI.subs('On the rail, the skins hang like coats. The second one has an anchor tattooed on the forearm.', 5.5));
    after(7.2, () => { UI.subs('Dad got that anchor in the Navy. You used to trace it with your finger.', 4.5); AU.whisper(0.25, -1, 2.5); });
    after(11.5, () => { UI.objective(partsLeft().length ? `Get the rest and get out (${G.fuses}/3).` : 'Get back to the garage. Get out.'); if (M.active) M.hear(P.pos.clone(), 999); else activateMonster(W3(60.5, 30)); });
  }
  function phoneCall() {
    F.phone = 'ringing';
    const stop = AU.phoneRing(L.specials.phone.position);
    const it = { pos: L.specials.phone.position.clone(), r: 2.2, prompt: () => 'Answer the phone', act: () => answer() };
    L.interact.push(it);
    E.stopPhone = () => { stop(); const i = L.interact.indexOf(it); if (i >= 0) L.interact.splice(i, 1); };
    function answer() {
      E.stopPhone(); F.phone = 'answered'; AU.click(0.25); AU.staticNoise(14, 0.05);
      const lines = [[0.8, 'Alex?'], [2.6, "Alex. It's so cold out here."], [5.6, "I'm at the playground. Where we used to go."], [9.0, 'Come and play.'], [11.4, "He wants to meet you. He's smiling."]];
      const spoke = AU.speak("Alex?... Alex. It's so cold out here... I'm at the playground. Where we used to go... Come and play... He wants to meet you. He's smiling.", 0.3, 0.6);
      lines.forEach(([t, s]) => after(t, () => UI.subs('"' + s + '"', 3.2, 'voice')));
      after(14.5, () => { AU.stopSpeech(); AU.monsterBreath(V(G.camera.position.x, 1.6, G.camera.position.z), false, 0.35); UI.subs('Wet breathing on the line. Then Dad laughing, and laughing, and it isn\'t his laugh.', 5); });
      after(17, () => { const d = L.doorAtDef('7,9,8,9'); if (d) { d.target = 0; d.angle = 0; AU.doorSlam(d.pos, 1); G.shake = 0.4; } if (M.active) M.hear(W3(7.5, 9.5), 999); });
      if (!spoke) UI.subs('(the voice is barely there)', 2);
    }
  }
  // your old room: the music box starts on its own
  function kidsRoom() {
    F.musicBox = true; const stop = AU.musicBox(L.specials.musicBox, 1); E.stopMusic = stop;
    after(22, stop);
    F.behind = { t: 0, written: false };
  }
  function crawlerUpdate(dt) {
    const c = L.specials.crawler; if (!c || c.dead) return;
    const g = c.group, d = Math.hypot(P.pos.x - g.position.x, P.pos.z - g.position.z);
    if (!c.awake) { if (d < 11 && L.los(V(g.position.x, 0.5, g.position.z), G.camera.position)) { c.awake = true; c.t = 0; AU.monsterBreath(g.position, false, 0.3); } return; }
    c.t += dt;
    const want = Math.atan2(P.pos.x - g.position.x, P.pos.z - g.position.z); g.rotation.y += angDiff(g.rotation.y, want) * Math.min(1, dt * 2);
    if (d > 1.5 && !c.lunge) {
      const sp = 0.55 + Math.max(0, Math.sin(c.t * 3.2)) * 0.6;
      g.position.x += Math.sin(g.rotation.y) * sp * dt; g.position.z += Math.cos(g.rotation.y) * sp * dt; L.collide(g.position, 0.3);
      c.armL.rotation.x = Math.sin(c.t * 3.2) * 0.7 - 0.3; c.armR.rotation.x = -Math.sin(c.t * 3.2) * 0.7 - 0.3; c.torso.rotation.z = Math.sin(c.t * 3.2) * 0.12; c.headG.rotation.x = -0.3 + Math.sin(c.t * 7) * 0.1;
      if (Math.sin(c.t * 3.2) > 0.98 && !c.dragged) { c.dragged = true; AU.squelch(g.position, 0.25); } else if (Math.sin(c.t * 3.2) < 0) c.dragged = false;
      if (Math.random() < dt * 0.4) AU.monsterBreath(V(g.position.x, 0.4, g.position.z), false, 0.25);
      if (Math.random() < dt * 2) L.decalFloor(g.position.x, g.position.z, 0.6, 0.6, 'splat');
    } else if (!c.lunge) { c.lunge = 0.0001; AU.monsterScream(V(g.position.x, 0.5, g.position.z), 0.7); AU.stinger(0.5); G.fear = 1; G.shake = 0.5; G.flash = 0.2; G.flashCol.set(0.3, 0, 0); }
    else {
      c.lunge += dt;
      if (c.lunge < 0.25) { g.position.x += Math.sin(g.rotation.y) * 3 * dt; g.position.z += Math.cos(g.rotation.y) * 3 * dt; c.torso.rotation.x = -0.5; c.armL.rotation.x = c.armR.rotation.x = -1.4; }
      else if (!c.dead) { c.dead = true; c.torso.rotation.x = 0.15; c.headG.rotation.x = 0.6; c.armL.rotation.x = 0.4; c.armR.rotation.x = 0.2; AU.squelch(g.position, 0.9); AU.boneCrack(g.position, 0.5); L.burst(V(g.position.x, 0.4, g.position.z), 60, 2.5); L.decalFloor(g.position.x, g.position.z, 1.6, 1.6, 'pool'); UI.subs('It stops moving. Its eyes don\'t.', 3); }
    }
  }
  // at the end of the pier, something takes hold of the boards
  function pondHand() {
    F.vatHand = true;
    const v = L.vats[1], m = GO.goreMats(), arm = new THREE.Group(); arm.position.set(v.x - 0.5, -0.6, v.z + 0.2); L.root.add(arm);
    GO.limb(arm, V(0, -0.6, 0), V(0, 0.05, 0.1), 0.045, 0.04, m.skinGrey); GO.ball(arm, V(0, 0.08, 0.16), 0.05, m.skinGrey, 1.1, 0.6, 1.6);
    for (let i = 0; i < 4; i++) GO.limb(arm, V(-0.03 + i * 0.02, 0.08, 0.2), V(-0.03 + i * 0.02, 0.06, 0.3), 0.009, 0.008, m.skinGrey);
    let t = 0; AU.bubble(V(v.x, 0, v.z), 0.4); AU.squelch(V(v.x, 0, v.z), 0.5); setTimeout(() => AU.stinger(0.35), 250);
    G.updaters.push(function rise(dt) { t += dt; arm.position.y = Math.min(0.12, -0.6 + t * 1.6); if (t > 0.5 && !rise.g) { rise.g = true; AU.thud(V(v.x, 0.1, v.z), 0.3); } return t > 1; });
    G.fear = Math.max(G.fear, 0.6);
  }
  // the car: fix it, start it, open the door, drive
  function car() {
    const pos = L.specials.panelInteract.pos;
    if (G.elevatorArrived) { startEnding(); return; }
    if (F.carStarted) return;
    if (F.carFixed) {
      AU.carCrank(1.4, 0.45); G.noise(pos, 24);
      if (!F.crankFails) { F.crankFails = 1; after(1.5, () => UI.subs('It turns over and dies. Again.', 2.5)); return; }
      F.carStarted = true;
      after(1.3, () => {
        E.engine = AU.engine(0.28); L.specials.headlights.emissive.setHex(0xffeedd); L.specials.headlights.emissiveIntensity = 3; L.specials.carLight.forced = 1;
        UI.subs('The engine catches. The garage door motor groans and starts to lift, inch by inch.', 4); UI.objective('Hold out until the garage door is up.');
        AU.garageMotor(36, 0.3); E.carDescend = { t: 0, dur: 36 };
        after(2, () => { if (!M.active) activateMonster(W3(17, 9)); M.hear(pos, 999); M.awareness = 0.8; AU.monsterScream(V(M.pos.x, 2, M.pos.z), 0.7, true); });
      });
      return;
    }
    if (!partsLeft().length) {
      F.carFixed = true; AU.thud(pos, 0.4); setTimeout(() => AU.metalHit(pos, 0.2, false, 500), 500); setTimeout(() => AU.bubble(pos, 0.3), 900);
      G.noise(pos, 8); UI.subs('Battery in. Clamps on. Gas in the tank, glugging, loud in the quiet.', 3.5); UI.objective('Start the car.');
      return;
    }
    AU.thud(pos, 0.15);
    if (!F.carSeen) { F.carSeen = true; UI.objective(`Find ${partsLeft().map(k => partName[k]).join(' and ')} for the car (${G.fuses}/3).`); }
  }

  // ---------------- death ----------------
  G.killPlayer = (how) => {
    if (G.state !== 'play') return;
    if (how === 'caught' && P.sprinting) how = 'ran';
    if (how === 'locker') how = M.ripReason === 'breath' ? 'breath' : 'seen';
    E.deathHow = how; G.state = 'dying'; E.deathT = 0; G.deaths++; E.deathPos = P.pos.clone();
    P.frozen = true; AU.A.holding = false; E.deathCam = G.camera.position.clone(); E.deathRoll = 0; E.hits = 0;
    if (!P.hidden) { const f = V(M.pos.x - P.pos.x, 0, M.pos.z - P.pos.z); if (f.lengthSq() < 0.01) f.set(Math.sin(P.yaw + Math.PI), 0, Math.cos(P.yaw + Math.PI)); f.normalize(); M.pos.copy(P.pos).addScaledVector(f, 0.95); }
    M.yaw = Math.atan2(P.pos.x - M.pos.x, P.pos.z - M.pos.z);
    M.anim.raise = 1; M.anim.jawOpen = 1.0; M.anim.speed = 0; M.anim.reach = 0.3;
    AU.stinger(0.85); AU.monsterScream(V(M.pos.x, 2.2, M.pos.z), 1); G.flash = 0.5; G.flashCol.set(0.5, 0, 0); G.shake = 0.7; G.fear = 1;
  };
  E.updateDeath = (dt) => {
    E.deathT += dt; const t = E.deathT, md = M.md, a = M.anim;
    md.root.position.copy(M.pos); md.root.rotation.y = M.yaw;
    const hit = (n, at) => { if (E.hits === n && t > at) { E.hits++; return true; } return false; };
    if (hit(0, 0.55)) { a.raise = 0; a.reach = 1; AU.squelch(null, 1); AU.boneCrack(null, 0.8); G.blood = 0.55; G.shake = 1; G.flash = 0.4; L.burst(V(G.camera.position.x, 1.4, G.camera.position.z), 60, 3); E.deathRoll = 0.4; }
    if (hit(1, 1.0)) { a.raise = 0.6; AU.tear(0.9); AU.squelch(null, 0.9); G.blood = 0.8; G.shake = 0.8; }
    if (hit(2, 1.3)) { a.raise = 0; AU.squelch(null, 1); AU.boneCrack(null, 1); G.blood = 0.95; L.burst(V(G.camera.position.x, 1.0, G.camera.position.z), 80, 3.5); }
    if (t > 1.5) { a.crouch = Math.min(1, (a.crouch || 0) + dt * 1.5); a.neckFwd = 0.9; a.jawOpen = 0.9 + Math.sin(t * 9) * 0.15; a.reach = 0.6; a.tilt = Math.sin(t * 2) * 0.5; a.snappy = true;
      if (Math.floor(t / 0.33) !== Math.floor((t - dt) / 0.33) && t < 3.8) { (Math.random() < 0.5 ? AU.squelch : AU.boneCrack)(null, 0.4 + Math.random() * 0.4); if (Math.random() < 0.3) AU.tear(0.5); G.shake = 0.25; } }
    a.speed = 0; animateModel(md, a, dt);
    const fall = clamp((t - 1.25) / 0.45, 0, 1), floorY = P.hidden ? 0.5 : 0.22;
    const cp = E.deathCam.clone(); cp.y = THREE.MathUtils.lerp(E.deathCam.y, floorY, fall * fall);
    G.camera.position.copy(cp).add(V((Math.random() - 0.5) * G.shake * 0.15, (Math.random() - 0.5) * G.shake * 0.1, (Math.random() - 0.5) * G.shake * 0.15));
    const hp = new THREE.Vector3(); md.head.getWorldPosition(hp); G.camera.up.set(0, 1, 0); G.camera.lookAt(hp); G.camera.rotateZ(E.deathRoll + fall * 1.25);
    G.shake = Math.max(0, G.shake - dt * 1.2); G.black = clamp((t - 2.9) / 1.0, 0, 1); G.distort = 0.4 + fall * 0.6;
    if (t > 4.2 && G.state === 'dying') { G.state = 'dead'; const [a1, b1] = pick(DEATHS[E.deathHow] || DEATHS.caught); UI.death(a1, b1); document.exitPointerLock?.(); }
  };
  E.respawn = () => {
    UI.hide('death');
    const body = GO.tableCorpse({ open: true, face: 'flayed', missing: [pick(['lArm', 'rLeg', 'lArmLower'])] });
    body.position.set(E.deathPos.x, -0.86, E.deathPos.z); body.rotation.y = Math.random() * 6.28; L.root.add(body); GO.bake(body);
    L.decalFloor(E.deathPos.x, E.deathPos.z, 2.2, 2.2, 'pool');
    G.timers = []; hidePhantom(); E.stopMusic?.();
    for (const f of L.fixtures) if (f !== L.specials.carLight) f.forced = null;
    for (const l of L.lockers) { l.doorTarget = 0; l.door.visible = true; }
    if (E.stopPhone && F.phone === 'ringing') { E.stopPhone(); F.phone = null; }
    if (F.sighting === 'running') F.sighting = 'done';
    P.hidden = false; P.locker = null; P.frozen = false; P.look = null; P.roll = 0; P.place(START.pos.clone(), START.yaw); P.stamina = 1; P.breath = 1; P.exhausted = false;
    P.battery = Math.max(P.battery, 0.35); if (P.hasFlashlight) P.flashOn = true;
    M.anim.crouch = 0; M.anim.neckFwd = 0; M.anim.raise = 0; M.anim.reach = 0;
    const far = L.waypoints.filter(p => p.distanceTo(P.pos) > 35); M.spawn(pick(far.length ? far : L.waypoints), 'idle'); M.timer = 12;
    G.camera.up.set(0, 1, 0); G.blood = 0.25; G.black = 1; G.fear = 0.35; G.distort = 0; G.state = 'play'; E.wakeT = 0;
    UI.subs(pick(['You wake up in the hall again. The front door still won\'t open.', 'The hall. Again. You can hear the crickets outside. For now.', 'You wake up. You remember the smile. You remember all of it.']), 5);
    if (E.carDescend && !G.elevatorArrived) E.carDescend.t = Math.max(E.carDescend.t, E.carDescend.dur - 10);
  };

  // ---------------- ending: in the car ----------------
  function startEnding() {
    G.state = 'ending'; E.endT = 0; P.frozen = true; P.hidden = false; F.driving = true; M.despawn();
    AU.doorSlam(L.specials.panelInteract.pos, 0.6); E.engine?.rev(1.6);
    const car = L.specials.car; E.car0 = car.position.clone();
  }
  E.updateEnding = (dt) => {
    E.endT += dt; const t = E.endT, car = L.specials.car, cam = G.camera;
    // drive out: roll forward under the door and onto the drive
    const roll = clamp((t - 1.0) / 4.0, 0, 1), dz = -(roll * roll) * 7;
    car.position.z = E.car0.z + dz; L.specials.carLight.pos.set(car.position.x, 0.8, car.position.z - 2.6);
    const seat = V(car.position.x - 0.35, 1.25, car.position.z + 0.15);
    cam.position.copy(seat).add(V(Math.sin(t * 20) * 0.003, Math.sin(t * 13) * 0.004, 0));
    if (t < 4.5) { cam.rotation.set(-0.05, 0, 0, 'YXZ'); if (t > 1 && !E.revd) { E.revd = true; E.engine?.rev(2.2); } }
    else if (t < 6.2) { E.engine?.rev(1.2); cam.rotation.set(-0.05, 0, 0, 'YXZ'); if (!E.sub) { E.sub = true; UI.subs('You made it. You made it. You made—', 2.5); } }
    else {
      // something in the back seat
      if (!E.bs) { E.bs = true; ph.root.visible = true; phA.speed = 0; phA.crouch = 0.9; phA.neckFwd = 1.0; phA.jawOpen = 0.05; phA.reach = 0.4; phA.tilt = 0.8; AU.monsterBreath(V(seat.x, 1.3, seat.z + 1), false, 0.6); }
      ph.root.position.set(car.position.x + 0.1, -0.55, car.position.z + 1.2); ph.root.rotation.y = Math.PI;
      const look = clamp((t - 6.2) / 0.7, 0, 1); cam.rotation.set(-0.15 * look, Math.PI * 0.85 * look, 0, 'YXZ');
      if (t > 7.0 && !E.grin) { E.grin = true; phA.jawOpen = 1.1; AU.stinger(0.9); AU.monsterScream(V(seat.x, 1.3, seat.z + 0.8), 1); G.shake = 1; G.flash = 0.3; G.flashCol.set(0.4, 0, 0); }
      phA.snappy = true; animateModel(ph, phA, dt);
      if (t > 7.4) G.black = 1;
    }
    if (t > 9.5 && G.state === 'ending') {
      G.state = 'end'; ph.root.visible = false; E.engine?.stop(); document.exitPointerLock?.();
      const mins = Math.floor(G.playTime / 60), secs = Math.floor(G.playTime % 60);
      document.getElementById('endStats').textContent = `Time ${mins}:${String(secs).padStart(2, '0')}  ·  Deaths ${G.deaths}`;
      UI.show('end');
    }
  };

  // ---------------- per-frame ----------------
  E.update = (dt) => {
    let target = 0.05;
    if (M.active) { const d = M.distToPlayer; target += clamp(1 - d / 22, 0, 1) * 0.6; if (M.canSee) target += 0.2; if (M.state === 'chase') target = 1; if (P.hidden && d < 6) target = Math.max(target, 0.92); }
    if (P.hasFlashlight && !P.flashOn && !L.litAt(P.pos)) target += 0.1;
    G.fear = target > G.fear ? damp(G.fear, target, 2.5, dt) : damp(G.fear, target, 0.2, dt);
    G.distort = damp(G.distort, G.fear > 0.8 ? (G.fear - 0.8) * 1.8 : 0, 3, dt);
    G.blood = Math.max(0, G.blood - dt * 0.05); G.flash = Math.max(0, G.flash - dt * 2.5);
    if (E.wakeT !== undefined) { E.wakeT += dt; G.black = Math.max(0, 1 - E.wakeT / 2.5); if (E.wakeT > 2.5) E.wakeT = undefined; }
    if (E.phantom) { E.phantom.t -= dt; if (E.phantom.look && P.flashOn) { const hp = ph.root.position.clone(); hp.y = 1.9; if (inView(hp, 0.96)) E.phantom.t = Math.min(E.phantom.t, 0.08); } if (E.phantom.t <= 0) hidePhantom(); }

    const room = L.roomAt(P.pos.x, P.pos.z);
    // the first sighting: from the yard, or through an east window
    if (!F.sighting && P.hasFlashlight) {
      const f = camFwd(), sp = L.specials.sightLight.pos;
      const looking = f.x > 0.8 && L.los(G.camera.position, V(sp.x + 1.2, 1.8, sp.z + 0.6));
      if ((room === 'yard' || room === 'laundry' || room === 'kid' || room === 'study' || room === 'master') && looking) sighting();
      else if (room !== '' && !['garage', 'living', 'kitchen', 'hall', 'master', 'bath', 'study', 'kid', 'laundry', 'guest', 'yard', 'shed'].includes(room)) sighting();
    }
    // the hanging guest turns its head while you're not looking
    const w = L.specials.watcher;
    if (w && room === 'guest') {
      const hp = V(w.x, 1.0, w.z), d = hp.distanceTo(G.camera.position), head = w.body.userData.head;
      if (!F.watchPassed && d < 2.5) F.watchPassed = true;
      if (F.watchPassed && !F.watchTurned && !inView(hp, 0.4)) { F.watchTurned = true; head.rotation.y += 2.6; head.rotation.x = -0.4; head.children.forEach(c => { if (c.isGroup) c.rotation.x = 1.0; }); }
      if (F.watchTurned && !F.watchSeen && inView(hp, 0.85)) { F.watchSeen = true; AU.swell(0.45, 3.5); AU.whisper(0.22, Math.random() < 0.5 ? -1 : 1, 1.5); G.fear = Math.max(G.fear, 0.55); }
    }
    if (room === 'study' && !F.phone && !F.phoneQueued && F.sighting === 'done') { F.phoneQueued = true; after(1.2, () => { F.phoneQueued = false; if (!F.phone && L.roomAt(P.pos.x, P.pos.z) === 'study') phoneCall(); }); }
    if (F.phone === 'ringing' && room !== 'study' && room !== 'hall' && E.stopPhone) { E.stopPhone(); F.phone = null; }
    if (room === 'kid' && !F.musicBox) kidsRoom();
    // BEHIND YOU, in your old room
    if (F.behind && !F.behind.done) {
      const b = F.behind; b.t += dt;
      const wp = V(W3(12, 0).x - 0.1, 1.8, W3(0, 12.5).z);
      if (!b.written && b.t > 5 && !inView(wp, 0.3)) { b.written = true; L.writing(12, 12, 'e', 0.3, 1.75, 'BEHIND YOU', 1.8, 0.7); b.wt = b.t; AU.whisper(0.32, -1, 1.2); L.specials.killFlicker.forced = 0; }
      if (b.written && !b.phantom && b.t - b.wt > 0.5 && inView(wp, 0.8)) {
        b.phantom = true; const back = camFwd().multiplyScalar(-1); back.y = 0; back.normalize();
        const pp = P.pos.clone().addScaledVector(back, 1.8); const [tx, ty] = toTile(pp.x, pp.z);
        if (L.roomAt(pp.x, pp.z) === 'kid') { showPhantom(pp, Math.atan2(P.pos.x - pp.x, P.pos.z - pp.z), 0.9, { vanishOnLook: false, jaw: 0.9, tilt: 1.3 }); after(0.05, () => AU.monsterClicks(pp, false, 0.7)); }
        b.done = true;
      }
      if (b.t > 40) b.done = true;
    }
    if (E.phantom && F.behind?.phantom && !F.behindScare) { const hp = ph.root.position.clone(); hp.y = 1.9; if (inView(hp, 0.7)) { F.behindScare = true; AU.stinger(0.75); G.flash = 0.15; G.flashCol.set(1, 1, 1); G.shake = 0.4; G.fear = 1; E.phantom.t = 0.35; after(0.4, () => { L.specials.killFlicker.forced = null; }); } }
    crawlerUpdate(dt);
    if (!F.vatHand && room === 'pier' && P.pos.distanceTo(V(L.vats[1].x, 0, L.vats[1].z)) < 2.4) pondHand();
    // the garage door going up
    if (E.carDescend && !G.elevatorArrived) {
      const cd = E.carDescend; cd.t += dt; const gd = L.specials.gdoor; gd.position.y = Math.min(2.25, (cd.t / cd.dur) * 2.25);
      if (cd.t >= cd.dur) { G.elevatorArrived = true; L.specials.gdoorCol.on = false; AU.thud(W3(4.5, 2), 0.6); UI.objective('The door is up. GET IN THE CAR AND DRIVE.'); }
    }
    // the director: the neighbourhood at night
    dirT -= dt;
    if (dirT < 0) {
      dirT = rr(16, 40);
      if (!(M.active && M.state === 'chase')) {
        const r = Math.random();
        if (r < 0.15) AU.distantScream(0.1 + Math.random() * 0.1);
        else if (r < 0.28) AU.groan(0.16);
        else if (r < 0.4) AU.clang(V(P.pos.x + rr(-25, 25), 2, P.pos.z + rr(-25, 25)), 0.3, { muffle: true });
        else if (r < 0.52) AU.footstepsAbove();
        else if (r < 0.62) AU.doorCreak(V(P.pos.x + rr(-12, 12), 1, P.pos.z + rr(-12, 12)), 0.2);
        else if (r < 0.74 && G.fear > 0.25) AU.whisper(0.16);
        else if (r < 0.84) { const stop = AU.musicBox(V(P.pos.x + rr(-20, 20), 1, P.pos.z + rr(-20, 20)), 1.3); setTimeout(stop, 4000); }
        else if (r < 0.92) burstNearbyLight();
        else if (!M.active || M.distToPlayer > 25) AU.monsterScream(V(P.pos.x + rr(-30, 30), 2, P.pos.z + rr(-30, 30)), 0.35, true);
      }
    }
    if (G.fear > 0.55 && G.time > halluT && !E.phantom && Math.random() < dt * 0.06) {
      halluT = G.time + rr(25, 50); const r = Math.random();
      if (r < 0.15 && faceCount < 3 && G.time - lastFace > 120) { faceCount++; lastFace = G.time; UI.face(85); AU.stinger(0.6); G.distort = 1; G.fear = 1; }
      else if (r < 0.45 && G.time - lastPhantom > 70 && !(M.active && M.state === 'chase')) { lastPhantom = G.time; spawnPhantomAhead(); }
      else AU.whisper(0.22);
    }
  };
  function burstNearbyLight() {
    const c = L.fixtures.filter(f => !f.dead && f.forced === null && (f.type === 'bulb' || f.type === 'street' || f.type === 'fluoro') && f !== L.specials.killFlicker && f.pos.distanceTo(G.camera.position) < 16 && f.pos.distanceTo(G.camera.position) > 4);
    if (!c.length) return; const f = pick(c); f.dead = true; AU.lightBurst(f.pos); L.burst(f.pos, 25, 2);
  }
  function spawnPhantomAhead() {
    const f = camFwd(); f.y = 0; f.normalize();
    for (let d = 16; d > 7; d -= 1.5) {
      const p = P.pos.clone().addScaledVector(f, d); const [tx, ty] = toTile(p.x, p.z);
      if (!L.passable(tx, ty) || !L.los(G.camera.position, V(p.x, 1.8, p.z))) continue;
      showPhantom(p, Math.atan2(P.pos.x - p.x, P.pos.z - p.z), rr(0.6, 1.4), { vanishOnLook: true, tilt: rr(-1.2, 1.2), jaw: rr(0.0, 0.8) }); AU.swell(0.35, 2.5); return;
    }
  }

  E.begin = () => {
    P.place(START.pos.clone(), START.yaw); P.pitch = 0; G.black = 1; P.frozen = true;
    let t = 0; AU.doorSlam(W3(7.5, 2), 1);
    const fd = L.doors.find(d => d.type === 'front'); if (fd) { fd.angle = 0.4; fd.target = 0; }
    G.updaters.push(function arrive(dt) {
      t += dt; G.black = Math.max(0, 1 - t / 2.5);
      if (t > 1.0 && !arrive.k) { arrive.k = true; AU.metalHit(W3(7.5, 2, 1), 0.25, false, 600); UI.subs('The door slams behind you. Something outside turns the lock.', 4); G.shake = 0.3; }
      if (t > 3) { P.frozen = false; UI.subs('Dad? ...Dad, it\'s me. It\'s Alex.', 3.5); after(4, () => UI.objective('Find Dad.')); return true; }
    });
  };
  return E;
}
