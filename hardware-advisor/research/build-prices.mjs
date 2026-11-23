// Turns research/offers.tsv (one shop price per line, each with its page link) into prices.js.
// Run: node research/build-prices.mjs   (from hardware-advisor/)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CHECKED = '2026-11-23';          // when these shop pages were looked up (22–23 Nov 2026)
const CHECKED_LABEL = '22–23 Nov 2026';
const REF_RATES = { USD: 1, INR: 95.95 }; // only used to rank offers in other currencies

const offers = {};
for (const line of readFileSync(join(here, 'offers.tsv'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [id, store, price, cur, url, note = ''] = line.split('\t');
  const n = Number(price);
  if (!id || !store || !Number.isFinite(n) || !REF_RATES[cur] || !/^https:\/\//.test(url)) throw new Error('Bad line: ' + line);
  (offers[id] ||= []).push({ store, price: n, cur, url, note });
}
for (const id in offers) offers[id].sort((a, b) => a.price / REF_RATES[a.cur] - b.price / REF_RATES[b.cur]);

const out = `/* GearGuide shop prices: generated from research/offers.tsv by research/build-prices.mjs. Do not edit by hand.
   Every price was read from that shop's own page (linked in \`url\`) when it was looked up on ${CHECKED}.
   Prices change; live-prices.json (if present) replaces the Best Buy prices with live ones. */
window.GG_PRICES = ${JSON.stringify({ checked: CHECKED, checkedLabel: CHECKED_LABEL, refRates: REF_RATES, offers }, null, 1)};
`;
writeFileSync(join(here, '..', 'prices.js'), out);
console.log(`prices.js: ${Object.keys(offers).length} products, ${Object.values(offers).flat().length} shop prices`);
