// The crew room screen: who's in, who's ready, who's the Foreman. See net.js for the lobby itself.
import * as UI from './ui.js';
import { Lobby, Transport, CREW_MAX } from './net.js';

// a worker in coveralls, or the Foreman in his apron with the hook
const WORKER = '<svg viewBox="0 0 60 100"><ellipse cx="30" cy="97" rx="18" ry="3" fill="rgba(0,0,0,.6)"/><circle cx="30" cy="13" r="8" fill="#b8a48c"/><path d="M18 26q12-6 24 0l3 34h-8l-1 34h-7l-2-26-2 26h-7l-1-34h-8z" fill="#3a4a52"/><path d="M15 28l-5 30 5 1 5-26zM45 28l5 30-5 1-5-26z" fill="#33424a"/><rect x="24" y="34" width="12" height="8" fill="#8a1a10" opacity=".6"/></svg>';
const FOREMAN = '<svg viewBox="0 0 60 100"><ellipse cx="30" cy="97" rx="20" ry="3" fill="rgba(0,0,0,.6)"/><circle cx="30" cy="12" r="9" fill="#d8ccb4"/><circle cx="27" cy="11" r="1.6" fill="#c01008"/><circle cx="33" cy="11" r="1.6" fill="#c01008"/><path d="M14 26q16-8 32 0l4 36h-9l-2 32h-8l-1-24-1 24h-8l-2-32h-9z" fill="#2a1c18"/><path d="M19 30h22l3 46H16z" fill="#6a5a48"/><path d="M19 50q10 6 22-2v10q-12 6-22 0z" fill="#5a0a06" opacity=".8"/><path d="M48 30l6 30" stroke="#2a1c18" stroke-width="5"/><path d="M54 60q8 4 2 10q-4 2-6-2" fill="none" stroke="#9a9a98" stroke-width="2.5"/></svg>';

let lobby = null;
export function openLobby(save) {
  lobby ||= new Lobby(new Transport(), save.settings.crewName || 'WORKER');
  UI.$('crewName').value = lobby.me.name;
  draw();
  UI.only('lobby');
}
export function lobbyAct(act, el, save) {
  if (!lobby) return false;
  if (act === 'crewReady') lobby.me.ready = !lobby.me.ready;
  else if (act === 'crewTest') lobby.addTest();
  else if (act === 'crewKick') lobby.remove(el.dataset.id);
  else if (act === 'crewRole') lobby.setRole(el.dataset.id, el.dataset.role);
  else if (act === 'crewInvite') UI.message('Inviting friends needs Steam, and Steam multiplayer isn’t connected yet.', 3);
  else if (act === 'crewStart') UI.message('The crew shift needs Steam multiplayer, which isn’t connected yet.', 3);
  else return false;
  draw();
  void save;
  return true;
}
export function lobbyRename(name, save) {
  if (!lobby) return;
  lobby.rename(name);
  save.settings.crewName = lobby.me.name;
  draw();
}
function draw() {
  const L = lobby, f = L.foreman;
  UI.$('crewSub').textContent = `WAITING FOR THE NIGHT SHIFT · ${L.players.length}/${CREW_MAX} · ${f ? `${f.name} IS THE FOREMAN` : 'THE FOREMAN: THE GAME’S OWN'}`;
  let html = '';
  for (let i = 0; i < CREW_MAX; i++) {
    const p = L.players[i];
    if (!p) { html += '<div class="crew-slot empty"><span>WAITING…</span></div>'; continue; }
    const fm = p.role === 'foreman';
    const tags = [p.host ? '<i>HOST</i>' : '', p.local ? '<i>YOU</i>' : '', p.ready ? '<i class="rd">READY</i>' : ''].join('');
    const acts = L.isHost ? `<button data-act="crewRole" data-id="${p.id}" data-role="${fm ? 'worker' : 'foreman'}">${fm ? 'MAKE WORKER' : 'MAKE FOREMAN'}</button>${p.local ? '' : `<button data-act="crewKick" data-id="${p.id}">KICK</button>`}` : '';
    html += `<div class="crew-slot${fm ? ' foreman' : ''}">${fm ? FOREMAN : WORKER}<div class="tags">${tags}</div><div class="nm">${p.name}</div><div class="role">${fm ? 'THE FOREMAN' : 'WORKER'}</div><div class="acts">${acts}</div></div>`;
  }
  UI.$('crewSlots').innerHTML = html;
  UI.$('crewReady').classList.toggle('on', L.me.ready);
  UI.$('crewReady').textContent = L.me.ready ? 'READY ✓' : 'READY';
  const why = L.blocker();
  UI.$('crewStart').disabled = !!why;
  UI.$('crewWhy').textContent = why || '';
}
