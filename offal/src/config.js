// Shared constants, floor names and how each floor gets harder.
export const TILE = 2; // metres per map cell
export const WALL_H = 3;

// the plant goes down the way the line ran: receiving, stunning, bleeding...
export const FLOORS = [
  { name: 'RECEIVING', quote: 'The trucks stopped coming in 1998. The deliveries didn’t.', lamp: 0xd8f0d0, fog: 0x020302 },
  { name: 'STUNNING', quote: 'The bolt guns are still on their hooks. One of them is warm.', lamp: 0xc8d8ff, fog: 0x020205 },
  { name: 'BLEEDING', quote: 'The drains on this floor never once ran clear.', lamp: 0xffb0a0, fog: 0x050101 },
  { name: 'SCALDING', quote: 'The tanks were kept hot enough to slip the skin right off.', lamp: 0xffd8a0, fog: 0x060402 },
  { name: 'EVISCERATION', quote: 'Everything that is inside comes out here.', lamp: 0xff8070, fog: 0x070000 },
  { name: 'RENDERING', quote: 'Nothing is wasted. Nothing. Nobody.', lamp: 0xffc070, fog: 0x050200 },
];
const DEEP = ['THE COLD ROOM', 'OFFAL PIT', 'BONE YARD', 'THE QUIET LINE', 'HIS OFFICE', 'FURTHER DOWN', 'WHERE THE DRAINS GO'];
const DEEP_QUOTES = [
  'There are no more floors on the plans.',
  'You can hear the line still running somewhere below.',
  'Somebody has been keeping count on the walls.',
  'It is warmer down here. It smells like a kitchen.',
  'Your tag is in your pocket. You checked. You keep checking.',
];

export function floorInfo(depth) {
  if (depth <= FLOORS.length) return { ...FLOORS[depth - 1], label: 'B' + depth };
  const i = depth - FLOORS.length - 1;
  return { name: DEEP[i % DEEP.length], quote: DEEP_QUOTES[i % DEEP_QUOTES.length], lamp: [0xff6050, 0xd0c0a0, 0xff9070][i % 3], fog: 0x040000, label: 'B' + depth };
}

export function difficulty(depth) {
  const d = depth - 1;
  return {
    size: Math.min(26 + d * 4, 50), // tiles across
    rooms: Math.min(7 + d, 16),
    tags: Math.min(3 + Math.floor((d + 1) / 2), 6),
    hunters: 1 + Math.floor(depth / 5),
    chaseSpeed: Math.min(4.35 + d * 0.13, 5.3),
    hearing: 1 + d * 0.08,
    batteries: Math.max(2, 5 - Math.floor(d / 2)),
    bandages: d < 2 ? 1 : 2,
    deadLamps: Math.min(0.15 + d * 0.08, 0.6),
    gore: Math.min(d, 3), // how bloody the walls get
    screamers: Math.min(d, 4), // hanging bodies that aren't quite dead
  };
}
