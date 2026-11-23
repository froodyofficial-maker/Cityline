// Fetches today's prices from shops that offer an official price service, and writes
// hardware-advisor/live-prices.json. The website loads that file and shows those prices as "Live",
// replacing the saved price from the same shop.
//
//  - Best Buy (US, in US dollars): Best Buy Products API, for every product with a Best Buy page in
//    offers.tsv. Needs a free key from https://developer.bestbuy.com  -> BESTBUY_API_KEY
//  - Flipkart (India, in rupees): Flipkart Affiliate API keyword search, for every product.
//    Needs a free Flipkart affiliate account (https://affiliate.flipkart.com): your affiliate ID
//    and API token -> FLIPKART_AFFILIATE_ID and FLIPKART_AFFILIATE_TOKEN
//
// Each shop runs only when its keys are set. Run from hardware-advisor/:
//   BESTBUY_API_KEY=... FLIPKART_AFFILIATE_ID=... FLIPKART_AFFILIATE_TOKEN=... node research/update-live-prices.mjs
// The "GearGuide live prices" GitHub workflow runs this every day and commits the result.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const BB_KEY = process.env.BESTBUY_API_KEY;
const FK_ID = process.env.FLIPKART_AFFILIATE_ID, FK_TOKEN = process.env.FLIPKART_AFFILIATE_TOKEN;
if (!BB_KEY && !(FK_ID && FK_TOKEN)) {
  console.error('No shop keys set (BESTBUY_API_KEY, or FLIPKART_AFFILIATE_ID + FLIPKART_AFFILIATE_TOKEN), so no live prices were fetched.');
  process.exit(1);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Product names from the catalogue (data.js defines window.LOADOUT).
globalThis.window = {};
new Function(readFileSync(join(root, 'data.js'), 'utf8'))();
const PRODUCTS = window.LOADOUT.PRODUCTS;

// Keep the last good prices from a shop whose key isn't set this run.
const old = existsSync(join(root, 'live-prices.json')) ? JSON.parse(readFileSync(join(root, 'live-prices.json'), 'utf8')) : { prices: {} };
const prices = {};
const put = (id, offer) => { (prices[id] ||= []).push(offer); };
const keepOld = store => { for (const id in old.prices) for (const o of old.prices[id]) if (o.store === store) put(id, o); };
const sources = [];

/* ---------- Best Buy (US) ---------- */
if (BB_KEY) {
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
  let n = 0;
  for (let i = 0; i < skus.length; i += 50) {
    const batch = skus.slice(i, i + 50);
    const api = `https://api.bestbuy.com/v1/products(sku in(${batch.join(',')}))?format=json&pageSize=100&show=sku,salePrice,regularPrice,onlineAvailability&apiKey=${encodeURIComponent(BB_KEY)}`;
    const res = await fetch(api);
    if (!res.ok) throw new Error(`Best Buy API answered ${res.status} ${res.statusText}`);
    const data = await res.json();
    for (const p of data.products || []) {
      const id = wanted.get(String(p.sku));
      if (!id || typeof p.salePrice !== 'number') continue;
      put(id, {
        store: 'Best Buy', region: 'US', price: p.salePrice, cur: 'USD',
        url: `https://www.bestbuy.com/site/${p.sku}.p?skuId=${p.sku}`,
        note: (p.onlineAvailability ? '' : 'out of stock online; ') + (p.regularPrice > p.salePrice ? `was ${p.regularPrice}` : 'regular price'),
      });
      n++;
    }
    await sleep(600); // stay well under the API's per-second limit
  }
  sources.push('Best Buy Products API');
  console.log(`Best Buy: ${n} of ${skus.length} products`);
} else keepOld('Best Buy');

/* ---------- Flipkart (India) ---------- */
if (FK_ID && FK_TOKEN) {
  // A search result only counts if its title names the brand and every word and number of the model,
  // so "G Pro X Superlight 2" never matches the older Superlight.
  const words = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(w => w.length > 1 || /\d/.test(w));
  const matches = (title, p) => { const t = ' ' + words(title).join(' ') + ' '; return [...words(p.brand), ...words(p.name)].every(w => t.includes(' ' + w + ' ')); };
  const amount = x => (x && typeof x.amount === 'number' ? x.amount : null);
  let n = 0;
  for (const p of PRODUCTS) {
    const q = encodeURIComponent(`${p.brand} ${p.name}`);
    const res = await fetch(`https://affiliate-api.flipkart.net/affiliate/1.0/search.json?query=${q}&resultCount=10`, {
      headers: { 'Fk-Affiliate-Id': FK_ID, 'Fk-Affiliate-Token': FK_TOKEN },
    });
    if (res.status === 401 || res.status === 403) throw new Error(`Flipkart rejected the affiliate ID or token (${res.status})`);
    if (res.ok) {
      const data = await res.json();
      const items = (data.products || data.productInfoList || []).map(x => x.productBaseInfoV1 || (x.productBaseInfo && x.productBaseInfo.productAttributes) || x);
      const hit = items.find(b => b && b.title && b.inStock !== false && matches(b.title, p)
        && (amount(b.flipkartSpecialPrice) || amount(b.flipkartSellingPrice)));
      if (hit) {
        const price = amount(hit.flipkartSpecialPrice) || amount(hit.flipkartSellingPrice);
        const mrp = amount(hit.maximumRetailPrice);
        put(p.id, {
          store: 'Flipkart', region: 'IN', price, cur: 'INR', url: hit.productUrl,
          note: mrp && mrp > price ? `MRP ${mrp}` : 'regular price',
        });
        n++;
      }
    }
    await sleep(250); // Flipkart allows 20 calls a second; this is far below it
  }
  sources.push('Flipkart Affiliate API');
  console.log(`Flipkart: ${n} of ${PRODUCTS.length} products`);
} else keepOld('Flipkart');

const out = { updated: new Date().toISOString(), source: sources.join(' + '), prices };
writeFileSync(join(root, 'live-prices.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`live-prices.json written (${Object.keys(prices).length} products)`);
