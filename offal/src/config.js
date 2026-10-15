// Shared constants, the story's floors, and how each floor gets harder.
export const TILE = 2; // metres per map cell
export const WALL_H = 3;
export const STORY_FLOORS = 10;

// The story goes down the way the line ran: receiving, stunning, bleeding... to the bottom, where it stops.
// size: tiles across. puzzles: what else stands between you and the lift (see puzzles.js).
const STORY = [
  { name: 'RECEIVING', quote: 'The trucks stopped coming in 1998. The deliveries didn’t.', lamp: 0xd8f0d0, fog: 0x020302,
    size: 32, rooms: 10, tags: 3, hunters: 1, chase: 4.3, puzzles: ['fuses'] },
  { name: 'STUNNING', quote: 'The bolt guns are still on their hooks. One of them is warm.', lamp: 0xc8d8ff, fog: 0x020205,
    size: 36, rooms: 11, tags: 4, hunters: 1, chase: 4.4, puzzles: ['keypad'] },
  { name: 'BLEEDING', quote: 'The drains on this floor never once ran clear.', lamp: 0xffb0a0, fog: 0x050101,
    size: 40, rooms: 12, tags: 4, hunters: 1, chase: 4.5, puzzles: ['scale'] },
  { name: 'SCALDING', quote: 'The tanks were kept hot enough to slip the skin right off.', lamp: 0xffd8a0, fog: 0x060402,
    size: 44, rooms: 13, tags: 5, hunters: 1, chase: 4.6, puzzles: ['valves'], fogBoost: 0.025 },
  { name: 'EVISCERATION', quote: 'Everything that is inside comes out here. Now there are two of him.', lamp: 0xff8070, fog: 0x070000,
    size: 46, rooms: 14, tags: 5, hunters: 2, chase: 4.6, puzzles: ['fuses', 'keypad'] },
  { name: 'RENDERING', quote: 'Nothing is wasted. Nothing. Nobody.', lamp: 0xffc070, fog: 0x050200,
    size: 48, rooms: 15, tags: 5, hunters: 2, chase: 4.7, puzzles: ['scale', 'valves'] },
  { name: 'THE COLD ROOM', quote: 'Somebody has been keeping count on the walls. The count is very high.', lamp: 0xb8d0ff, fog: 0x010205,
    size: 50, rooms: 16, tags: 6, hunters: 2, chase: 4.8, puzzles: ['keypad', 'fuses'] },
  { name: 'OFFAL PIT', quote: 'It is warmer down here. It smells like a kitchen.', lamp: 0xff6050, fog: 0x060000,
    size: 52, rooms: 16, tags: 6, hunters: 2, chase: 4.9, puzzles: ['valves', 'scale'] },
  { name: 'THE QUIET LINE', quote: 'You can hear the line running below you now. It sounds like breathing.', lamp: 0xd0c0a0, fog: 0x030201,
    size: 54, rooms: 17, tags: 6, hunters: 2, chase: 5.0, puzzles: ['keypad', 'valves', 'fuses'], deadLamps: 0.55 },
  { name: 'THE LINE', quote: 'This is where it all goes. Stop the line, and the shift is over.', lamp: 0xff4030, fog: 0x080000,
    size: 46, rooms: 13, tags: 0, hunters: 2, chase: 5.1, puzzles: ['breakers'], finale: true },
];

const DEEP = ['THE COLD ROOM', 'OFFAL PIT', 'BONE YARD', 'THE QUIET LINE', 'HIS OFFICE', 'FURTHER DOWN', 'WHERE THE DRAINS GO'];
const DEEP_QUOTES = [
  'There are no more floors on the plans.',
  'You can hear the line still running somewhere below.',
  'Somebody has been keeping count on the walls.',
  'It is warmer down here. It smells like a kitchen.',
  'Your tag is in your pocket. You checked. You keep checking.',
];

export function floorInfo(depth, mode = 'story') {
  if (mode === 'story' || depth <= 6) {
    const f = STORY[Math.min(depth, STORY_FLOORS) - 1];
    return { name: f.name, quote: f.quote, lamp: f.lamp, fog: f.fog, label: 'B' + depth };
  }
  const i = depth - 7;
  return { name: DEEP[i % DEEP.length], quote: DEEP_QUOTES[i % DEEP_QUOTES.length], lamp: [0xff6050, 0xd0c0a0, 0xff9070][i % 3], fog: 0x040000, label: 'B' + depth };
}

const PUZZLE_KINDS = ['fuses', 'keypad', 'scale', 'valves'];

// everything a floor needs to know about how hard it is
export function difficulty(depth, mode = 'story', rng = Math.random) {
  const d = depth - 1;
  const base = {
    hearing: 1 + d * 0.06,
    batteries: Math.max(2, 5 - Math.floor(d / 2)),
    adrenaline: d < 2 ? 1 : 2,
    deadLamps: Math.min(0.15 + d * 0.06, 0.55),
    gore: Math.min(d, 3),
    screamers: Math.min(d, 4),
    fogBoost: 0,
    finale: false,
  };
  if (mode === 'story') {
    const f = STORY[Math.min(depth, STORY_FLOORS) - 1];
    return { ...base, size: f.size, rooms: f.rooms, tags: f.tags, hunters: f.hunters, chaseSpeed: f.chase, puzzles: f.puzzles, finale: !!f.finale,
      fogBoost: f.fogBoost || 0, deadLamps: f.deadLamps ?? base.deadLamps };
  }
  // overtime: endless, and the puzzles are a lottery
  const puzzles = [];
  const n = depth >= 5 ? 2 : depth >= 2 ? 1 : 0;
  const pool = PUZZLE_KINDS.slice();
  for (let i = 0; i < n; i++) puzzles.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return {
    ...base,
    size: Math.min(26 + d * 4, 50),
    rooms: Math.min(7 + d, 16),
    tags: Math.min(3 + Math.floor((d + 1) / 2), 6),
    hunters: 1 + Math.floor(depth / 5),
    chaseSpeed: Math.min(4.35 + d * 0.13, 5.3),
    puzzles,
    fogBoost: depth === 4 ? 0.025 : 0,
  };
}
