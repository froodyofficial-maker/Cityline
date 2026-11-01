// DOM overlays: prompts, objectives, subtitles, notes, meters, screens.
import { G } from './state.js';
import { faceImage } from './textures.js';

const $ = (id) => document.getElementById(id);
let subT = null, objT = null, lastPrompt = null, lastHud = '';

export const UI = {
  show(id) { $(id).classList.remove('hidden'); },
  hide(id) { $(id).classList.add('hidden'); },
  prompt(t) {
    if (t === lastPrompt) return; lastPrompt = t;
    const el = $('prompt'); el.classList.toggle('low', !!G.player?.hidden); if (!t) { el.classList.remove('on'); return; }
    el.innerHTML = '<b>E</b> ' + t; el.classList.add('on');
  },
  objective(t) {
    G.objective = t; const el = $('obj'); el.textContent = t; el.classList.add('on');
    clearTimeout(objT); objT = setTimeout(() => el.classList.remove('on'), 6000);
  },
  peekObjective() { const el = $('obj'); el.textContent = G.objective || ''; el.classList.add('on'); clearTimeout(objT); objT = setTimeout(() => el.classList.remove('on'), 2500); },
  subs(t, d = 4, cls = '') {
    const el = $('subs'); el.className = cls; el.textContent = t; el.classList.add('on');
    clearTimeout(subT); subT = setTimeout(() => el.classList.remove('on'), d * 1000);
  },
  note(title, body) { $('noteTitle').textContent = title; $('noteBody').innerHTML = body; UI.show('note'); },
  hud(p) {
    const key = [Math.round(p.battery * 40), Math.round(p.stamina * 30), Math.round(p.breath * 30), p.hidden, G.fuses, G.hasKey, p.hasFlashlight, p.flashOn, JSON.stringify(G.parts)].join();
    if (key === lastHud) return; lastHud = key;
    $('batFill').style.width = (p.battery * 100) + '%';
    $('batFill').style.background = p.battery < 0.15 ? '#8a1a10' : '#c9c0a0';
    $('bat').style.opacity = p.hasFlashlight ? (p.flashOn ? 0.75 : 0.35) : 0;
    $('stam').style.opacity = p.stamina < 0.98 ? 0.6 : 0; $('stamFill').style.width = (p.stamina * 100) + '%';
    $('breath').style.opacity = p.hidden ? 0.85 : 0; $('breathFill').style.width = (p.breath * 100) + '%';
    $('breathFill').style.background = p.breath < 0.3 ? '#8a1a10' : '#9aa8b0';
    $('inv').innerHTML = (G.parts && (G.parts.keys || G.parts.gas || G.parts.battery) ? ['keys', 'gas', 'battery'].map(k => `<span class="${G.parts[k] ? 'got' : ''}">${k.toUpperCase()}</span>`).join('') : '') + (G.hasKey ? '<span class="got">STUDY KEY</span>' : '');
  },
  // a face for a frame
  _face: null,
  face(ms = 90) {
    if (!UI._face) { UI._face = faceImage(); $('face').style.backgroundImage = `url(${UI._face})`; }
    const el = $('face'); el.style.transform = `scale(${1 + Math.random() * 0.3}) rotate(${(Math.random() - 0.5) * 8}deg)`; el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), ms);
  },
  death(a, b) { $('deathText').textContent = a; $('deathSub').textContent = b; UI.show('death'); },
};
