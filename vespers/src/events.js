// Story, scares, the director, hallucinations, dying, and getting out.
import * as THREE from 'three';
import { G, T, W3, rr, pick, clamp, damp, after, toTile, angDiff } from './state.js';
import * as AU from './audio.js';
import * as GO from './gore.js';
import { UI } from './ui.js';
import { buildMonsterModel, animateModel, newAnim } from './monster.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const START = { pos: W3(3.3, 5.0), yaw: -Math.PI / 2 }; // facing +x

const NOTES = {
  maraLocker: ['Pinned inside a wardrobe · BR. DANIEL VANCE, NOVICE', `Theo,<br><br>If you're reading this you came up the pass after me, which means you didn't listen. You never listen.<br><br>The brothers don't pray to God here. They pray to the Saint in the crypt. Abbot Benedikt says it's incorrupt, that it hasn't rotted in six hundred years. It hasn't rotted because it isn't dead, Theo. <i>It eats.</i><br><br>Every winter the pass closes and travellers come to the gate, and the abbot lets them in out of the snow.<br><br>Tonight I'm going down to the chapel to get proof. If I'm not back by Lauds, get out through the gatehouse and don't stop for anything. The portcullis is chained with three padlocks. The abbot gave the keys to three brothers, so that no one leaves during the Fast.<br><br><b>Don't run.</b> Whatever you hear, don't run.<br><br>— D`],
  note_log: ['The guest ledger, open on a lectern', `GUESTS RECEIVED AT THE GATE ...... 14<br>GUESTS SERVED .................... 11<br>GUESTS STILL WARM AT VESPERS ..... 14<br>GUESTS STILL SPEAKING ............. 6<br><br>02:10 Guest 9 left his bed. Found in the cloister. Returned.<br>02:40 Guest 9 still speaking. Br. Cyril took his tongue. Silence kept.<br>03:00 Abbot Benedikt absent from Matins.<br>03:05 Abbot Benedikt present.<br>03:06 Abbot Benedikt absent.<br><br><span class="scrawl">it is wearing the abbot</span>`],
  note_journal: ['Journal of Benedikt, Abbot of St. Aldric\'s', `<b>Nov 2.</b> The reliquary in the crypt was open this morning. The Saint's hands were not where they had been.<br><b>Nov 5.</b> It walked at Compline. It did not harm me. It watched us sing. I believe it wished to learn.<br><b>Nov 9.</b> I brought it the first traveller from the gate. God forgive me, it wastes nothing. Not one ounce.<br><b>Nov 14.</b> The pass closed. No more travellers. I gave it Brother Simeon. It thanked me in my mother's voice.<br><b>Nov 21.</b> It is always hungry now. It hears <i>everything</i>: running, weeping, breathing. In the dark, if you keep still and quiet, it walks right past. Hide where the brothers keep their habits and <b>hold your breath</b>.<br><b>Nov 30.</b> It asked if it could try me on.<br><br>The three keys to the gate went to Brothers Cyril, Matthias and Paul: one keeps vigil with the penitents, one serves the refectory, one tends the chapel. The chapel key is on this desk.<br><br><span class="scrawl">ring the bell ring the bell no one is coming</span>`],
  note_run: ['A page torn from a psalter, written over in blood', `<span class="scrawl big">DON'T RUN. IT HEARS RUNNING.<br><br>IT CAN'T SEE YOU IN THE DARK UNLESS YOU SHINE THAT LIGHT AT IT.<br><br>IF IT COMES GET IN A WARDROBE. NEVER LET IT WATCH YOU GET IN.<br><br>IF IT STOPS OUTSIDE<br>DON'T BREATHE<br>DON'T BREATHE<br>DON'T BREATHE</span>`],
  note_mara: ['A novice\'s rosary, in the bones', `Olive-wood beads on a cord, sticky. A little wooden cross with <b>D.V.</b> cut into the back.<br><br>Wrapped around it, a holy card. On the back, in pencil, pressed so hard it tore:<br><br><span class="scrawl">its teaching me to pray to it<br>theo dont come down here<br>it likes the way you sound</span><br><br>The rest is torn away.`],
};
const DEATHS = {
  caught: [['YOU WERE RECEIVED.', 'Guest 15. Still warm at Vespers.'], ['IT WEARS YOU NOW.', 'Your face fits it well.'], ['THE FAST IS BROKEN.', 'Nothing wasted. Not one ounce.']],
  ran: [['YOU RAN.', 'It hears running. Walk. Crouch. Hide.']],
  seen: [['IT WATCHED YOU HIDE.', 'Never let it see you get in.']],
  breath: [['IT HEARD YOU BREATHE.', 'When it stops outside, hold SPACE. Don\'t breathe.']],
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

  // ---------------- phantom (hallucination / scripted) ----------------
  const ph = buildMonsterModel(); G.scene.add(ph.root); ph.root.visible = false; const phA = newAnim();
  ph.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const showPhantom = (p, yaw, dur, opts = {}) => {
    ph.root.position.copy(p); ph.root.rotation.y = yaw; ph.root.visible = true;
    phA.speed = 0; phA.jawOpen = opts.jaw ?? 0.5; phA.tilt = opts.tilt ?? 0.9; phA.lookYaw = 0; phA.lookPitch = opts.pitch ?? 0; animateModel(ph, phA, 0.016);
    E.phantom = { t: dur, look: opts.vanishOnLook };
  };
  const hidePhantom = () => { ph.root.visible = false; E.phantom = null; };

  // ---------------- items / interactions ----------------
  L.onPanelPrompt = () => {
    if (G.elevatorArrived) return null;
    if (F.called) return null;
    if (G.fusesPlaced) return 'Throw the winch';
    if (G.fuses >= 3) return 'Unlock the padlocks';
    return `The portcullis winch, chained with three padlocks (${G.fuses}/3 keys)`;
  };
  L.onItem = (id, it) => {
    if (id === 'flashlight') {
      L.removeItem(it); P.hasFlashlight = true; P.flashOn = true; AU.pickup(); AU.click(0.2);
      UI.subs('F  flashlight · SHIFT  run (loud) · C  crouch · TAB  objective', 6, 'hint');
      return;
    }
    if (id.startsWith('bat')) { L.removeItem(it); P.battery = Math.min(1, P.battery + 0.45); AU.pickup(); UI.subs('Batteries. The torch steadies.', 2.5); return; }
    if (id === 'key') { L.removeItem(it); G.hasKey = true; AU.pickup(); UI.subs('A brass key on a ribbon: CAPELLA.', 3); return; }
    if (id.startsWith('fuse')) {
      L.removeItem(it); G.fuses++; AU.pickup(); AU.metalHit(null, 0.05, true, 900);
      UI.subs(['Brother Cyril\'s key. Still on its cord. Still warm.', 'Brother Matthias\'s key, greasy with fat.', 'Brother Paul\'s key, found among the relics.'][G.fuses - 1] || '', 3.5);
      UI.objective(G.fuses >= 3 ? 'You have all three gate keys. Get to the gatehouse.' : `Find the three gate keys (${G.fuses}/3).`);
      if (id === 'fuse1') coldDrop();
      if (id === 'fuse2') behindYou();
      return;
    }
    if (id === 'unlock') { UI.subs('The lock gives with a wet click.', 2.5); return; }
    if (id === 'panel') return panel();
    if (id === 'corpseLocker') return corpseLocker(it);
    if (id === 'maraLocker') {
      it.used = true; it.doorTarget = 1.6; AU.lockerSound(it.pos, true);
      after(0.5, () => openNote('maraLocker'));
      return;
    }
    if (NOTES[id]) { openNote(id); if (id !== 'note_log') { /* keep re-readable */ } return; }
  };
  const openNote = (id) => {
    const [t, b] = NOTES[id]; G.state = 'note'; UI.note(t, b); AU.pickup(); E.noteId = id;
  };
  E.closeNote = () => {
    UI.hide('note'); G.state = 'play'; const id = E.noteId; E.noteId = null;
    if (id === 'maraLocker' && !F.readMara) { F.readMara = true; UI.objective('Find Daniel. Get out through the gatehouse.'); }
    if (id === 'note_journal' && !F.readJournal) { F.readJournal = true; UI.objective(`Find the three gate keys: the penitents' hall, the refectory, the chapel (${G.fuses}/3).`); }
    if (id === 'note_mara' && !F.readBadge) { F.readBadge = true; maraReveal(); }
  };

  // ---------------- scripted scares ----------------
  function corpseLocker(lk) {
    lk.used = true; lk.doorTarget = 2.3; AU.metalHit(lk.pos, 0.6, false, 240); AU.doorCreak(lk.pos, 0.3);
    const body = GO.foldedCorpse(); const g = new THREE.Group(); g.add(body);
    g.position.copy(lk.pos).addScaledVector(lk.nrm, 0.25); g.position.y = 0; g.rotation.y = lk.yaw; L.root.add(g);
    body.position.z = -0.25;
    let t = 0;
    G.updaters.push(function fall(dt) {
      t += dt; const a = clamp((t - 0.05) / 0.45, 0, 1); g.rotation.x = a * a * 1.12; g.position.y = 0;
      if (t > 0.5 && !fall.done) {
        fall.done = true; AU.thud(lk.front, 1); AU.squelch(lk.front, 1); AU.boneCrack(lk.front, 0.5); AU.stinger(0.55);
        G.shake = 0.5; G.fear = Math.max(G.fear, 0.7); G.flash = 0.25; G.flashCol.set(0.3, 0, 0);
        L.burst(V(lk.front.x, 0.3, lk.front.z), 50, 2.5); L.decalFloor(lk.front.x, lk.front.z, 1.8, 1.8, 'pool');
        return true;
      }
    });
  }
  function corridorSighting() {
    F.sighting = 'running';
    const light = L.specials.sightLight, spot = W3(18.9, 10.45);
    // light stutters on
    light.forced = 1; AU.setBuzz(light.pos, 1);
    const pattern = [0.08, 0, 0.1, 1, 0.05, 0, 0.12, 1];
    pattern.forEach((v, i) => after(i * 0.07, () => { light.forced = v ? 1 : 0; }));
    after(0.6, () => {
      showPhantom(V(spot.x, 0, spot.z), Math.atan2(P.pos.x - spot.x, P.pos.z - spot.z), 99, { tilt: 1.1, jaw: 0.3 });
      AU.swell(0.5, 3);
    });
    after(3.1, () => { light.forced = 0; AU.monsterClicks(V(spot.x, 2, spot.z), false, 0.6); });
    after(3.25, () => { hidePhantom(); });
    after(3.2, () => { light.forced = 1; });
    after(3.32, () => { light.forced = 0; });
    after(3.45, () => { light.forced = 1; });
    after(3.6, () => { light.forced = null; light.dead = true; for (let i = 0; i < 6; i++) setTimeout(() => AU.monsterStep(V(spot.x, 0, spot.z - 3 - i), true, 0.9), i * 160); after(1.5, () => AU.doorSlam(W3(20.5, 8.5), 0.7)); });
    after(4.5, () => { F.sighting = 'done'; G.fear = Math.max(G.fear, 0.6); });
    after(150, () => activateMonster(W3(22, 16.5), 'patrol'));
  }
  function activateMonster(p, state = 'patrol') {
    if (M.active || G.state === 'ending' || G.state === 'end') return;
    M.spawn(p, state === 'patrol' ? 'idle' : state);
  }
  function coldDrop() {
    const h = L.specials.dropper; if (!h || h.dropped) return;
    h.dropped = true;
    const piv = h.pivot, start = piv.position.clone(); let vy = 0, t = 0;
    AU.chain(V(h.x, 3, h.z), 0.6); AU.metalHit(V(h.x, 3, h.z), 0.6, false, 500);
    G.updaters.push(function drop(dt) {
      // it slides off the hook, feet hit first, then it folds over onto the floor
      t += dt; vy -= 9.8 * dt; piv.position.y = Math.max(0.22, piv.position.y + vy * dt);
      const fold = clamp((3.15 - piv.position.y) / 2.9, 0, 1); piv.rotation.x = fold * fold * 1.52; piv.rotation.z = fold * 0.2;
      if (piv.position.y <= 0.22 && !drop.hit) {
        drop.hit = true; const p = V(h.x, 0.3, h.z);
        AU.thud(p, 1); AU.squelch(p, 1); setTimeout(() => AU.squelch(p, 0.8), 120); AU.boneCrack(p, 0.8); AU.stinger(0.6);
        G.shake = 0.6; G.fear = Math.max(G.fear, 0.85); L.burst(p, 80, 3.5); L.decalFloor(h.x + 0.6, h.z, 2.2, 2.2, 'pool');
        // the lights panic
        L.fixtures.filter(f => f.room === 'cold').forEach(f => { for (let i = 0; i < 12; i++) after(i * rr(0.08, 0.2), () => { f.forced = i % 2; }); after(2.6, () => { f.forced = null; }); });
        after(2.2, () => AU.monsterScream(W3(22, 16.5, 2), 0.6, true));
        after(2.8, () => { if (!M.active) activateMonster(W3(22, 16.5)); M.hear(W3(21, 4.5), 999); });
      }
      if (drop.hit && t > 1.4) return true;
    });
  }
  function behindYou() {
    const L1 = L.specials.killFlicker;
    after(1.2, () => { AU.whisper(0.3, 1, 1.6); L1.forced = 0; L1.dead = true; });
    F.behind = { t: 0, written: false };
  }
  function maraReveal() {
    AU.swell(0.6, 5);
    after(1.5, () => UI.subs('Behind the altar hang the vestments. They are skins. The third has a birthmark on the shoulder, shaped like a hand.', 5.5));
    after(7.2, () => { UI.subs('Daniel had a birthmark on his shoulder, shaped like a hand.', 4.5); AU.whisper(0.25, -1, 2.5); AU.bellToll(0.5); });
    after(11.5, () => { UI.objective('Get out. The gatehouse. Now.'); if (M.active) M.hear(P.pos.clone(), 999); else activateMonster(W3(36, 13.5), 'patrol'); });
  }
  function phoneCall() {
    F.phone = 'ringing';
    const stop = AU.radioHiss(L.specials.phone.position);
    const it = { pos: L.specials.phone.position.clone(), r: 2.2, prompt: () => 'Turn the dial on the radio', act: () => answer() };
    L.interact.push(it);
    E.stopPhone = () => { stop(); const i = L.interact.indexOf(it); if (i >= 0) L.interact.splice(i, 1); };
    function answer() {
      E.stopPhone(); F.phone = 'answered'; AU.click(0.25); AU.staticNoise(14, 0.06);
      const lines = [[0.8, 'Theo?'], [2.6, "Theo. It's so cold up here."], [5.6, "I'm in the chapel. It's warm in the chapel."], [9.0, 'Please come.'], [11.4, "It's teaching me to pray."]];
      const spoke = AU.speak("Theo?... Theo. It's so cold up here... I'm in the chapel. It's warm in the chapel... Please, come... It's teaching me to pray.", 0.6, 0.6);
      lines.forEach(([t, s]) => after(t, () => UI.subs('"' + s + '"', 3.2, 'voice')));
      after(14.5, () => { AU.stopSpeech(); AU.monsterBreath(V(G.camera.position.x, 1.6, G.camera.position.z), false, 0.35); UI.subs('Breathing through the static. Wet. Then a laugh in your brother\'s voice that keeps going after the signal dies.', 5); });
      after(17, () => {
        const d = L.doorAt(31, 8); if (d) { d.target = 0; d.angle = 0; AU.doorSlam(d.pos, 1); G.shake = 0.4; }
        if (M.active) M.hear(W3(31.5, 9.5), 999);
      });
      if (!spoke) UI.subs('(the voice is barely there)', 2);
    }
  }
  function crawlerUpdate(dt) {
    const c = L.specials.crawler; if (!c || c.dead) return;
    const g = c.group, d = Math.hypot(P.pos.x - g.position.x, P.pos.z - g.position.z);
    if (!c.awake) {
      if (inRoom('tunnel') && d < 11 && L.los(V(g.position.x, 0.5, g.position.z), G.camera.position)) { c.awake = true; c.t = 0; AU.monsterBreath(g.position, false, 0.3); }
      return;
    }
    c.t += dt;
    const want = Math.atan2(P.pos.x - g.position.x, P.pos.z - g.position.z);
    g.rotation.y += angDiff(g.rotation.y, want) * Math.min(1, dt * 2);
    if (d > 1.5 && !c.lunge) {
      const sp = 0.55 + Math.max(0, Math.sin(c.t * 3.2)) * 0.6;
      g.position.x += Math.sin(g.rotation.y) * sp * dt; g.position.z += Math.cos(g.rotation.y) * sp * dt;
      L.collide(g.position, 0.3);
      c.armL.rotation.x = Math.sin(c.t * 3.2) * 0.7 - 0.3; c.armR.rotation.x = -Math.sin(c.t * 3.2) * 0.7 - 0.3;
      c.torso.rotation.z = Math.sin(c.t * 3.2) * 0.12; c.headG.rotation.x = -0.3 + Math.sin(c.t * 7) * 0.1;
      if (Math.sin(c.t * 3.2) > 0.98 && !c.dragged) { c.dragged = true; AU.squelch(g.position, 0.25); } else if (Math.sin(c.t * 3.2) < 0) c.dragged = false;
      if (Math.random() < dt * 0.4) AU.monsterBreath(V(g.position.x, 0.4, g.position.z), false, 0.25);
      if (Math.random() < dt * 2) L.decalFloor(g.position.x, g.position.z, 0.6, 0.6, 'splat');
    } else if (!c.lunge) {
      c.lunge = 0.0001; AU.monsterScream(V(g.position.x, 0.5, g.position.z), 0.7); AU.stinger(0.5); G.fear = 1; G.shake = 0.5;
      G.flash = 0.2; G.flashCol.set(0.3, 0, 0);
    } else {
      c.lunge += dt;
      if (c.lunge < 0.25) { g.position.x += Math.sin(g.rotation.y) * 3 * dt; g.position.z += Math.cos(g.rotation.y) * 3 * dt; c.torso.rotation.x = -0.5; c.armL.rotation.x = c.armR.rotation.x = -1.4; }
      else if (!c.dead) {
        c.dead = true; c.torso.rotation.x = 0.15; c.headG.rotation.x = 0.6; c.armL.rotation.x = 0.4; c.armR.rotation.x = 0.2;
        AU.squelch(g.position, 0.9); AU.boneCrack(g.position, 0.5); L.burst(V(g.position.x, 0.4, g.position.z), 60, 2.5); L.decalFloor(g.position.x, g.position.z, 1.6, 1.6, 'pool');
        UI.subs('It stops moving. Its eyes don\'t.', 3);
      }
    }
  }
  function vatHand() {
    F.vatHand = true;
    const v = L.vats[1], ang = Math.atan2(P.pos.x - v.x, P.pos.z - v.z), m = GO.goreMats();
    const arm = new THREE.Group(); arm.position.set(v.x + Math.sin(ang) * 0.85, 1.12, v.z + Math.cos(ang) * 0.85); arm.rotation.y = ang; L.root.add(arm);
    GO.limb(arm, V(0, -0.6, -0.15), V(0, 0.05, 0), 0.04, 0.035, m.skinGrey);
    const hand = GO.ball(arm, V(0, 0.08, 0.08), 0.045, m.skinGrey, 1.1, 0.6, 1.6);
    for (let i = 0; i < 4; i++) GO.limb(arm, V(-0.03 + i * 0.02, 0.08, 0.13), V(-0.03 + i * 0.02, 0.0, 0.2), 0.008, 0.007, m.skinGrey);
    arm.position.y = 0.4; let t = 0;
    AU.bubble(V(v.x, 1.1, v.z), 0.4); AU.squelch(V(v.x, 1.1, v.z), 0.5); setTimeout(() => AU.stinger(0.35), 250);
    G.updaters.push(function rise(dt) { t += dt; arm.position.y = Math.min(1.12, 0.4 + t * 2.2); if (t > 0.35 && !rise.g) { rise.g = true; AU.metalHit(V(v.x, 1.1, v.z), 0.25, false, 300); } return t > 1; });
    G.fear = Math.max(G.fear, 0.6);
  }
  function panel() {
    if (G.elevatorArrived || F.called) return;
    if (G.fusesPlaced) {
      F.called = true; AU.metalHit(L.specials.panelInteract.pos, 0.5, false, 180); L.specials.lever.rotation.z = 0.9;
      AU.winch(42, 0.3); AU.bellToll(0.6); UI.objective('The portcullis is rising. Survive until it opens.');
      UI.subs('The winch takes the weight. Chain screams over the drum. Every stone in the abbey hears it.', 4.5);
      const red = L.specials.lobbyRed; red.flicker = 0.9;
      // the whole building just heard that
      after(3, () => { if (!M.active) activateMonster(W3(13, 10.5)); M.hear(W3(39.5, 5), 999); M.awareness = 0.8; AU.monsterScream(V(M.pos.x, 2, M.pos.z), 0.7, true); });
      E.carDescend = { t: 0, dur: 40 };
      return;
    }
    if (G.fuses >= 3) {
      G.fusesPlaced = true; for (let i = 0; i < 3; i++) after(i * 0.4, () => { L.specials['socket' + i].material = new THREE.MeshBasicMaterial({ color: 0xffa020 }); AU.metalHit(L.specials.panelInteract.pos, 0.2, false, 600 + i * 80); });
      AU.click(0.3); UI.subs('Three keys. Three padlocks drop away. The chain is free.', 3.5);
      return;
    }
    AU.thud(L.specials.panelInteract.pos, 0.15);
    if (!F.panelSeen) { F.panelSeen = true; UI.objective(`Find the three keys to the portcullis padlocks (${G.fuses}/3).`); }
  }

  // ---------------- death ----------------
  G.killPlayer = (how) => {
    if (G.state !== 'play') return;
    if (how === 'caught' && P.sprinting) how = 'ran';
    if (how === 'locker') how = M.ripReason === 'breath' ? 'breath' : 'seen';
    E.deathHow = how; G.state = 'dying'; E.deathT = 0; G.deaths++; E.deathPos = P.pos.clone();
    P.frozen = true; AU.A.holding = false; E.deathCam = G.camera.position.clone(); E.deathRoll = 0; E.hits = 0;
    if (!P.hidden) {
      const f = V(M.pos.x - P.pos.x, 0, M.pos.z - P.pos.z); if (f.lengthSq() < 0.01) f.set(Math.sin(P.yaw + Math.PI), 0, Math.cos(P.yaw + Math.PI)); f.normalize();
      M.pos.copy(P.pos).addScaledVector(f, 0.95);
    }
    M.yaw = Math.atan2(P.pos.x - M.pos.x, P.pos.z - M.pos.z);
    M.anim.raise = 1; M.anim.jawOpen = 1.3; M.anim.speed = 0; M.anim.reach = 0.3;
    AU.stinger(0.85); AU.monsterScream(V(M.pos.x, 2.2, M.pos.z), 1); G.flash = 0.55; G.flashCol.set(0.5, 0, 0); G.shake = 0.7; G.fear = 1;
  };
  E.updateDeath = (dt) => {
    E.deathT += dt; const t = E.deathT, md = M.md, a = M.anim;
    md.root.position.copy(M.pos); md.root.rotation.y = M.yaw;
    const hit = (n, at) => { if (E.hits === n && t > at) { E.hits++; return true; } return false; };
    if (hit(0, 0.55)) { a.raise = 0; a.reach = 1; AU.squelch(null, 1); AU.boneCrack(null, 0.8); G.blood = 0.55; G.shake = 1; G.flash = 0.4; L.burst(V(G.camera.position.x, 1.4, G.camera.position.z), 60, 3); E.deathRoll = 0.4; }
    if (hit(1, 1.0)) { a.raise = 0.6; AU.tear(0.9); AU.squelch(null, 0.9); G.blood = 0.8; G.shake = 0.8; }
    if (hit(2, 1.3)) { a.raise = 0; AU.squelch(null, 1); AU.boneCrack(null, 1); G.blood = 0.95; L.burst(V(G.camera.position.x, 1.0, G.camera.position.z), 80, 3.5); }
    if (t > 1.5) { a.crouch = Math.min(1, a.crouch + dt * 1.5); a.neckFwd = 0.9; a.jawOpen = 1.25 + Math.sin(t * 9) * 0.15; a.reach = 0.6; a.tilt = Math.sin(t * 2) * 0.5; a.snappy = true;
      if (Math.floor(t / 0.33) !== Math.floor((t - dt) / 0.33) && t < 3.8) { (Math.random() < 0.5 ? AU.squelch : AU.boneCrack)(null, 0.4 + Math.random() * 0.4); if (Math.random() < 0.3) AU.tear(0.5); G.shake = 0.25; }
    }
    a.speed = 0; animateModel(md, a, dt);
    // camera: struck, then on the floor looking up at it while it works
    const fall = clamp((t - 1.25) / 0.45, 0, 1);
    const floorY = P.hidden ? 0.5 : 0.22;
    const cp = E.deathCam.clone(); cp.y = THREE.MathUtils.lerp(E.deathCam.y, floorY, fall * fall);
    G.camera.position.copy(cp).add(V((Math.random() - 0.5) * G.shake * 0.15, (Math.random() - 0.5) * G.shake * 0.1, (Math.random() - 0.5) * G.shake * 0.15));
    const hp = new THREE.Vector3(); md.head.getWorldPosition(hp);
    G.camera.up.set(0, 1, 0); G.camera.lookAt(hp);
    G.camera.rotateZ(E.deathRoll + fall * 1.25);
    G.shake = Math.max(0, G.shake - dt * 1.2);
    G.black = clamp((t - 2.9) / 1.0, 0, 1);
    G.distort = 0.4 + fall * 0.6;
    if (t > 4.2 && G.state === 'dying') {
      G.state = 'dead'; const [a1, b1] = pick(DEATHS[E.deathHow] || DEATHS.caught); UI.death(a1, b1); AU.setMasterMuted(false);
      document.exitPointerLock?.();
    }
  };
  E.respawn = () => {
    UI.hide('death');
    // you stay where you died
    const body = GO.tableCorpse({ open: true, face: 'flayed', missing: [pick(['lArm', 'rLeg', 'lArmLower'])] });
    body.position.set(E.deathPos.x, -0.86, E.deathPos.z); body.rotation.y = Math.random() * 6.28; L.root.add(body); GO.bake(body);
    L.decalFloor(E.deathPos.x, E.deathPos.z, 2.4, 2.4, 'pool'); L.decalFloor(E.deathPos.x + 0.5, E.deathPos.z - 0.3, 1.4, 1.4, 'pool');
    G.timers = []; hidePhantom();
    for (const f of L.fixtures) if (f !== L.specials.carLight) f.forced = null;
    for (const l of L.lockers) { l.doorTarget = 0; l.door.visible = true; }
    if (E.stopPhone && F.phone === 'ringing') { E.stopPhone(); F.phone = null; }
    if (F.sighting === 'running') F.sighting = 'done';
    P.hidden = false; P.locker = null; P.frozen = false; P.look = null; P.roll = 0; P.place(START.pos.clone(), START.yaw); P.stamina = 1; P.breath = 1; P.exhausted = false;
    P.battery = Math.max(P.battery, 0.35); if (P.hasFlashlight) P.flashOn = true;
    const md = M.md; M.anim.crouch = 0; M.anim.neckFwd = 0; M.anim.raise = 0; M.anim.reach = 0;
    // it goes back to work somewhere far away
    const far = L.waypoints.filter(p => p.distanceTo(P.pos) > 30); M.spawn(pick(far.length ? far : L.waypoints), 'idle'); M.timer = 12;
    G.camera.up.set(0, 1, 0);
    G.blood = 0.25; G.black = 1; G.fear = 0.35; G.distort = 0; G.state = 'play'; E.wakeT = 0;
    UI.subs(pick(['You wake on the dormitory floor again. Your hands are wet.', 'The dormitory. Again. The choir is still singing. Something red under your nails.', 'You wake up. You remember it eating. You remember all of it.']), 5);
    if (E.carDescend && !G.elevatorArrived) { E.carDescend.t = Math.max(E.carDescend.t, E.carDescend.dur - 10); }
  };

  // ---------------- ending ----------------
  function startEnding() {
    G.state = 'ending'; E.endT = 0; P.frozen = true;
    E.endStart = P.pos.clone(); E.endYaw = P.yaw; M.despawn();
    AU.footstep('run'); G.fear = 1;
  }
  E.updateEnding = (dt) => {
    E.endT += dt; const t = E.endT, gate = L.specials.gate, cam = G.camera;
    // you stumble out into the snow, then turn around
    const out = clamp(t / 1.4, 0, 1);
    cam.position.set(E.endStart.x, 1.55 - out * 0.25 + Math.sin(t * 9) * 0.02 * (1 - out), THREE.MathUtils.lerp(E.endStart.z, W3(0, 1.25).z, out));
    if (t > 0.6 && !E.dropped) { E.dropped = true; AU.metalHit(W3(40, 3, 2), 1, false, 110); AU.thud(W3(40, 3, 1), 1); G.shake = 0.7; }
    if (E.dropped) gate.position.y = Math.max(0, gate.position.y - dt * 9);
    const want = t < 1.5 ? V(cam.position.x, cam.position.y, cam.position.z - 5) : V(W3(40, 0).x, 1.3, W3(0, 3.6).z);
    const m = new THREE.Matrix4().lookAt(cam.position, want, V(0, 1, 0)); const q = new THREE.Quaternion().setFromRotationMatrix(m);
    cam.quaternion.slerp(q, Math.min(1, dt * (t < 1.5 ? 6 : 2.2)));
    if (t > 2.0 && !E.mRun) { E.mRun = true; ph.root.visible = true; ph.root.position.copy(W3(39.8, 7.2)); phA.speed = 4.5; AU.monsterScream(W3(39.8, 6, 2), 1); }
    if (E.mRun && !E.mHit) {
      ph.root.position.z = Math.max(W3(0, 3.4).z, ph.root.position.z - dt * 5); ph.root.rotation.y = Math.PI; phA.speed = 4.5; phA.jawOpen = 1.2; phA.reach = 1; animateModel(ph, phA, dt);
      if (ph.root.position.z <= W3(0, 3.4).z + 0.01) { E.mHit = true; AU.metalHit(W3(40, 3, 1.5), 1, false, 120); AU.thud(W3(40, 3, 1.5), 1); AU.stinger(0.7); G.shake = 0.8; G.flash = 0.3; G.flashCol.set(0.4, 0, 0); }
    }
    if (E.mHit && t < 6) { phA.speed = 0; phA.reach = 1; phA.raise = Math.sin(t * 6) > 0 ? 1 : 0.2; phA.jawOpen = 1.3; phA.snappy = true; animateModel(ph, phA, dt); if (Math.random() < dt * 4) AU.metalHit(W3(40, 3, 1.5), 0.6, false, 120 + Math.random() * 60); }
    if (t >= 6 && !E.still) { E.still = true; phA.raise = 0; phA.reach = 0.2; phA.jawOpen = 0.3; phA.tilt = 1.0; AU.bellToll(0.6); } // it just stands and watches you go
    if (E.still) animateModel(ph, phA, dt);
    // the white takes everything
    if (t > 6.5) { G.flashCol.set(0.82, 0.85, 0.9); G.flash = clamp((t - 6.5) / 2.2, 0, 1); }
    if (t > 9.5 && G.state === 'ending') {
      G.state = 'end'; ph.root.visible = false; document.exitPointerLock?.();
      const mins = Math.floor(G.playTime / 60), secs = Math.floor(G.playTime % 60);
      document.getElementById('endStats').textContent = `Time ${mins}:${String(secs).padStart(2, '0')}  ·  Deaths ${G.deaths}`;
      UI.show('end');
    }
  };

  // ---------------- per-frame ----------------
  E.update = (dt) => {
    // fear
    let target = 0.05;
    if (M.active) {
      const d = M.distToPlayer;
      target += clamp(1 - d / 22, 0, 1) * 0.6;
      if (M.canSee) target += 0.2;
      if (M.state === 'chase') target = 1;
      if (P.hidden && d < 6) target = Math.max(target, 0.92);
    }
    if (P.hasFlashlight && !P.flashOn && !L.litAt(P.pos)) target += 0.1;
    G.fear = target > G.fear ? damp(G.fear, target, 2.5, dt) : damp(G.fear, target, 0.2, dt);
    G.distort = damp(G.distort, G.fear > 0.8 ? (G.fear - 0.8) * 1.8 : 0, 3, dt);
    G.blood = Math.max(0, G.blood - dt * 0.05); G.flash = Math.max(0, G.flash - dt * 2.5);
    if (E.wakeT !== undefined) { E.wakeT += dt; G.black = Math.max(0, 1 - E.wakeT / 2.5); if (E.wakeT > 2.5) E.wakeT = undefined; }

    // phantom lifetime
    if (E.phantom) {
      E.phantom.t -= dt;
      if (E.phantom.look && P.flashOn) { const hp = ph.root.position.clone(); hp.y = 1.8; if (inView(hp, 0.96)) E.phantom.t = Math.min(E.phantom.t, 0.08); }
      if (E.phantom.t <= 0) hidePhantom();
    }

    // ---- triggers ----
    const room = L.roomAt(P.pos.x, P.pos.z);
    if (!F.sighting && P.hasFlashlight && room === 'corridor' && P.pos.x < W3(15, 0).x) {
      const f = camFwd(); if (f.x > 0.75) corridorSighting(); else if (!F.sightWait) F.sightWait = G.time;
      if (F.sightWait && G.time - F.sightWait > 25) corridorSighting();
    }
    if (!F.sighting && room === 'cold') corridorSighting(); // came the other way
    // the watcher in cold storage turns its head while you're not looking
    const w = L.specials.watcher;
    if (w && room === 'cold') {
      const hp = V(w.x, 1.2, w.z), d = hp.distanceTo(G.camera.position), head = w.body.userData.head;
      if (!F.watchPassed && d < 3.5) F.watchPassed = true;
      if (F.watchPassed && !F.watchTurned && d > 4.5 && !inView(hp, 0.5)) {
        F.watchTurned = true; head.rotation.y += 2.6; head.rotation.x = -0.4; head.children.forEach(c => { if (c.isGroup) c.rotation.x = 1.0; });
      }
      if (F.watchTurned && !F.watchSeen && inView(hp, 0.85) && d < 9) { F.watchSeen = true; AU.swell(0.45, 3.5); AU.whisper(0.22, Math.random() < 0.5 ? -1 : 1, 1.5); G.fear = Math.max(G.fear, 0.55); }
    }
    if (room === 'office' && !F.phone && !F.phoneQueued && F.sighting === 'done') { F.phoneQueued = true; after(1.5, () => { F.phoneQueued = false; if (!F.phone && L.roomAt(P.pos.x, P.pos.z) === 'office') phoneCall(); }); }
    if (F.phone === 'ringing' && room !== 'office' && room !== 'corridor' && E.stopPhone) { E.stopPhone(); F.phone = null; }
    // behind you
    if (F.behind && !F.behind.done) {
      const b = F.behind; b.t += dt;
      if (!b.written && b.t > 1.4) {
        const wp = V(W3(12, 0).x + 0.1, 1.8, W3(0, 21.5).z);
        if (!inView(wp, 0.3)) { b.written = true; b.writing = L.writing(12, 21, 'w', 0, 1.85, 'BEHIND YOU', 2.45, 0.9); b.wt = b.t; AU.whisper(0.32, -1, 1.2); }
      }
      if (b.written && !b.phantom && b.t - b.wt > 0.5) {
        // when you turn to read it, it's standing where you were looking
        const wp = V(W3(12, 0).x, 1.8, W3(0, 21.5).z);
        if (inView(wp, 0.8)) {
          b.phantom = true;
          const back = camFwd().multiplyScalar(-1); back.y = 0; back.normalize();
          const pp = P.pos.clone().addScaledVector(back, 3.2);
          const [tx, ty] = toTile(pp.x, pp.z);
          if (L.passable(tx, ty)) { showPhantom(pp, Math.atan2(P.pos.x - pp.x, P.pos.z - pp.z), 0.9, { vanishOnLook: false, jaw: 1.1, tilt: 1.3 }); after(0.05, () => { AU.monsterClicks(pp, false, 0.7); }); }
          b.done = true;
        }
        if (b.t > 25) b.done = true;
      }
    }
    // turning around onto the phantom behind you: the payoff
    if (E.phantom && F.behind?.phantom && !F.behindScare) {
      const hp = ph.root.position.clone(); hp.y = 1.9;
      if (inView(hp, 0.7)) { F.behindScare = true; AU.stinger(0.75); G.flash = 0.15; G.flashCol.set(1, 1, 1); G.shake = 0.4; G.fear = 1; E.phantom.t = 0.35; }
    }
    crawlerUpdate(dt);
    if (!F.vatHand && room === 'render' && P.pos.distanceTo(V(L.vats[1].x, 0, L.vats[1].z)) < 3.6) vatHand();
    // the lift coming down
    if (E.carDescend && !G.elevatorArrived) {
      const cd = E.carDescend; cd.t += dt;
      L.specials.gate.position.y = Math.min(2.2, (cd.t / cd.dur) * 2.2);  // too low to crawl under until it's done
      if (cd.t >= cd.dur) {
        G.elevatorArrived = true; L.gateOpen = true; L.specials.gate.position.y = 2.9;
        AU.bellToll(0.7); AU.thud(W3(40, 2.5), 0.8); AU.metalHit(W3(40, 2.5), 0.6, false, 200); UI.objective('The gate is open. RUN.');
        UI.subs('Snow blows in under the spikes.', 3);
      }
    }
    if (G.elevatorArrived && L.roomAt(P.pos.x, P.pos.z) === 'car' && G.state === 'play') startEnding();

    // ---- the director: the building is alive ----
    dirT -= dt;
    if (dirT < 0) {
      dirT = rr(16, 40);
      if (!(M.active && M.state === 'chase')) {
        const r = Math.random();
        if (r < 0.18) AU.distantScream(0.12 + Math.random() * 0.12);
        else if (r < 0.34) AU.groan(0.22);
        else if (r < 0.48) AU.clang(V(P.pos.x + rr(-25, 25), 2, P.pos.z + rr(-25, 25)), 0.4, { muffle: true });
        else if (r < 0.52) AU.footstepsAbove();
        else if (r < 0.58) AU.bellToll(0.25 + Math.random() * 0.2);
        else if (r < 0.7) AU.chain(V(P.pos.x + rr(-10, 10), 2.5, P.pos.z + rr(-10, 10)), 0.25);
        else if (r < 0.8 && G.fear > 0.25) AU.whisper(0.16);
        else if (r < 0.9) burstNearbyLight();
        else if (!M.active || M.distToPlayer > 25) AU.monsterScream(V(P.pos.x + rr(-30, 30), 2, P.pos.z + rr(-30, 30)), 0.35, true);
      }
    }
    // ---- your nerve going ----
    if (G.fear > 0.55 && G.time > halluT && !E.phantom) {
      if (Math.random() < dt * 0.06) {
        halluT = G.time + rr(25, 50);
        const r = Math.random();
        if (r < 0.15 && faceCount < 3 && G.time - lastFace > 120) { faceCount++; lastFace = G.time; UI.face(85); AU.stinger(0.6); G.distort = 1; G.fear = 1; }
        else if (r < 0.45 && G.time - lastPhantom > 70 && !(M.active && M.state === 'chase')) { lastPhantom = G.time; spawnPhantomAhead(); }
        else AU.whisper(0.22);
      }
    }
  };
  function burstNearbyLight() {
    // something breathes out, close to a flame, and it goes out
    const c = L.fixtures.filter(f => !f.dead && f.forced === null && (f.type === 'candle' || f.type === 'lantern') && f !== L.specials.killFlicker && f.pos.distanceTo(G.camera.position) < 14 && f.pos.distanceTo(G.camera.position) > 4);
    if (!c.length) return; const f = pick(c);
    f.dead = true; AU.sniff(f.pos, 0.5);
  }
  function spawnPhantomAhead() {
    const f = camFwd(); f.y = 0; f.normalize();
    for (let d = 14; d > 7; d -= 1.5) {
      const p = P.pos.clone().addScaledVector(f, d); const [tx, ty] = toTile(p.x, p.z);
      if (!L.passable(tx, ty) || L.cell(tx, ty) !== '.') continue;
      if (!L.los(G.camera.position, V(p.x, 1.8, p.z))) continue;
      showPhantom(p, Math.atan2(P.pos.x - p.x, P.pos.z - p.z), rr(0.6, 1.4), { vanishOnLook: true, tilt: rr(-1.2, 1.2), jaw: rr(0.3, 1.2) });
      AU.swell(0.35, 2.5);
      return;
    }
  }

  E.begin = () => {
    P.place(START.pos.clone(), START.yaw); P.pitch = 1.2; P.roll = 0.9; G.black = 1; P.frozen = true;
    let t = 0;
    AU.gasp(0.3);
    G.updaters.push(function wake(dt) {
      t += dt; G.black = Math.max(0, 1 - t / 3.5);
      P.pitch = THREE.MathUtils.lerp(1.2, -0.1, clamp((t - 1.5) / 2.5, 0, 1)); P.roll = THREE.MathUtils.lerp(0.9, 0, clamp((t - 1.5) / 2.2, 0, 1));
      P.eye = THREE.MathUtils.lerp(0.3, 1.62, clamp((t - 2) / 2, 0, 1));
      if (t > 4) { P.frozen = false; P.roll = 0; UI.subs('Daniel? ...Daniel!', 3); after(3.5, () => UI.objective('Find your brother.')); return true; }
    });
  };
  return E;
}
