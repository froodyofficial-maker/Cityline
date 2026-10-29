// Builds src/data/emoji.json from emojibase-data (run: node scripts/build-emoji.mjs).
// Each entry: [emoji, shortcodes[], keywords, group, skinTones[]?]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const data = require('emojibase-data/en/compact.json');
const iamcal = require('emojibase-data/en/shortcodes/iamcal.json');
const base = require('emojibase-data/en/shortcodes/emojibase.json');
const names = (hex) => {
  const out = [];
  for (const src of [iamcal, base]) {
    const v = src[hex];
    if (!v) continue;
    for (const n of Array.isArray(v) ? v : [v]) if (!out.includes(n)) out.push(n);
  }
  return out.slice(0, 4);
};
const groups = ['people', 'people', null, 'nature', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags'];
const out = data
  .filter((e) => e.group !== undefined && e.group !== 2)
  .sort((a, b) => a.order - b.order)
  .map((e) => {
    const n = names(e.hexcode);
    const row = [e.unicode, n.length ? n : [e.label.replace(/[^a-z0-9]+/gi, '_').toLowerCase()], (e.tags || []).join(' '), e.group];
    if (e.skins) row.push(e.skins.slice(0, 5).map((s) => s.unicode));
    return row;
  });
fs.writeFileSync(new URL('../src/data/emoji.json', import.meta.url), JSON.stringify(out));
console.log('wrote', out.length, 'emoji');
