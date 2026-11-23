// Fetches today's Best Buy prices for every product that has a Best Buy page in offers.tsv,
// using Best Buy's official Products API, and writes hardware-advisor/live-prices.json.
// The website loads that file and shows those prices as "Live", replacing the saved Best Buy price.
//
// Needs a free Best Buy developer key: https://developer.bestbuy.com  (set BESTBUY_API_KEY).
// Run: BESTBUY_API_KEY=... node research/update-live-prices.mjs   (from hardware-advisor/)
// The "Live prices" GitHub workflow runs this every day and commits the result.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const key = process.env.BESTBUY_API_KEY;
if (!key) {
  console.error('BESTBUY_API_KEY is not set, so no live prices were fetched. Get a free key at https://developer.bestbuy.com');
  process.exit(1);
}

// Best Buy SKUs appear in its page links as ".../6556754.p", "skuId=6556754" or ".../sku/6556754".
const skuOf = url => (url.match(/[?&]skuId=(\d{7,8})/) || url.match(/\/sku\/(\d{7,8})/) || url.match(/\/(\d{7,8})\.p/) || [])[1];
const wanted = new Map(); // sku -> product id
for (const line of readFileSync(join(here, 'offers.tsv'), 'utf8').split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  const [id, store, , , url] = line.split('\t');
  if (!store.startsWith('Best Buy') || !url.includes('bestbuy.com')) continue;
  const sku = skuOf(url);
  if (sku && ![...wanted.values()].includes(id)) wanted.set(sku, id);
}

const skus = [...wanted.keys()];
const prices = {};
for (let i = 0; i < skus.length; i += 50) {
  const batch = skus.slice(i, i + 50);
  const api = `https://api.bestbuy.com/v1/products(sku in(${batch.join(',')}))?format=json&pageSize=100&show=sku,salePrice,regularPrice,onlineAvailability&apiKey=${encodeURIComponent(key)}`;
  const res = await fetch(api);
  if (!res.ok) throw new Error(`Best Buy API answered ${res.status} ${res.statusText}`);
  const data = await res.json();
  for (const p of data.products || []) {
    const id = wanted.get(String(p.sku));
    if (!id || typeof p.salePrice !== 'number') continue;
    prices[id] = [{
      store: 'Best Buy', price: p.salePrice, cur: 'USD',
      url: `https://www.bestbuy.com/site/${p.sku}.p?skuId=${p.sku}`,
      note: (p.onlineAvailability ? '' : 'out of stock online; ') + (p.regularPrice > p.salePrice ? `was ${p.regularPrice}` : 'regular price'),
    }];
  }
  await new Promise(r => setTimeout(r, 600)); // stay well under the API's per-second limit
}

const out = { updated: new Date().toISOString(), source: 'Best Buy Products API', prices };
writeFileSync(join(here, '..', 'live-prices.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`live-prices.json: ${Object.keys(prices).length} of ${skus.length} Best Buy products updated`);
