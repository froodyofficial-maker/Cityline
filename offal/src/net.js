// Crew mode: two to four workers on one floor, and maybe one of them is the Foreman. The networking will
// be Steam's (lobbies, invites, packets); this is everything that doesn't depend on it: the lobby itself,
// who plays the Foreman, how a floor grows with the crew, and the transport Steam has to fill in.
export const CREW_MIN = 2, CREW_MAX = 4;

// how a floor grows with the crew: n workers (not counting a player Foreman)
export function crewScale(n) {
  const k = Math.max(0, Math.min(CREW_MAX, n) - 1);
  return { size: 1 + 0.18 * k, rooms: 1 + 0.2 * k, tags: 1 + 0.5 * k, batteries: 1 + 0.5 * k, adrenaline: 1 + 0.5 * k, extraPuzzle: k >= 2 };
}
export function applyCrew(D, n) {
  const s = crewScale(n), r = Math.round;
  return { size: r(D.size * s.size), rooms: r(D.rooms * s.rooms), tags: r(D.tags * s.tags), batteries: r(D.batteries * s.batteries), adrenaline: r(D.adrenaline * s.adrenaline) };
}

// what Steam has to provide. Until it's wired in, nothing is available and the lobby stays local.
export class Transport {
  get available() { return false; }
  get name() { return 'STEAM'; }
  createLobby() { return Promise.reject(new Error('Steam multiplayer is not connected yet')); }
  invite() {}
  join() { return Promise.reject(new Error('Steam multiplayer is not connected yet')); }
  leave() {}
  send() {}
  onMessage() {}
}

let nextId = 1;
export class Lobby {
  constructor(transport, myName) {
    this.transport = transport;
    this.players = [{ id: 'me', name: myName || 'WORKER', host: true, local: true, ready: false, role: 'worker' }];
  }
  get me() { return this.players.find((p) => p.local); }
  get isHost() { return this.me.host; }
  get foreman() { return this.players.find((p) => p.role === 'foreman') || null; }
  get workers() { return this.players.filter((p) => p.role === 'worker'); }
  rename(name) { this.me.name = (name || '').trim().slice(0, 16).toUpperCase() || 'WORKER'; }
  // an offline stand-in, so the room can be laid out and tried before Steam is in
  addTest() {
    if (this.players.length >= CREW_MAX) return;
    const names = ['GRISTLE', 'M. KOWALSKI', 'NIGHTJAR', 'TALLOW', 'D. OKAFOR', 'BONEMEAL'];
    this.players.push({ id: 't' + nextId++, name: names[(nextId + this.players.length) % names.length], host: false, local: false, ready: true, role: 'worker', test: true });
  }
  remove(id) { if (this.isHost) this.players = this.players.filter((p) => p.id !== id || p.local); }
  // the host picks the Foreman: one player, or nobody (then he's the game's own)
  setRole(id, role) {
    if (!this.isHost) return;
    for (const p of this.players) if (role === 'foreman' && p.role === 'foreman') p.role = 'worker';
    const p = this.players.find((q) => q.id === id);
    if (p) p.role = role;
  }
  // why the shift can't start yet, or null
  blocker() {
    if (this.players.length < CREW_MIN) return `NEED AT LEAST ${CREW_MIN} PLAYERS`;
    if (this.workers.length < 1) return 'SOMEBODY HAS TO BE A WORKER';
    if (this.players.some((p) => !p.ready)) return 'WAITING FOR EVERYONE TO BE READY';
    if (!this.transport.available) return `${this.transport.name} MULTIPLAYER ISN’T CONNECTED YET`;
    return null;
  }
}
