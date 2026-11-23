/* GearGuide: scores every product against the user's games, body, setup and budget,
   then explains the score. Popularity (`pop`) is display-only. */
(() => {
  const { DIMS, CATEGORIES, PLATFORMS, GAMES, PRODUCTS, GLOSSARY } = window.LOADOUT;
  const art = window.LOADOUT_ART;
  const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  const GAME = Object.fromEntries(GAMES.map(g => [g.id, g]));
  const PROD = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const STORE = 'gearguide-prefs-v2';

  const OPTIONS = {
    hand: [['S', 'Small (under 17 cm)'], ['M', 'Medium (17–19 cm)'], ['L', 'Large (over 19 cm)']],
    handed: [['right', 'Right'], ['left', 'Left'], ['both', 'Both']],
    weight: [['light', 'Lightweight (40–60 g)'], ['balanced', 'Balanced (60–90 g)'], ['heavy', 'Heavier (90 g+)'], ['any', 'No preference']],
    grip: [['palm', 'Palm'], ['claw', 'Claw'], ['fingertip', 'Fingertip'], ['unsure', 'Not sure']],
    desk: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']],
    conn: [['any', 'Wired or wireless'], ['wireless', 'Wireless only'], ['wired', 'Prefer wired']],
  };
  const HAND_WORD = { S: 'small', M: 'medium', L: 'large' };
  const LAYOUT_WORD = { full: 'full-size', tkl: 'tenkeyless', 75: '75%', 65: '65%', 60: '60%' };
  const handFromCm = cm => cm < 17 ? 'S' : cm <= 19 ? 'M' : 'L';

  // Budget brackets per category in USD; [low, high], with null meaning no upper limit.
  const BUDGETS = {
    mouse: [[0, 15], [15, 30], [30, 60], [60, 100], [100, 150], [150, null]],
    mousepad: [[0, 15], [15, 25], [25, 40], [40, 70], [70, null]],
    keyboard: [[0, 60], [60, 120], [120, 180], [180, 260], [260, null]],
    headset: [[0, 60], [60, 120], [120, 200], [200, 300], [300, null]],
    monitor: [[0, 200], [200, 350], [350, 700], [700, 1200], [1200, null]],
    controller: [[0, 60], [60, 120], [120, 220], [220, null]],
  };
  const DEFAULT_BUDGET = { mouse: 3, mousepad: 1, keyboard: 2, headset: 2, monitor: 2, controller: 1 };
  const budgetCap = cat => BUDGETS[cat][state.budget[cat]][1] ?? Infinity;
  const budgetLow = cat => BUDGETS[cat][state.budget[cat]][0];

  // Exchange rates per 1 USD. The fallback is the ECB fixing of 15 Oct 2026 (via Banque de France);
  // live rates from the ECB (via Frankfurter) replace it when the browser can reach them.
  const CURRENCY_NAMES = {
    USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', CAD: 'Canadian dollar', AUD: 'Australian dollar', JPY: 'Japanese yen',
    INR: 'Indian rupee', BRL: 'Brazilian real', MXN: 'Mexican peso', PLN: 'Polish zloty', SEK: 'Swedish krona', NOK: 'Norwegian krone',
    DKK: 'Danish krone', CHF: 'Swiss franc', NZD: 'New Zealand dollar', SGD: 'Singapore dollar', KRW: 'South Korean won',
    ZAR: 'South African rand', TRY: 'Turkish lira', CNY: 'Chinese yuan', HKD: 'Hong Kong dollar', CZK: 'Czech koruna',
  };
  // INR is not in that fixing; its fallback is the market rate of 16 Sep 2026.
  let fx = { live: false, date: '2026-10-15', dates: { INR: '2026-09-16' }, rates: { USD: 1, EUR: .8922, GBP: .7549, JPY: 157.98, CAD: 1.4207, AUD: 1.4470, INR: 95.95 } };
  const LOCALE = { INR: 'en-IN' };
  const REGION_CURRENCY = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', JP: 'JPY', IN: 'INR', BR: 'BRL', MX: 'MXN', PL: 'PLN', SE: 'SEK', NO: 'NOK', DK: 'DKK', CH: 'CHF', NZ: 'NZD', SG: 'SGD', KR: 'KRW', ZA: 'ZAR', TR: 'TRY', CN: 'CNY', HK: 'HKD', CZ: 'CZK',
    DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR', SK: 'EUR', SI: 'EUR', LT: 'EUR', LV: 'EUR', EE: 'EUR', HR: 'EUR', LU: 'EUR' };
  function guessCurrency() {
    try {
      const region = new Intl.Locale(navigator.language).maximize().region;
      return REGION_CURRENCY[region] || 'USD';
    } catch { return 'USD'; }
  }

  const DEFAULTS = {
    onboarded: false,
    games: [],
    cats: ['mouse', 'keyboard', 'monitor'],
    view: 'mouse',
    budget: { ...DEFAULT_BUDGET },
    platforms: ['pc'],
    hand: 'M', grip: 'unsure', handed: 'right', weight: 'any',
    desk: 'medium', conn: 'any',
    glasses: false, long: false, quiet: false,
    sort: 'match',
    detail: false, // beginners start with the simple card view
    currency: guessCurrency(),
  };

  let state = load();

  function load() {
    const base = structuredClone(DEFAULTS);
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved && typeof saved === 'object') {
        Object.assign(base, saved, { budget: { ...base.budget, ...(saved.budget || {}) } });
        base.games = (base.games || []).filter(id => GAME[id]);
        base.cats = (base.cats || []).filter(id => CAT[id]);
        base.platforms = (base.platforms || []).filter(id => PLATFORMS[id]);
        for (const c in BUDGETS) if (!BUDGETS[c][base.budget[c]]) base.budget[c] = DEFAULT_BUDGET[c];
        if (!base.cats.length) base.cats = [...DEFAULTS.cats];
        if (!base.cats.includes(base.view)) base.view = base.cats[0];
      }
    } catch { /* storage unavailable: use defaults */ }
    return base;
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ } }

  /* ---------------- text helpers ---------------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rate = () => fx.rates[state.currency] || 1;
  const cur = () => fx.rates[state.currency] ? state.currency : 'USD';
  const fmt = (n, exact) => new Intl.NumberFormat(LOCALE[cur()] || 'en-US', { style: 'currency', currency: cur(), maximumFractionDigits: exact ? undefined : 0 }).format(n * rate());
  const money = n => fmt(n, false);
  const moneyExact = n => fmt(n, state.currency === 'USD');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // Round a converted amount to two significant figures; `up` rounds up (for upper limits), else down.
  function roundMoney(usd, up) {
    const v = usd * rate();
    if (v < 10) return fmt(usd, false);
    const step = 10 ** (Math.floor(Math.log10(v)) - 1);
    const r = (up ? Math.ceil(v / step) : Math.floor(v / step)) * step;
    return new Intl.NumberFormat(LOCALE[cur()] || 'en-US', { style: 'currency', currency: cur(), maximumFractionDigits: 0 }).format(r);
  }
  function bracketLabel(cat, i) {
    const [lo, hi] = BUDGETS[cat][i];
    if (!lo) return `Under ${roundMoney(hi, true)}`;
    if (hi == null) return `${roundMoney(lo, false)} and up`;
    return `${roundMoney(lo, false)} – ${roundMoney(hi, true)}`;
  }
  function list(items, max = 2) {
    if (items.length <= 1) return items.join('');
    if (items.length <= max) return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
    return items.slice(0, max).join(', ') + ` and ${items.length - max} more`;
  }

  /* ---------------- scoring ---------------- */
  // Blend mean and max so one demanding game isn't drowned out by casual ones.
  function computeNeeds() {
    const games = state.games.map(id => GAME[id]);
    const needs = {};
    if (!games.length) {
      for (const d in DIMS) needs[d] = d === 'racing' ? .1 : .45;
      return needs;
    }
    for (const d in DIMS) {
      const vals = games.map(g => g.needs[d] || 0);
      needs[d] = .5 * (vals.reduce((a, b) => a + b, 0) / vals.length) + .5 * Math.max(...vals);
    }
    return needs;
  }

  // Selected games that care most about a dimension, by name.
  function gamesFor(d) {
    return state.games.map(id => GAME[id]).filter(g => (g.needs[d] || 0) >= .5)
      .sort((a, b) => (b.needs[d] || 0) - (a.needs[d] || 0)).map(g => g.name);
  }

  const consoleOnly = () => state.platforms.length > 0 && !state.platforms.includes('pc');

  function compatibility(p) {
    if (p.platforms && state.platforms.length) {
      const relevant = p.cat === 'controller' || (p.cat === 'headset' && p.wireless);
      if (relevant && !p.platforms.some(x => state.platforms.includes(x)))
        return `doesn't support ${list(state.platforms.map(x => PLATFORMS[x]), 3)}`;
    }
    if (p.cat === 'mouse' && state.handed !== 'right' && p.handed === 'right') return 'right-hand-only shape';
    return null;
  }

  function gameFit(p, needs) {
    let num = 0, den = 0;
    for (const d in p.traits) {
      let w = needs[d] || 0;
      if (p.cat === 'monitor' && d === 'speed' && consoleOnly()) w *= .4; // consoles cap at 120 Hz
      num += w * p.traits[d]; den += w;
    }
    if (den < .15) return .6; // your games don't ask this product for anything, so it can't rank on game fit
    return num / den;
  }

  // Spread raw fits (mostly .45 to .98) over the full range so real differences show up in the score.
  const sharpen = g => Math.max(0, Math.min(1, .25 + .75 * (g - .45) / .53));
  const meanTrait = p => { const t = Object.values(p.traits); return t.reduce((x, y) => x + y, 0) / t.length; };
  /* ---------------- shop prices ----------------
     Every product carries the prices we found on real shop pages (prices.js, each with its link and the
     date it was checked). live-prices.json, refreshed daily from Best Buy's official API, replaces the
     Best Buy price with today's. A product's price for matching is the lowest new, in-stock offer. */
  const SAVED = window.GG_PRICES || { offers: {}, refRates: { USD: 1 }, checkedLabel: '' };
  let LIVE = null; // { updated, source, prices }
  const NOT_NEW = /refurb|renewed|open-box|out of stock|sold out|unavailable/i;
  const offerUSD = o => o.price / (fx.rates[o.cur] || SAVED.refRates[o.cur] || 1);
  // Where the visitor shops: picking rupees means shopping in India, so Indian shops come first.
  const REGION_NAME = { IN: 'India', US: 'the US' };
  const shopRegion = () => state.currency === 'INR' ? 'IN' : 'US';
  const offerRegion = o => o.region || (o.cur === 'INR' ? 'IN' : 'US');
  function applyOffers() {
    for (const p of PRODUCTS) {
      p.catalogPrice ??= p.price;
      let list = (SAVED.offers[p.id] || []).map(o => ({ ...o, live: false }));
      const live = LIVE && LIVE.prices[p.id];
      if (live) list = [...list.filter(o => !live.some(l => l.store === o.store)), ...live.map(o => ({ ...o, live: true }))];
      const here = shopRegion();
      list.sort((a, b) => (offerRegion(a) !== here) - (offerRegion(b) !== here) || offerUSD(a) - offerUSD(b));
      p.offers = list;
      const usable = list.filter(o => !NOT_NEW.test(o.note || ''));
      const local = usable.filter(o => offerRegion(o) === here);
      const best = local[0] || usable.slice().sort((a, b) => offerUSD(a) - offerUSD(b))[0] || list[0];
      p.price = best ? Math.round(offerUSD(best) * 100) / 100 : p.catalogPrice;
      p.bestOffer = best || null;
    }
    for (const c in MAX_PRICE) delete MAX_PRICE[c];
    for (const p of PRODUCTS) MAX_PRICE[p.cat] = Math.max(MAX_PRICE[p.cat] || 0, p.price);
  }
  // Show a shop's price in the visitor's currency; a price in another currency shows its original too.
  function offerMoney(o) {
    if (o.cur === cur()) return new Intl.NumberFormat(LOCALE[cur()] || 'en-US', { style: 'currency', currency: o.cur, maximumFractionDigits: o.cur === 'USD' ? 2 : 0 }).format(o.price);
    const here = money(offerUSD(o));
    if (o.cur === 'USD') return here;
    return `${here} <small class="orig">(${new Intl.NumberFormat('en-IN', { style: 'currency', currency: o.cur, maximumFractionDigits: 0 }).format(o.price)})</small>`;
  }
  const ago = iso => {
    const h = Math.max(0, Math.round((Date.now() - new Date(iso)) / 36e5));
    return h < 1 ? 'less than an hour ago' : h < 48 ? `${h} hour${h === 1 ? '' : 's'} ago` : `${Math.round(h / 24)} days ago`;
  };
  const whereLine = p => p.bestOffer ? `lowest price we found, at ${p.bestOffer.store}${p.bestOffer.live ? ' (live)' : ''}` : 'typical price';
  async function loadLivePrices() {
    if (location.protocol === 'file:') return; // browsers can't fetch files next to a page opened from disk
    try {
      const res = await fetch('live-prices.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.prices || !data.updated) return;
      LIVE = data;
      applyOffers();
      renderCurrency();
      if (!$('#dashboard').hidden) renderResults();
      if (!$('#product').hidden) { const id = productId(); if (id) renderProduct(id); }
    } catch { /* opened from a file, or no live prices yet: keep the checked shop prices */ }
  }

  const MAX_PRICE = {};
  applyOffers();

  // How much your games lean on this kind of product at all (0 to 1).
  function relevance(cat, needs) {
    const dims = cat.id === 'controller' ? ['pad', 'racing'] : cat.dims;
    return Math.max(...dims.map(d => needs[d] || 0));
  }

  // Each comfort factor returns a 0-1 score and optionally a pro or a con worded for the user.
  function comfort(p) {
    const f = [];
    const add = (score, pro, con) => f.push({ score, pro, con });
    const s = state;

    if ('wireless' in p && !p.wheel) {
      if (s.conn === 'wireless' && !p.wireless) add(.35, null, 'Wired only, but you asked for wireless');
      else if (s.conn === 'wireless') add(1, 'Wireless, as you asked');
      else if (s.conn === 'wired' && p.wireless) add(.8, null, "Wireless, so you'll need to keep it charged");
      else if (s.conn === 'wired') add(1, 'Wired, so no batteries to manage');
    }

    if (p.cat === 'mouse') {
      const order = ['S', 'M', 'L'];
      if (p.sizes.includes(s.hand)) add(1, `Sized for ${HAND_WORD[s.hand]} hands like yours`);
      else {
        const dist = Math.min(...p.sizes.map(z => Math.abs(order.indexOf(z) - order.indexOf(s.hand))));
        const bigger = order.indexOf(p.sizes[0]) > order.indexOf(s.hand);
        add(dist === 1 ? .6 : .25, null, `Shaped for ${list(p.sizes.map(z => HAND_WORD[z]))} hands, so it may feel ${bigger ? 'big' : 'small'} for yours`);
      }
      if (s.grip !== 'unsure') {
        if (p.grips.includes(s.grip)) add(1, `Suits your ${s.grip} grip`);
        else add(.55, null, `Not designed around ${s.grip} grip (it suits ${list(p.grips)})`);
      }
      if (s.handed === 'left') {
        if (p.handed === 'ambi') add(1, 'Ambidextrous, with side buttons on both sides');
        else add(.7, null, "Symmetric shape, but the side buttons sit under your pinky when you use it left-handed");
      }
      if (s.handed === 'both') {
        if (p.handed === 'ambi') add(1, 'Ambidextrous, so it works in either hand with side buttons on both sides');
        else add(.75, null, 'Symmetric shape works in either hand, but the side buttons are on the left only');
      }
      const w = p.weight;
      if (w == null) { /* weight unknown: skip the weight preference */ } else {
      if (s.weight === 'light') w <= 62 ? add(1, `${w} g, in your 40–60 g range`) : add(w <= 80 ? .65 : .3, null, `${w} g is heavier than your 40–60 g preference`);
      if (s.weight === 'balanced') w >= 58 && w <= 92 ? add(1, `${w} g, in your 60–90 g range`) : add(.7, null, `${w} g is ${w < 60 ? 'lighter' : 'heavier'} than the 60–90 g you want`);
      if (s.weight === 'heavy') w >= 90 ? add(1, `${w} g, the planted feel you like`) : add(w >= 70 ? .75 : .5, null, `${w} g may feel floaty if you like some heft`);
      }
      if (s.long && p.handed === 'right' && (s.grip === 'palm' || s.grip === 'unsure') && s.handed === 'right') add(1, 'Ergonomic hump supports long palm-grip sessions');
    }

    if (p.cat === 'keyboard') {
      const compact = ['75', '65', '60'].includes(p.layout);
      if (s.desk === 'small') compact ? add(1, `Compact ${LAYOUT_WORD[p.layout]} layout leaves room for your mouse`) : add(p.layout === 'tkl' ? .75 : .3, null, `A ${LAYOUT_WORD[p.layout]} board takes up a lot of a small desk`);
      if (s.desk === 'medium' && p.layout === 'full') add(.7, null, 'Full-size, so it crowds mouse space on a medium desk');
      if (s.quiet) p.noise >= .75 ? add(1, 'Quiet typing, easier to use around others') : add(Math.max(.25, p.noise), null, p.noise < .5 ? 'Loud switches, not great around others' : 'Moderate key noise; others may notice');
      if (s.long) p.wristRest ? add(1, 'Wrist rest included for long sessions') : add(.75, null, 'No wrist rest in the box; consider adding one for long sessions');
    }

    if (p.cat === 'headset') {
      if (s.glasses) {
        if (p.clamp === 'light') add(1, 'Gentle clamp, kinder to glasses');
        else if (p.clamp === 'medium') add(.7, null, 'Moderate clamp; glasses may press after a few hours');
        else add(.35, null, 'Firm clamp can press glasses into your head');
      }
      if (s.long) {
        if (p.weight <= 300) add(1, `${p.weight} g, light enough for long sessions`);
        else if (p.weight <= 350) add(.8);
        else add(.4, null, `${p.weight} g can get tiring over long sessions`);
      }
      if (s.quiet) p.back === 'open' ? add(.3, null, 'Open-back leaks sound to people nearby') : add(1, 'Closed-back keeps your audio from disturbing others');
      if (p.wireless && p.platforms && state.platforms.length) {
        const missing = state.platforms.filter(x => !p.platforms.includes(x));
        if (missing.length) add(.75, null, `Wireless won't work on your ${list(missing.map(x => PLATFORMS[x]), 3)} (wired mode may)`);
      }
    }

    if (p.cat === 'monitor') {
      const z = p.size;
      if (s.desk === 'small') z <= 24.5 ? add(1, `${z}" fits a small desk`) : add(z <= 27 ? .75 : z <= 32 ? .4 : .1, null, `${z}" is ${z > 32 ? 'far too big' : 'large'} for a small desk`);
      if (s.desk === 'medium' && z > 34) add(.35, null, `${z}" needs a large, deep desk`);
      if (s.desk === 'medium' && z <= 32 && z >= 27) add(1, `${z}" suits a medium desk`);
      if (s.desk === 'large' && z >= 32) add(1, `Makes good use of your large desk`);
      if (state.platforms.some(x => x === 'ps' || x === 'xbox')) {
        p.hdmi21 ? add(1, 'HDMI 2.1 gives your console its full 4K/120 Hz')
          : add(.7, null, "No HDMI 2.1, so your console can't use its highest modes");
      }
    }

    if (p.cat === 'mousepad') {
      const w = p.w;
      if (s.desk === 'small') w <= 360 ? add(1, `${p.w} × ${p.h} mm fits a small desk`) : w <= 480 ? add(.75, null, `${p.w} mm wide is a tight fit on a small desk`) : add(.3, null, `${p.w} mm wide is too wide for a small desk`);
      if (s.desk === 'medium') w >= 420 && w <= 500 ? add(1, 'A roomy size that still fits a medium desk') : w < 420 ? add(.7, null, 'Compact, so big arm sweeps may run off the edge') : add(.6, null, `${p.w} mm wide is wide for a medium desk`);
      if (s.desk === 'large') w >= 900 ? add(1, 'Covers keyboard and mouse like a desk mat on your large desk') : w >= 450 ? add(.85) : add(.65, null, 'Small for a large desk, which has room for a bigger pad');
      if (s.long) p.thick >= 4 ? add(1, `${p.thick} mm thick, which cushions your wrist`) : add(.65, null, `Only ${p.thick} mm thick, so a wrist rest may help in long sessions`);
    }

    if (p.cat === 'controller') {
      if (p.wheel) {
        if (s.desk === 'small') add(.3, null, 'A wheel needs a sturdy desk edge and floor space for pedals');
        else add(1, 'Your desk has room to clamp a wheel');
      } else {
        if (s.hand === 'S' && p.weight > 320) add(.6, null, `Heavier (${p.weight} g), which can tire smaller hands`);
        if (s.hand === 'L' && p.weight < 250) add(.8, null, 'Compact, so it may feel small in large hands');
      }
      if (state.platforms.length) {
        const ok = state.platforms.filter(x => p.platforms.includes(x));
        if (ok.length === state.platforms.length && ok.length > 1) add(1, `Works with all your platforms (${list(ok.map(x => PLATFORMS[x]), 4)})`);
        else if (ok.length < state.platforms.length) add(.8, null, `Doesn't work on your ${list(state.platforms.filter(x => !ok.includes(x)).map(x => PLATFORMS[x]), 3)}`);
      }
    }

    const scored = f.filter(x => x.score != null);
    const score = scored.length ? scored.reduce((a, x) => a + x.score, 0) / scored.length : .85;
    return { score, pros: f.map(x => x.pro).filter(Boolean), cons: f.map(x => x.con).filter(Boolean) };
  }

  function evaluate(p, needs) {
    const budget = budgetCap(p.cat), low = budgetLow(p.cat);
    const within = p.price <= budget;
    const g = sharpen(gameFit(p, needs));
    const c = comfort(p);
    const b = within ? 1 : Math.max(0, 1 - 2 * (p.price - budget) / budget);
    // Value: cheaper inside your range scores higher, measured against the top of your range.
    const ref = Number.isFinite(budget) ? budget : MAX_PRICE[p.cat];
    const v = within ? 1 - .45 * Math.min(1, p.price / ref) : 0;
    // The more your games lean on this product type, the more game fit counts. If they barely do,
    // comfort and value decide, so the answer follows you instead of one all-rounder winning everywhere.
    const rel = relevance(CAT[p.cat], needs);
    const wG = .12 + .48 * rel, wC = state.long ? .3 : .26, wB = .08, wQ = .08;
    const wV = Math.max(0, 1 - wG - wC - wB - wQ);
    const match = Math.round(Math.min(98, Math.max(20, 100 * (wG * g + wC * c.score + wB * b + wQ * meanTrait(p) + wV * v))));

    // Why it fits: game reasons first, ranked by how much each dimension mattered.
    const why = [], warn = [];
    const dims = Object.keys(p.traits).sort((a, b) => needs[b] * p.traits[b] - needs[a] * p.traits[a]);
    for (const d of dims) {
      if (why.length >= 2) break;
      if (needs[d] >= .35 && p.traits[d] >= .7) {
        const names = gamesFor(d);
        const lead = names.length ? `${list(names)} reward${names.length === 1 ? 's' : ''} ${DIMS[d]}` : `You'll benefit from ${DIMS[d]}`;
        why.push(`${lead}, and ${p.why[d]}.`);
      }
    }
    for (const d of dims) {
      if (needs[d] >= .6 && p.traits[d] < .55) {
        const names = gamesFor(d);
        warn.push(`${names.length ? list(names) : 'Your games'} lean${names.length === 1 ? 's' : ''} on ${DIMS[d]}, which isn't this ${CAT[p.cat].one}'s strength.`);
      }
    }
    why.push(...c.pros.slice(0, 2));
    const range = bracketLabel(p.cat, state.budget[p.cat]);
    if (!within) warn.push(`${money(p.price - budget)} over your ${range} budget.`);
    else if (p.price < low) why.push(`${money(p.price)}, below your ${range} range, which leaves money for the rest of your setup.`);
    else why.push(`${money(p.price)} fits your ${range} budget.`);
    warn.push(...c.cons);

    return { p, match, within, parts: { game: g, comfort: c.score, value: v, budget: b }, why, warn };
  }

  function rankCategory(cat, needs) {
    const all = PRODUCTS.filter(p => p.cat === cat.id);
    const hidden = [], pool = [];
    for (const p of all) {
      const reason = compatibility(p);
      reason ? hidden.push({ p, reason }) : pool.push(evaluate(p, needs));
    }
    pool.sort((a, b) => b.match - a.match || a.p.price - b.p.price);
    return { pool, hidden };
  }

  // How alike two products are, so a list doesn't fill up with near-clones (0 = nothing alike, 1 = twins).
  function shapeKey(p) {
    if (p.cat === 'mouse') return `${p.handed}|${p.weight == null ? 'M' : p.weight < 65 ? 'L' : p.weight < 95 ? 'M' : 'H'}|${p.wireless}`;
    if (p.cat === 'keyboard') return `${p.layout}|${p.rapid}`;
    if (p.cat === 'headset') return `${p.back}|${p.wireless}`;
    if (p.cat === 'monitor') return `${p.size <= 25 ? 's' : p.size <= 28 ? 'm' : p.size <= 32 ? 'l' : 'xl'}|${/OLED/.test(p.spec)}`;
    if (p.cat === 'controller') return `${!!p.wheel}|${p.paddles}|${p.hall}`;
    return `${p.w >= 900 ? 'desk' : p.w >= 440 ? 'l' : 's'}|${p.surface.split(',')[0]}`;
  }
  function similarity(x, y) {
    const keys = new Set([...Object.keys(x.traits), ...Object.keys(y.traits)]);
    let dot = 0, nx = 0, ny = 0;
    for (const k of keys) { const u = x.traits[k] || 0, w = y.traits[k] || 0; dot += u * w; nx += u * u; ny += w * w; }
    const cos = dot / (Math.sqrt(nx * ny) || 1);
    const price = 1 - Math.min(1, Math.abs(Math.log(x.price / y.price)) / Math.log(2.5));
    return (x.brand === y.brand ? .3 : 0) + .25 * price + (shapeKey(x) === shapeKey(y) ? .3 : 0) + .15 * cos;
  }

  // Choose a varied shortlist instead of the n highest scores, which are often near-duplicates.
  function pickDiverse(cands, n) {
    if (!cands.length) return [];
    const chosen = [{ ...cands[0], role: 'Closest fit' }];
    const top = cands[0].match;
    const floor = Math.max(45, top - 32); // never pad the list with weak matches; the full ranking below has them
    const left = () => cands.filter(r => !chosen.some(c => c.p.id === r.p.id) && r.match >= floor);
    const take = (role, filter, score) => {
      if (chosen.length >= n) return;
      const pool = left().filter(r => filter(r));
      if (!pool.length) return;
      const best = pool.reduce((m, r) => (score(r) > score(m) ? r : m));
      chosen.push({ ...best, role });
    };
    const priceOf = r => r.p.price;
    const minChosen = () => Math.min(...chosen.map(priceOf)), maxChosen = () => Math.max(...chosen.map(priceOf));
    take('Best value', r => r.match >= top - 14 && r.p.price < cands[0].p.price * .9, r => r.match / Math.pow(r.p.price + 12, .55));
    take('Lesser-known gem', r => r.p.pop <= 2 && r.match >= top - 18, r => r.match);
    take('Premium pick', r => r.match >= top - 12 && r.p.price >= maxChosen() * 1.25, priceOf);
    take('Budget saver', r => r.match >= top - 16 && r.p.price <= minChosen() * .7, r => -r.p.price);
    const unlike = r => Math.max(...chosen.map(c => similarity(r.p, c.p)));
    take('A different take', r => r.match >= top - 20, r => r.match - 45 * unlike(r));
    while (chosen.length < n && left().length) take('Also a strong fit', () => true, r => r.match - 30 * unlike(r));
    // Fillers only count as strong fits when they are close to the best; otherwise call them what they are.
    for (const c of chosen) if (c.role === 'Also a strong fit' && c.match < top - 15) c.role = 'Another option';
    return [chosen[0], ...chosen.slice(1).sort((x, y) => y.match - x.match)];
  }

  // Alternatives at different price points from the same compatible pool.
  function alternatives(r, pool) {
    const others = pool.filter(x => x.p.id !== r.p.id);
    const cheaper = others.filter(x => x.p.price <= r.p.price * .75).sort((a, b) => b.match - a.match)[0];
    const pricier = others.filter(x => x.p.price >= r.p.price * 1.2).sort((a, b) => b.match - a.match)[0];
    return { cheaper, pricier };
  }

  /* ---------------- rendering ---------------- */
  const ICONS = {
    mouse: '<path d="M12 3a6 6 0 0 1 6 6v6a6 6 0 0 1-12 0V9a6 6 0 0 1 6-6Zm0 0v6"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    headset: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    monitor: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>',
    controller: '<path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.9 4a2.5 2.5 0 0 1-4.3 1L14 16h-4l-1.7 1.9a2.5 2.5 0 0 1-4.3-1l-.9-4A4 4 0 0 1 7 8Z"/><path d="M8 11v3M6.5 12.5h3M15.5 12h.01M17.5 13.5h.01"/>',
  };
  const icon = id => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;
  const tone = m => m >= 75 ? '' : m >= 60 ? 'mid' : 'low';
  const toneColor = m => m >= 75 ? 'var(--good)' : m >= 60 ? 'var(--warn)' : 'var(--bad)';

  function specLine(p) {
    if (p.cat === 'mouse') return `${p.weight == null ? 'Weight unconfirmed' : p.weight + ' g'} · ${p.handed === 'right' ? 'Right-hand ergonomic' : p.handed === 'ambi' ? 'Ambidextrous' : 'Symmetric'} · ${p.wireless ? 'Wireless' : 'Wired'}`;
    if (p.cat === 'keyboard') return `${cap(LAYOUT_WORD[p.layout])} · ${p.rapid ? 'Rapid Trigger · ' : ''}${p.wireless ? 'Wireless' : 'Wired'}`;
    if (p.cat === 'headset') return `${p.weight} g · ${cap(p.back)}-back · ${p.wireless ? 'Wireless' : 'Wired'} · ${p.platforms.map(x => PLATFORMS[x]).join(', ')}`;
    if (p.cat === 'monitor') return p.spec;
    if (p.cat === 'mousepad') return `${p.w} × ${p.h} mm · ${p.thick} mm thick · ${p.surface}`;
    return `${p.platforms.map(x => PLATFORMS[x]).join(', ')} · ${p.wireless ? 'Wireless' : 'Wired'}${p.hall ? ' · Hall-effect sticks' : ''}${p.paddles ? ' · Back buttons' : ''}`;
  }

  // Three short facts in everyday words for the simple card view.
  function plainFacts(p) {
    const f = [];
    if (p.cat === 'mouse') {
      f.push(p.weight == null ? 'Weight not confirmed' : p.weight < 65 ? `Very light (${p.weight} g), quick to move` : p.weight < 95 ? `Medium weight (${p.weight} g)` : `Heavy, steady feel (${p.weight} g)`);
      f.push({ right: 'Shaped for right hands', ambi: 'Works in either hand', sym: 'Even shape, fine for most hands' }[p.handed]);
      f.push(p.wireless ? 'Wireless' : 'Wired, so no charging');
    } else if (p.cat === 'keyboard') {
      f.push({ full: 'Full size, with a number pad', tkl: 'No number pad, so more room for your mouse', 75: 'Compact, keeps the F-keys', 65: 'Compact', 60: 'Very compact, no arrow keys' }[p.layout]);
      f.push(p.rapid ? 'Rapid Trigger for fast shooters' : p.noise >= .75 ? 'Quiet to type on' : p.noise < .5 ? 'Loud, clicky typing' : 'Moderate typing noise');
      f.push(p.wireless ? 'Wireless' : 'Wired');
    } else if (p.cat === 'headset') {
      f.push(p.back === 'open' ? 'Open-back: roomy sound, people nearby can hear it' : 'Closed-back: keeps the sound in');
      f.push(p.weight <= 300 ? `Light on your head (${p.weight} g)` : p.weight <= 350 ? `Average weight (${p.weight} g)` : `Heavy (${p.weight} g)`);
      f.push(p.wireless ? 'Wireless' : 'Wired, works with almost anything');
    } else if (p.cat === 'monitor') {
      const hz = +(p.spec.match(/(\d+)\s*Hz/) || [])[1];
      f.push(`${p.size}" screen`);
      f.push(hz >= 300 ? `Extremely smooth (${hz} Hz), for competitive shooters` : hz >= 160 ? `Very smooth (${hz} Hz)` : `Smooth (${hz} Hz)`);
      f.push(/4K|5120/.test(p.spec) ? 'Very sharp picture' : /1440p/.test(p.spec) ? 'Sharp picture (1440p)' : 'Standard sharpness (1080p)');
    } else if (p.cat === 'controller') {
      f.push(p.wheel ? 'A steering wheel with pedals' : 'Works on ' + p.platforms.map(x => PLATFORMS[x]).join(', '));
      if (!p.wheel) f.push(p.hall ? 'Sticks that resist drifting' : 'Standard sticks');
      f.push(p.paddles ? 'Extra back buttons' : p.wireless ? 'Wireless' : 'Wired');
    } else if (p.cat === 'mousepad') {
      f.push(p.w >= 900 ? 'Desk mat: fits keyboard and mouse' : p.w >= 440 ? `Large (${p.w} × ${p.h} mm)` : `Small (${p.w} × ${p.h} mm)`);
      f.push(p.thick >= 4 ? 'Thick and cushioned' : p.thick <= 1 ? 'Very thin' : 'Standard thickness');
      f.push(/speed|hybrid/i.test(p.surface) ? 'Fast glide' : 'Controlled glide, good for aim');
    }
    return f.filter(Boolean);
  }

  // Wrap jargon in tooltips that explain it in plain English (from the jargon buster).
  const JARGON = [
    [/Rapid Trigger/g, 'rapid'], [/Hall-effect sticks|drift-resistant TMR sticks|TMR sticks/gi, 'hall'], [/\b(Open|Closed)-back\b/g, 'openback'],
    [/\bTenkeyless\b|\b(75|60|65)%|\bFull-size\b/g, 'layout'], [/\b\d{2,3} Hz\b/g, 'refresh'], [/\b(1080p|1440p|4K)\b/g, 'resolution'],
    [/\b(QD-OLED|OLED|Mini-LED VA|Nano IPS|Fast IPS|Rapid IPS|IPS|VA|TN)\b/g, 'panel'], [/HDMI 2\.1/g, 'hdmi21'], [/Back buttons|back paddles/gi, 'paddles'],
    [/\b(Symmetric|Right-hand ergonomic|Ambidextrous)\b/g, 'shape'], [/\b\d{1,2},?\d{3} DPI\b|\bDPI\b/g, 'dpi'], [/polling/g, 'polling'],
  ];
  function jargon(text) {
    let html = esc(text);
    const used = new Set();
    for (const [re, id] of JARGON) {
      const g = GLOSSARY.find(x => x.id === id);
      if (!g) continue;
      html = html.replace(re, m => {
        if (used.has(id)) return m; // one tooltip per term is enough
        used.add(id);
        return `<span class="jt" tabindex="0" data-tip="${esc(g.term + ': ' + g.text)}">${m}</span>`;
      });
    }
    return html;
  }

  function card(r, i, pool, sortedByMatch) {
    const { p } = r;
    const alts = alternatives(r, pool);
    const label = !sortedByMatch ? (r.within ? 'Within budget' : 'Over budget') : r.role || (i === 0 ? 'Closest fit' : 'Also a strong fit');
    const badges = [
      !r.within ? '<span class="badge over">Over budget</span>' : p.price < budgetLow(p.cat) ? '<span class="badge ok">Under your range</span>' : '<span class="badge ok">In your budget</span>',
      p.pop <= 2 ? '<span class="badge gem" title="Ranked on fit alone. Popularity is never part of the score.">Lesser-known pick</span>' : '',
      `<span class="badge" title="Shown for context only. It does not affect the match.">Popularity ${'●'.repeat(p.pop)}${'○'.repeat(5 - p.pop)}</span>`,
    ].join('');
    const bar = (name, v) => `<div class="bar">${name}<i style="--w:${Math.round(v * 100)}%"></i><span>${Math.round(v * 100)}</span></div>`;
    const alt = (lbl, a) => a ? `<button type="button" class="alt" data-goto="${a.p.id}"><span class="lbl">${lbl}</span><span class="nm">${esc(a.p.brand)} ${esc(a.p.name)}</span><span class="pc">${money(a.p.price)}</span><span class="pill ${tone(a.match)}">${a.match}%</span></button>` : '';
    const altHtml = alt('Spend less', alts.cheaper) + alt('Spend more', alts.pricier);

    const listTag = shopRegion() === 'US' && p.msrp && Math.abs(p.msrp - p.price) >= 1 ? `<s title="Manufacturer list price">List ${moneyExact(p.msrp)}</s>` : '';
    const shop = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(p.brand + ' ' + p.name)}`;
    const ringTip = 'How well it fits you, out of 100. It is not a review score.';
    if (!state.detail) {
      // Simple view: what a beginner needs to decide whether to look closer.
      const reason = r.why.find(t => !/budget|range/.test(t)) || r.why[0] || p.pros[0];
      return `<article class="card glass clickable simple cat-${p.cat}${i === 0 && sortedByMatch ? ' first' : ''}" id="card-${p.id}">
        <div class="pimg${art.hasPhoto(p) ? ' has-photo' : ''}">${art(p)}
          <div class="ring" style="--p:${r.match};--c:${toneColor(r.match)}" role="img" aria-label="${r.match}% match" title="${ringTip}"><b>${r.match}%<small>MATCH</small></b></div>
          <div class="rank">${label}</div>
        </div>
        <div class="ctop">
          <div class="ctitle"><div class="brandline">${esc(p.brand)}</div>
            <h4><a class="plink" href="#/p/${p.id}" data-product="${p.id}">${esc(p.name)}</a></h4></div>
          <div class="pricebox"><b>${moneyExact(p.price)}</b><span>${r.within ? 'fits your budget' : 'over your budget'}${p.bestOffer ? ` · at ${esc(p.bestOffer.store)}` : ''}</span></div>
        </div>
        <p class="oneliner"><span aria-hidden="true">✓</span> ${jargon(reason)}</p>
        <ul class="facts">${plainFacts(p).map(f => `<li>${jargon(f)}</li>`).join('')}</ul>
        ${r.warn[0] ? `<p class="heads">Heads up: ${jargon(r.warn[0])}</p>` : ''}
        <div class="cardlinks"><a class="more primary" href="#/p/${p.id}" data-product="${p.id}">See why it fits <span aria-hidden="true">→</span></a>
          <a class="shop" href="${shop}" target="_blank" rel="noopener noreferrer">Check prices ↗</a></div>
      </article>`;
    }
    return `<article class="card glass clickable cat-${p.cat}${i === 0 && sortedByMatch ? ' first' : ''}" id="card-${p.id}">
      <div class="pimg${art.hasPhoto(p) ? ' has-photo' : ''}">${art(p)}
        <div class="ring" style="--p:${r.match};--c:${toneColor(r.match)}" role="img" aria-label="${r.match}% match" title="${ringTip}"><b>${r.match}%<small>MATCH</small></b></div>
        <div class="rank">${label}</div>
      </div>
      <div class="ctop">
        <div class="ctitle">
          <div class="brandline">${esc(p.brand)}</div>
          <h4><a class="plink" href="#/p/${p.id}" data-product="${p.id}">${esc(p.name)}</a></h4>
        </div>
        <div class="pricebox"><b>${moneyExact(p.price)}</b><span>${esc(whereLine(p))}</span>${listTag}</div>
      </div>
      <div class="cardlinks"><a class="shop" href="${shop}" target="_blank" rel="noopener noreferrer">Check live prices ↗</a>
        <a class="more" href="#/p/${p.id}" data-product="${p.id}">View details <span aria-hidden="true">→</span></a></div>
      <div class="badges">${badges}</div>
      <div class="spec">${jargon(specLine(p))}</div>
      <div class="bars">${bar('Game fit', r.parts.game)}${bar('Comfort', r.parts.comfort)}${bar('Value', r.parts.value)}</div>
      <div class="why"><h5>Why it matches you</h5><ul>
        ${r.why.map(t => `<li>${esc(t)}</li>`).join('')}
        ${r.warn.slice(0, 3).map(t => `<li class="warn">${esc(t)}</li>`).join('')}
      </ul></div>
      <div class="sw">
        <div class="pro"><h5>Strengths</h5><ul>${p.pros.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div class="con"><h5>Weaknesses</h5><ul>${p.cons.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
      </div>
      ${altHtml ? `<div class="alts"><h5>Alternatives at other prices</h5>${altHtml}</div>` : ''}
    </article>`;
  }

  function categoryNote(cat, needs) {
    const rel = Math.max(...cat.dims.map(d => needs[d] || 0));
    if (!state.games.length) return '';
    if (cat.id === 'controller' && Math.max(needs.pad, needs.racing) < .35)
      return 'Your games are mostly played with mouse and keyboard, so a controller is optional. These matches lean on comfort and general quality.';
    if ((cat.id === 'mouse' || cat.id === 'keyboard' || cat.id === 'mousepad') && consoleOnly())
      return 'Few console games support mouse and keyboard well. Consider skipping this category.';
    if ((cat.id === 'mouse' || cat.id === 'keyboard') && needs.pad >= .8 && needs.aim < .5 && needs.binds < .5)
      return `Your games play best on a controller, so a ${cat.one} matters less here.`;
    if (cat.id === 'controller' && needs.racing >= .6) {
      const wheel = PRODUCTS.find(p => p.wheel);
      return wheel.price > budgetCap('controller')
        ? `You play racing games. A wheel like the ${wheel.brand} ${wheel.name} (${money(wheel.price)}) transforms them, but it's above your budget. Raise the budget to see it ranked.`
        : 'You play racing games, so a wheel is ranked alongside regular controllers.';
    }
    if (cat.id === 'mousepad') return 'A pad changes how your mouse glides. Softer cloth is steadier for aim, harder or hybrid surfaces are faster.';
    return rel < .3 ? `Your selected games don't lean heavily on a ${cat.one}, so comfort and value carry more weight.` : '';
  }

  /* ---------------- results ---------------- */
  function renderResults() {
    const needs = computeNeeds();
    const out = $('#out');
    const cat = CAT[state.view];
    const g = state.games.map(id => GAME[id].name);
    $('#title').textContent = `${cat.name}${g.length ? ` for ${list(g, 2)}` : ' for you'}`;
    $('#summary').textContent = (g.length ? '' : 'Add your games for sharper matches · ')
      + `${bracketLabel(cat.id, state.budget[cat.id])} · ${state.platforms.length ? list(state.platforms.map(x => PLATFORMS[x]), 4) : 'any platform'}`
      + (cat.id === 'mouse' || cat.id === 'controller' ? ` · ${HAND_WORD[state.hand]} hands` : '');

    const { pool, hidden } = rankCategory(cat, needs);
    const within = pool.filter(r => r.within);
    const sortedByMatch = state.sort === 'match';
    const ordered = sortedByMatch ? within : [...within].sort((a, b) => state.sort === 'low' ? a.p.price - b.p.price : b.p.price - a.p.price);
    let top = sortedByMatch ? pickDiverse(ordered, 6) : ordered.slice(0, 6);
    let emptyMsg = '';
    if (!top.length) {
      // Nothing fits the budget: show the closest stretch options instead of an empty shelf.
      top = [...pool].sort((a, b) => a.p.price - b.p.price).slice(0, 2);
      emptyMsg = `<div class="catnote">Nothing in our catalog fits a ${bracketLabel(cat.id, state.budget[cat.id])} ${cat.one} budget. Here are the closest options above it.</div>`;
    }
    const shown = new Set(top.map(r => r.p.id));
    const rest = pool.filter(r => !shown.has(r.p.id));
    const note = categoryNote(cat, needs);
    const limit = budgetCap(cat.id);
    renderOverview(needs);

    out.innerHTML = `
      ${note ? `<div class="catnote">${esc(note)}</div>` : ''}
      ${hidden.length ? `<div class="hidden-note">Hidden ${hidden.length}: ${hidden.map(h => `${esc(h.p.brand)} ${esc(h.p.name)} (${esc(h.reason)})`).join(', ')}.</div>` : ''}
      ${emptyMsg}
      <div class="cards">${top.map((r, i) => card(r, i, pool, sortedByMatch && !emptyMsg)).join('')}</div>
      ${top.length > 1 && state.detail ? compareTable(top, cat) : ''}
      ${rest.length ? `<details class="allrank glass"><summary>See all ${pool.length} ranked ${cat.name.toLowerCase()}</summary>
        <div class="rows">${rest.map(r => `<a class="row${r.within ? '' : ' over'}" data-id="${r.p.id}" href="#/p/${r.p.id}" data-product="${r.p.id}">
          <span class="pill ${tone(r.match)}">${r.match}%</span>
          <span class="rn"><span class="thumb cat-${r.p.cat}">${art(r.p)}</span><span>${esc(r.p.brand)} ${esc(r.p.name)}<small>${esc(r.why[0] || r.p.pros[0])}</small></span></span>
          <span class="rtag">${r.within ? (r.p.pop <= 2 ? '<span class="badge gem">Lesser-known</span>' : '') : `<span class="tag">+${money(r.p.price - limit)} over</span>`}</span>
          <span class="rp">${money(r.p.price)}</span>
        </a>`).join('')}</div></details>` : ''}`;
  }

  // Side-by-side view of the shown picks.
  function compareTable(top, cat) {
    const rows = top.map(r => `<tr>
      <th scope="row"><a class="plink" href="#/p/${r.p.id}" data-product="${r.p.id}">${esc(r.p.brand)} ${esc(r.p.name)}</a></th>
      <td><span class="pill ${tone(r.match)}">${r.match}%</span></td>
      <td class="num">${money(r.p.price)}</td>
      <td>${esc(specLine(r.p))}</td>
      <td>${esc(r.p.pros[0])}</td>
      <td>${esc(r.p.cons[0])}</td>
    </tr>`).join('');
    return `<section class="compare glass"><h3>Compare these ${esc(cat.name.toLowerCase())}</h3>
      <div class="tablewrap"><table><thead><tr><th>Product</th><th>Match</th><th>Price</th><th>Specs</th><th>Best thing</th><th>Watch out for</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }

  // One best pick per selected product type, with a running total for the whole setup.
  function renderOverview(needs) {
    let total = 0;
    const items = state.cats.map(id => {
      const cat = CAT[id];
      const { pool } = rankCategory(cat, needs);
      const within = pool.filter(r => r.within);
      const best = (within.length ? within : pool.slice().sort((a, b) => a.p.price - b.p.price))[0];
      if (best) total += best.p.price;
      return { cat, best, over: best && !best.within };
    });
    $('#overview').innerHTML = `<div class="ovhead"><h3>Your setup at a glance</h3>
        <p>The closest fit for each product type. Tap one to see all of its matches.</p></div>
      <div class="ovgrid">${items.map(({ cat, best, over }) => best ? `<button type="button" class="ovcard cat-${cat.id}" data-view="${cat.id}" aria-pressed="${cat.id === state.view}">
        <span class="ovart">${art(best.p)}</span>
        <span class="ovtxt"><small>${cap(cat.one)}</small><b>${esc(best.p.brand)} ${esc(best.p.name)}</b>
        <em>${money(best.p.price)} · ${best.match}% match${over ? ' · over budget' : ''}</em></span></button>` : '').join('')}</div>
      <div class="ovtotal">Full setup <b>${money(total)}</b><small>${items.length} item${items.length === 1 ? '' : 's'} at the lowest shop prices we found</small></div>`;
  }

  /* ---------------- currency ---------------- */
  function symbol(c) {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: c, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(x => x.type === 'currency').value; }
    catch { return c; }
  }

  function renderCurrency() {
    const sel = $('#currency');
    if (!fx.rates[state.currency]) state.currency = 'USD';
    sel.innerHTML = Object.keys(CURRENCY_NAMES).filter(c => fx.rates[c])
      .map(c => `<option value="${c}" title="${CURRENCY_NAMES[c]}">${symbol(c)} ${c}</option>`).join('');
    sel.value = state.currency;
    const d = new Date(((!fx.live && fx.dates[state.currency]) || fx.date) + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const shops = `Each price is the lowest we found at real shops in ${REGION_NAME[shopRegion()]}${shopRegion() === 'IN' ? ' (US shops when we found none in India)' : ''}, checked ${SAVED.checkedLabel}${LIVE ? `; prices marked Live update daily (last ${ago(LIVE.updated)})` : ''}. ${shopRegion() === 'IN' ? 'Pick another currency to see US shops first.' : 'Shopping in India? Pick ₹ INR to see Indian shops first.'}`;
    $('#fxnote').textContent = state.currency === 'USD'
      ? shops
      : `${shops} Converted at ${fx.live ? 'live ECB exchange rates' : 'saved exchange rates'} of ${d}; local shops often differ because of taxes and import duties.`;
  }

  async function loadRates() {
    for (const url of ['https://api.frankfurter.dev/v1/latest?base=USD', 'https://api.frankfurter.app/latest?from=USD']) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.rates || !data.rates.EUR) continue;
        fx = { live: true, date: data.date, dates: {}, rates: { ...fx.rates, ...data.rates, USD: 1 } };
        applyOffers(); // prices listed in rupees rank against today's rate
        renderCurrency();
        if (!$('#dashboard').hidden) { renderBudget(); renderResults(); }
        return;
      } catch { /* offline or blocked: keep saved rates */ }
    }
  }

  /* ---------------- screens ---------------- */
  const SCREENS = ['welcome', 'prepare', 'loading', 'dashboard', 'product'];
  function show(id, keepScroll) {
    SCREENS.forEach(s => { $('#' + s).hidden = s !== id; });
    if (!keepScroll) window.scrollTo(0, 0);
  }

  function renderPrepare() {
    const names = state.games.map(id => GAME[id].name);
    $('#prepGames').innerHTML = '';
    for (let i = 0; i < Math.max(4, names.length); i++) addGameLine(names[i] || '');
    $('#prepHand').value = state.handCm || '';
    $('#prepProducts').innerHTML = CATEGORIES.map(c => checkbox(c.id, cap(c.one), state.cats.includes(c.id), `value="${c.id}"`)).join('');
    $('#prepError').textContent = '';
  }

  const MAX_GAMES = 12;
  function addGameLine(value = '') {
    const box = $('#prepGames');
    const n = box.children.length;
    if (n >= MAX_GAMES) return;
    const wrap = document.createElement('div');
    wrap.className = 'combo';
    const listId = 'gl' + n;
    wrap.innerHTML = `<input class="line" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${listId}" aria-label="Game ${n + 1}" placeholder="${n ? '' : 'e.g. Minecraft'}">`
      + `<button type="button" class="combo-btn" tabindex="-1" aria-label="Show all games" aria-expanded="false">▼</button>`
      + `<div class="combolist" id="${listId}" role="listbox" hidden></div>`;
    wrap.querySelector('input').value = value;
    box.appendChild(wrap);
    $('#addLine').hidden = box.children.length >= MAX_GAMES;
    return wrap.querySelector('input');
  }

  // Game combobox: typing filters the list; the arrow button always shows every game,
  // even when something is already typed, with the current pick highlighted.
  let combo = null; // { wrap, input, list, items, active }
  function comboOpen(wrap, showAll) {
    if (combo && combo.wrap !== wrap) comboClose();
    const input = wrap.querySelector('input'), list = wrap.querySelector('.combolist');
    const q = input.value.trim().toLowerCase();
    const items = showAll || !q ? GAMES : GAMES.filter(g => g.name.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q) || Object.keys(ALIASES).some(k => k.startsWith(q) && ALIASES[k] === g.id));
    const current = findGame(input.value);
    list.innerHTML = items.length
      ? items.map((g, i) => `<div role="option" id="${list.id}-${i}" data-game="${g.id}" aria-selected="false" class="${current && current.id === g.id ? 'current' : ''}">${esc(g.name)}<small>${esc(g.genre)}</small></div>`).join('')
      : '<div class="none">No games match. Press the arrow to see them all.</div>';
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    wrap.querySelector('.combo-btn').setAttribute('aria-expanded', 'true');
    combo = { wrap, input, list, items, active: -1, showAll: !!showAll };
    if (showAll && current) { const el = list.querySelector('.current'); if (el) el.scrollIntoView({ block: 'nearest' }); }
  }
  function comboClose() {
    if (!combo) return;
    combo.list.hidden = true;
    combo.input.setAttribute('aria-expanded', 'false');
    combo.input.removeAttribute('aria-activedescendant');
    combo.wrap.querySelector('.combo-btn').setAttribute('aria-expanded', 'false');
    combo = null;
  }
  function comboPick(id) {
    if (!combo) return;
    combo.input.value = GAME[id].name;
    const input = combo.input;
    comboClose();
    input.focus();
  }
  function comboMove(step) {
    if (!combo || !combo.items.length) return;
    combo.active = (combo.active + step + combo.items.length) % combo.items.length;
    combo.list.querySelectorAll('[role="option"]').forEach((el, i) => el.setAttribute('aria-selected', i === combo.active));
    const el = combo.list.querySelector(`#${combo.list.id}-${combo.active}`);
    if (el) { el.scrollIntoView({ block: 'nearest' }); combo.input.setAttribute('aria-activedescendant', el.id); }
  }
  $('#prepGames').addEventListener('input', e => { const w = e.target.closest('.combo'); if (w) comboOpen(w, false); });
  $('#prepGames').addEventListener('focusin', e => { const w = e.target.closest('.combo'); if (w && e.target.matches('input') && !e.target.value) comboOpen(w, false); });
  $('#prepGames').addEventListener('mousedown', e => {
    const btn = e.target.closest('.combo-btn');
    if (btn) {
      e.preventDefault(); // keep focus in the input
      const w = btn.closest('.combo');
      // A filtered list switches to the full list; only a full list closes again.
      if (combo && combo.wrap === w && combo.showAll) comboClose(); else { comboOpen(w, true); w.querySelector('input').focus(); }
      return;
    }
    const opt = e.target.closest('[role="option"]');
    if (opt) { e.preventDefault(); comboPick(opt.dataset.game); }
  });
  $('#prepGames').addEventListener('keydown', e => {
    const w = e.target.closest('.combo');
    if (!w) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!combo || combo.wrap !== w) comboOpen(w, e.altKey || !e.target.value); comboMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (combo) comboMove(-1); }
    else if (e.key === 'Escape' && combo) { e.stopPropagation(); comboClose(); }
    else if (e.key === 'Enter' && combo && combo.active >= 0) { e.preventDefault(); e.stopPropagation(); comboPick(combo.items[combo.active].id); }
  });
  document.addEventListener('mousedown', e => { if (combo && !combo.wrap.contains(e.target)) comboClose(); });

  function checkbox(id, label, checked, attrs) {
    return `<label class="check"><input type="checkbox" ${attrs} ${checked ? 'checked' : ''}><span class="box" aria-hidden="true"></span><span class="ctext">${esc(label)}</span></label>`;
  }

  // Match typed game names to the catalog, forgiving case and partial names ("cs2", "gta").
  const ALIASES = {
    'gta vi': 'gta6', 'gta 6': 'gta6', 'gta': 'gta6', 'gta v': 'gta5', 'gta 5': 'gta5', 'cs': 'cs2', 'csgo': 'cs2', 'cs go': 'cs2', 'counter strike': 'cs2',
    'cod': 'warzone', 'call of duty': 'warzone', 'lol': 'lol', 'league': 'lol', 'wow': 'wow', 'ff14': 'ffxiv', 'ffxiv': 'ffxiv', 'fifa': 'fc', 'fc 25': 'fc', 'fc 26': 'fc',
    'flight sim': 'msfs', 'flight simulator': 'msfs', 'ow': 'overwatch', 'ow2': 'overwatch', 'acc': 'acc', 'bg3': 'bg3', 'rl': 'rocketleague', 'aoe': 'aoe4', 'aoe4': 'aoe4', 'osu': 'osu',
  };
  function findGame(text) {
    const q = text.trim().toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!q) return null;
    if (ALIASES[q]) return GAME[ALIASES[q]];
    return GAMES.find(g => g.name.toLowerCase() === text.trim().toLowerCase() || g.id === q)
      || GAMES.find(g => g.name.toLowerCase().startsWith(q))
      || GAMES.find(g => g.name.toLowerCase().includes(q)) || null;
  }

  function buildDashboard() {
    comboClose();
    const typed = [...document.querySelectorAll('#prepGames input')].map(i => i.value).filter(v => v.trim());
    const found = typed.map(findGame);
    const unknown = typed.filter((t, i) => !found[i]);
    const cats = [...document.querySelectorAll('#prepProducts input:checked')].map(i => i.value);
    const cm = parseFloat($('#prepHand').value);
    const err = [];
    if (unknown.length) err.push(`We don't know ${list(unknown.map(u => `"${u}"`), 3)} yet. Pick from the suggestions.`);
    if (!cats.length) err.push('Choose at least one product.');
    if ($('#prepHand').value && !(cm >= 12 && cm <= 25)) err.push('Hand length should be between 12 and 25 cm.');
    if (err.length) { $('#prepError').textContent = err.join(' '); return; }

    state.games = [...new Set(found.map(g => g.id))];
    state.cats = cats;
    state.view = cats[0];
    if (cm) { state.handCm = cm; state.hand = handFromCm(cm); }
    state.cats.sort((x, y) => CATEGORIES.findIndex(c => c.id === x) - CATEGORIES.findIndex(c => c.id === y));
    state.onboarded = true;
    save();
    show('loading');
    const wait = matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 1300;
    setTimeout(openDashboard, wait);
  }

  function openDashboard() {
    hideReset();
    applyOffers(); // the currency may have changed (setup, reset), which changes which shops come first
    renderSide();
    renderCurrency();
    renderResults();
    show('dashboard');
  }

  /* ---------------- sidebar ---------------- */
  const opts = (key, value) => OPTIONS[key].map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('');

  function renderGames() {
    $('#gameChips').innerHTML = state.games.map(id => `<button type="button" class="chip game" data-remove="${id}" title="Remove ${esc(GAME[id].name)}">${esc(GAME[id].name)} <span class="x" aria-hidden="true">×</span></button>`).join('')
      + `<button type="button" class="chip add" id="addGame" aria-label="Add a game" aria-expanded="${!$('#gamePicker').hidden}">+</button>`;
    renderGameOptions();
  }
  function renderGameOptions() {
    const q = $('#gameSearch').value.trim().toLowerCase();
    const left = GAMES.filter(g => !state.games.includes(g.id) && (!q || g.name.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q)));
    $('#gameOptions').innerHTML = left.length ? left.map(g => `<button type="button" data-addgame="${g.id}">${esc(g.name)}<small>${esc(g.genre)}</small></button>`).join('') : '<small class="hint">No more matches</small>';
  }
  function renderBudget() {
    $('#budgetLabel').textContent = 'Budget per ' + CAT[state.view].one;
    $('#budget').innerHTML = BUDGETS[state.view].map((_, i) => `<option value="${i}" ${i === state.budget[state.view] ? 'selected' : ''}>${bracketLabel(state.view, i)}</option>`).join('');
  }
  function renderTypes() {
    $('#types').innerHTML = state.cats.map(id => `<button type="button" class="chip" data-view="${id}" aria-pressed="${id === state.view}">${cap(CAT[id].one)}</button>`).join('');
    $('#cats').innerHTML = CATEGORIES.map(c => checkbox(c.id, cap(c.one), state.cats.includes(c.id), `data-catbox="${c.id}"`)).join('');
    document.querySelectorAll('[data-for]').forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(state.view); });
  }
  function renderSide() {
    renderGames();
    renderBudget();
    renderTypes();
    $('#handed').innerHTML = OPTIONS.handed.map(([v, l]) => `<label class="radio"><input type="radio" name="handed" value="${v}" ${state.handed === v ? 'checked' : ''}><i></i>${l}</label>`).join('');
    for (const k of ['weight', 'hand', 'grip', 'desk', 'conn']) $('#' + k).innerHTML = opts(k, state[k]);
    $('#platforms').innerHTML = Object.entries(PLATFORMS).map(([id, n]) => `<button type="button" class="chip" data-platform="${id}" aria-pressed="${state.platforms.includes(id)}">${n}</button>`).join('');
    document.querySelectorAll('input[type="checkbox"][data-key]').forEach(cb => { cb.checked = !!state[cb.dataset.key]; });
    $('#sort').value = state.sort;
    renderViewToggle();
    renderGuide();
  }
  function renderViewToggle() {
    $('#dashboard').classList.toggle('simple', !state.detail);
    if (!state.detail && state.sort !== 'match') { state.sort = 'match'; $('#sort').value = 'match'; }
    document.querySelectorAll('#viewToggle button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.detail === '1') === !!state.detail)));
  }
  const GUIDE_STORE = 'gearguide-guide-hidden';
  function renderGuide() {
    let hidden = false;
    try { hidden = localStorage.getItem(GUIDE_STORE) === '1'; } catch { /* ignore */ }
    $('#guide').hidden = hidden;
    $('#showGuide').hidden = !hidden;
  }

  let timer = 0;
  function changed() {
    save();
    clearTimeout(timer);
    timer = setTimeout(renderResults, 60);
  }
  const toggleIn = (arr, v) => { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); };

  $('#dashboard').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t || t.closest('#out, #overview')) return;
    if (t.classList.contains('tipbtn')) return;
    if (t.dataset.detail != null) {
      state.detail = t.dataset.detail === '1';
      renderViewToggle(); changed();
      return;
    }
    if (t.id === 'hideGuide' || t.id === 'showGuide') {
      try { localStorage.setItem(GUIDE_STORE, t.id === 'hideGuide' ? '1' : '0'); } catch { /* ignore */ }
      renderGuide();
      if (t.id === 'showGuide') $('#guide').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (t.id === 'moreBtn') {
      const p = $('#morePanel');
      p.hidden = !p.hidden;
      t.setAttribute('aria-expanded', !p.hidden);
      return;
    }
    if (t.id === 'addGame') {
      const p = $('#gamePicker');
      p.hidden = !p.hidden;
      t.setAttribute('aria-expanded', !p.hidden);
      if (!p.hidden) { $('#gameSearch').value = ''; renderGameOptions(); $('#gameSearch').focus(); }
    } else if (t.dataset.addgame) {
      state.games.push(t.dataset.addgame);
      $('#gamePicker').hidden = true;
      renderGames(); changed();
    } else if (t.dataset.remove) {
      toggleIn(state.games, t.dataset.remove);
      renderGames(); changed();
    } else if (t.dataset.view) {
      state.view = t.dataset.view;
      renderTypes(); renderBudget(); changed();
    } else if (t.dataset.platform) {
      toggleIn(state.platforms, t.dataset.platform);
      t.setAttribute('aria-pressed', state.platforms.includes(t.dataset.platform));
      changed();
    } else if (t.id === 'restart') {
      goSetup();
    } else if (t.dataset.reset != null) {
      showReset(t);
    } else if (t.id === 'resetNo') {
      hideReset();
    } else if (t.id === 'resetYes') {
      resetAll();
    }
  });
  // The games list floats over the page, so close it on an outside click.
  document.addEventListener('click', e => {
    const p = $('#gamePicker');
    if (!p.hidden && !p.contains(e.target) && e.target.id !== 'addGame') { p.hidden = true; const b = $('#addGame'); if (b) b.setAttribute('aria-expanded', 'false'); }
  });
  $('#dashboard').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.catbox) {
      const id = t.dataset.catbox;
      if (!t.checked && state.cats.length === 1) { t.checked = true; return; } // keep at least one
      t.checked ? state.cats.push(id) : state.cats.splice(state.cats.indexOf(id), 1);
      state.cats.sort((x, y) => CATEGORIES.findIndex(c => c.id === x) - CATEGORIES.findIndex(c => c.id === y));
      if (!state.cats.includes(state.view)) state.view = state.cats[0];
      renderTypes(); renderBudget();
    }
    else if (t.id === 'budget') state.budget[state.view] = +t.value;
    else if (t.name === 'handed') state.handed = t.value;
    else if (OPTIONS[t.id]) state[t.id] = t.value;
    else if (t.dataset.key) state[t.dataset.key] = t.checked;
    else return;
    changed();
  });
  $('#gameSearch').addEventListener('input', renderGameOptions);
  $('#gameSearch').addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('#gamePicker').hidden = true; $('#addGame').focus(); }
    if (e.key === 'Enter') { const first = $('#gameOptions button'); if (first) first.click(); }
  });

  $('#overview').addEventListener('click', e => {
    const t = e.target.closest('[data-view]');
    if (!t) return;
    state.view = t.dataset.view;
    renderTypes(); renderBudget(); changed();
    $('#out').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; changed(); });
  $('#currency').addEventListener('change', e => { state.currency = e.target.value; save(); applyOffers(); renderCurrency(); renderBudget(); renderResults(); });

  $('#addLine').addEventListener('click', () => addGameLine().focus());
  $('#start').addEventListener('click', () => goSetup());

  /* ---------------- reset ---------------- */
  // Wipes every saved answer (games, budgets, comfort, view) and starts again from the welcome screen.
  // Any saved AI key is left alone; the confirm box says so.
  let resetFrom = null;
  function showReset(from) {
    resetFrom = from;
    const box = $('#resetConfirm');
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#resetNo').focus({ preventScroll: true });
  }
  function hideReset() {
    $('#resetConfirm').hidden = true;
    if (resetFrom && resetFrom.isConnected && !resetFrom.closest('[hidden]')) resetFrom.focus({ preventScroll: true });
    resetFrom = null;
  }
  function resetAll() {
    try { localStorage.removeItem(STORE); localStorage.removeItem(GUIDE_STORE); } catch { /* ignore */ }
    state = structuredClone(DEFAULTS);
    resetFrom = null;
    $('#resetConfirm').hidden = true;
    $('#morePanel').hidden = true; $('#moreBtn').setAttribute('aria-expanded', 'false');
    clearProductHash();
    renderPrepare();
    show('welcome');
    window.scrollTo(0, 0);
    const n = $('#resetDone'); n.hidden = false;
    clearTimeout(resetAll.t); resetAll.t = setTimeout(() => { n.hidden = true; }, 6000);
  }

  /* ---------------- top bar, hero, colours, glossary ---------------- */
  function clearProductHash() {
    if (/^#\/p\//.test(location.hash)) { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ } }
  }
  function goSetup(preselect) {
    state.onboarded = false; save();
    clearProductHash();
    if (preselect && !state.cats.includes(preselect)) state.cats.push(preselect);
    renderPrepare(); show('prepare');
  }
  function goDashboard(view, anchor) {
    if (!state.onboarded) { if (anchor === 'how') { show('welcome'); $('#steps').scrollIntoView({ behavior: 'smooth' }); } else goSetup(view); return; }
    if (view) {
      if (!state.cats.includes(view)) { state.cats.push(view); state.cats.sort((x, y) => CATEGORIES.findIndex(c => c.id === x) - CATEGORIES.findIndex(c => c.id === y)); }
      state.view = view; save();
    }
    clearProductHash();
    openDashboard();
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor).scrollIntoView({ behavior: 'smooth' }));
  }

  function renderProductsMenu() {
    $('#productsMenu').innerHTML = CATEGORIES.map(c => `<button type="button" data-menuview="${c.id}">${esc(c.name)}<small>${PRODUCTS.filter(p => p.cat === c.id).length}</small></button>`).join('');
  }
  const closeMenus = () => { $('#productsMenu').hidden = true; $('#productsBtn').setAttribute('aria-expanded', 'false'); };
  $('#productsBtn').addEventListener('click', e => {
    e.stopPropagation();
    const m = $('#productsMenu'); m.hidden = !m.hidden;
    $('#productsBtn').setAttribute('aria-expanded', !m.hidden);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeMenus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
  $('.topbar').addEventListener('click', e => {
    const t = e.target.closest('[data-nav], [data-menuview], #logo, #burger');
    if (!t) return;
    if (t.id === 'burger') { const open = $('#nav').classList.toggle('open'); t.setAttribute('aria-expanded', open); return; }
    $('#nav').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false');
    if (t.id === 'logo') { e.preventDefault(); state.onboarded ? goDashboard() : (clearProductHash(), show('welcome')); }
    else if (t.dataset.menuview) { closeMenus(); goDashboard(t.dataset.menuview, 'results'); }
    else if (t.dataset.nav === 'recommend') goDashboard();
    else if (t.dataset.nav === 'how') goDashboard(null, 'how');
    else if (t.dataset.nav === 'glossary') goDashboard(null, 'glossary');
    else if (t.dataset.nav === 'vsai') goDashboard(null, 'vsai');
    else if (t.dataset.nav === 'setup') goSetup();
  });

  function renderHero() {
    const n = c => PRODUCTS.filter(p => p.cat === c).length;
    $('#heroStats').innerHTML = `<div><b>${PRODUCTS.length}</b><span>Products</span></div><div><b>${GAMES.length}</b><span>Games</span></div><div><b>${CATEGORIES.length}</b><span>Product types</span></div><div><b>${n('mouse')}</b><span>Mice</span></div>`;
    const p = PROD.viperv3;
    $('#heroArt').innerHTML = (art.hasPhoto(p) ? `<div class="heroph">${art(p)}</div>` : art(p))
      + `<div class="chipstat c1"><small>Weight</small><b>${p.weight} g</b></div><div class="chipstat c2"><small>Lowest price</small><b>${money(p.price)}</b></div><div class="chipstat c3"><small>${esc(p.brand)}</small><b>${esc(p.name)}</b></div>`;
  }

  // Plain-English explanations for newcomers; the AI assistant uses the same list.
  function renderGlossary() {
    $('#glossaryGrid').innerHTML = GLOSSARY.map(g => `<article class="card gterm" id="term-${g.id}"><span class="gtag">${esc(g.cat)}</span><h3>${esc(g.term)}</h3><p>${esc(g.text)}</p></article>`).join('');
  }
  $('#build').addEventListener('click', buildDashboard);
  $('#prepForm').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.defaultPrevented) buildDashboard(); });

  // Clicking an alternative jumps to its card, or opens the full ranking where it's listed.
  $('#out').addEventListener('click', e => {
    const link = e.target.closest('[data-product]');
    if (link && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) {
      e.preventDefault();
      return openProduct(link.dataset.product, link.closest('.card')?.querySelector('.pimg'));
    }
    const a = e.target.closest('[data-goto]');
    if (!a) {
      const card = e.target.closest('.card.clickable');
      if (card && !e.target.closest('a, button, summary, input, select')) openProduct(card.id.replace('card-', ''), card.querySelector('.pimg'));
      return;
    }
    const id = a.dataset.goto;
    let el = document.getElementById('card-' + id);
    if (!el) {
      const det = $('#out details.allrank');
      if (det) { det.open = true; el = det.querySelector(`.row[data-id="${id}"]`); }
    }
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }
  });


  /* ---------------- product page ---------------- */
  let dashScroll = 0;
  try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }
  const productId = () => { const m = location.hash.match(/^#\/p\/([\w-]+)$/); return m && PROD[m[1]] ? m[1] : null; };
  const dots = n => '●'.repeat(n) + '○'.repeat(5 - n);

  function specRows(p) {
    const yes = v => (v ? 'Yes' : 'No');
    const conn = p.wireless ? 'Wireless' : 'Wired';
    let rows = [];
    if (p.cat === 'mouse') rows = [
      ['Weight', p.weight == null ? 'Not confirmed (listings disagree)' : `${p.weight} g`],
      ['Shape', { right: 'Right-handed ergonomic', ambi: 'Ambidextrous, side buttons on both sides', sym: 'Symmetric, side buttons on the left' }[p.handed]],
      ['Suits hand sizes', p.sizes.map(z => cap(HAND_WORD[z])).join(', ')],
      ['Best grips', p.grips.map(cap).join(', ')],
      ['Connection', conn]];
    if (p.cat === 'keyboard') rows = [
      ['Layout', cap(LAYOUT_WORD[p.layout])], ['Connection', conn], ['Rapid Trigger', yes(p.rapid)],
      ['Typing noise', p.noise >= .75 ? 'Quiet' : p.noise >= .5 ? 'Moderate' : 'Loud'], ['Wrist rest included', yes(p.wristRest)]];
    if (p.cat === 'headset') rows = [
      ['Weight', `${p.weight} g`], ['Design', `${cap(p.back)}-back`], ['Connection', conn],
      ['Platforms', p.platforms.map(x => PLATFORMS[x]).join(', ')], ['Clamp force', cap(p.clamp)]];
    if (p.cat === 'monitor') rows = [['Panel', p.spec], ['Screen size', `${p.size}"`], ['HDMI 2.1', yes(p.hdmi21)]];
    if (p.cat === 'controller') rows = p.wheel
      ? [['Type', 'Racing wheel and pedals'], ['Platforms', p.platforms.map(x => PLATFORMS[x]).join(', ')], ['Connection', 'Wired']]
      : [['Type', 'Gamepad'], ['Platforms', p.platforms.map(x => PLATFORMS[x]).join(', ')], ['Connection', conn], ['Weight', `${p.weight} g`], ['Hall-effect sticks', yes(p.hall)], ['Back buttons', yes(p.paddles)]];
    if (p.cat === 'mousepad') rows = [['Size', `${p.w} × ${p.h} mm`], ['Thickness', `${p.thick} mm`], ['Surface', p.surface]];
    rows.push(['Lowest shop price', money(p.price)]);
    if (p.msrp) rows.push(['Official list price', moneyExact(p.msrp)]);
    rows.push(['Popularity (not scored)', dots(p.pop)]);
    return rows;
  }

  // How well this product suits one game, using only the dimensions that game cares about.
  function fitForGame(p, g) {
    let num = 0, den = 0;
    for (const d in p.traits) { const w = g.needs[d] || 0; num += w * p.traits[d]; den += w; }
    const total = Object.values(g.needs).reduce((x, y) => x + y, 0);
    // Only games that lean on what this product does: at least 30% of what the game asks for.
    return den >= .4 && den / total >= .3 ? num / den : null;
  }

  function renderProduct(id) {
    const p = PROD[id], cat = CAT[p.cat], needs = computeNeeds();
    const r = evaluate(p, needs);
    const reason = compatibility(p);
    const { pool } = rankCategory(cat, needs);
    const alts = alternatives(r, pool.some(x => x.p.id === id) ? pool : [...pool, r]);
    const similar = pool.filter(x => x.p.id !== id).slice(0, 3);
    // Leave out games the product isn't used for: controller games for desk gear, and non-pad games for controllers.
    const relevant = g => ['mouse', 'keyboard', 'mousepad'].includes(p.cat) ? (g.needs.pad || 0) < .8
      : p.cat === 'controller' ? (g.needs.pad || 0) >= .3 || (g.needs.racing || 0) >= .5 : true;
    const games = GAMES.filter(relevant).map(g => ({ g, fit: fitForGame(p, g) })).filter(x => x.fit != null).sort((x, y) => y.fit - x.fit).slice(0, 8);
    const listTag = shopRegion() === 'US' && p.msrp && Math.abs(p.msrp - p.price) >= 1 ? `<s>List ${moneyExact(p.msrp)}</s>` : '';
    const shop = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(p.brand + ' ' + p.name)}`;
    const bar = (name, v) => `<div class="bar">${name}<i style="--w:${Math.round(v * 100)}%"></i><span>${Math.round(v * 100)}</span></div>`;
    const mini = x => `<a class="altcard glass" href="#/p/${x.p.id}" data-product="${x.p.id}"><span class="altart cat-${x.p.cat}">${art(x.p)}</span><span class="alttxt"><small>${esc(x.p.brand)}</small><b>${esc(x.p.name)}</b><em>${money(x.p.price)} · ${x.match}% match</em></span></a>`;
    const alt = (lbl, x) => x ? `<div><h4>${lbl}</h4>${mini(x)}</div>` : '';

    $('#productBody').innerHTML = `
      <div class="pbar"><button type="button" class="pback" id="pback"><span aria-hidden="true">←</span> Back to ${esc(cat.name.toLowerCase())}</button>
        <span class="crumbs">${esc(cat.name)} / ${esc(p.brand)} ${esc(p.name)}</span></div>
      <div class="phero cat-${p.cat}">
        <div class="pheroart glass${art.hasPhoto(p) ? ' has-photo' : ''}">${art(p)}</div>
        <div class="pinfo">
          <div class="brandline">${esc(p.brand)}</div>
          <h1>${esc(p.name)}</h1>
          <div class="badges">
            ${!r.within ? '<span class="badge over">Over your budget</span>' : '<span class="badge ok">In your budget</span>'}
            ${p.pop <= 2 ? '<span class="badge gem">Lesser-known pick</span>' : ''}
            <span class="badge">Popularity ${dots(p.pop)}</span>
          </div>
          <div class="pricebig"><b>${moneyExact(p.price)}</b><span>${esc(whereLine(p))}</span>${listTag}</div>
          <div class="matchrow">
            <div class="ring" style="--p:${r.match};--c:${toneColor(r.match)}" role="img" aria-label="${r.match}% match"><b>${r.match}%<small>MATCH</small></b></div>
            <div class="bars">${bar('Game fit', r.parts.game)}${bar('Comfort', r.parts.comfort)}${bar('Value', r.parts.value)}</div>
          </div>
          ${reason ? `<p class="catnote">Heads up: this ${esc(cat.one)} is hidden from your results because it ${esc(reason)}.</p>` : ''}
          <a class="pillbtn buy" href="#shops" data-scroll="shops">Compare ${p.offers.length} shop price${p.offers.length === 1 ? '' : 's'} <span aria-hidden="true">↓</span></a>
        </div>
      </div>

      <div class="pcols">
        <section class="glass psec"><h2>Why it matches you</h2>
          <ul class="why">${r.why.map(t => `<li>${esc(t)}</li>`).join('')}${r.warn.map(t => `<li class="warn">${esc(t)}</li>`).join('')}</ul></section>
        <section class="glass psec"><h2>Specifications</h2>
          <dl class="specs">${specRows(p).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${jargon(v)}</dd></div>`).join('')}</dl></section>
      </div>

      <div class="pcols">
        <section class="glass psec sw"><div class="pro"><h2>Strengths</h2><ul>${p.pros.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>
          <div class="con"><h2>Weaknesses</h2><ul>${p.cons.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div></section>
        <section class="glass psec"><h2>How it suits different games</h2>
          <p class="psub">Based only on what each game asks of a ${esc(cat.one)}. Games you picked are marked.</p>
          <div class="gamefits">${games.map(({ g, fit }) => `<div class="gf${state.games.includes(g.id) ? ' mine' : ''}"><span>${esc(g.name)}${state.games.includes(g.id) ? ' ✓' : ''}</span><i style="--w:${Math.round(fit * 100)}%"></i><b>${Math.round(fit * 100)}%</b></div>`).join('')}</div></section>
      </div>

      ${shopTable(p, shop)}
      ${alts.cheaper || alts.pricier ? `<section class="psec2"><h2>Other price points</h2><div class="altrow">${alt('Spend less', alts.cheaper)}${alt('Spend more', alts.pricier)}</div></section>` : ''}
      ${similar.length ? `<section class="psec2"><h2>Similar ${esc(cat.name.toLowerCase())} that match you</h2><div class="simgrid">${similar.map(mini).join('')}</div></section>` : ''}`;
  }

  // Shop notes in plain words: "listing (white), was 74.99" -> "White, was $74.99".
  function niceNote(o) {
    let n = (o.note || '').replace(/^listing,?\s*/i, '').replace(/^\(([^)]*)\)/, '$1').replace(/\blisting\b/gi, 'shop page');
    n = n.replace(/\b(was|list|comp\. value|MSRP|MRP|regular price) (\d+(?:\.\d+)?)/gi, (m, w, v) => `${w.toLowerCase() === 'comp. value' ? 'usual price' : w} ${o.cur === 'USD' ? moneyExact(+v) : v}`);
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : 'New';
  }

  // Every shop we found the product at, cheapest first, each with its link and when its price was checked.
  function shopTable(p, search) {
    if (!p.offers.length) return '';
    const when = o => o.live ? `<span class="livetag">Live</span> ${esc(ago(LIVE.updated))}` : `Checked ${esc(SAVED.checkedLabel)}`;
    const here = shopRegion();
    const head = (o, i) => (i === 0 || offerRegion(p.offers[i - 1]) !== offerRegion(o))
      ? `<tr class="regionrow"><th colspan="5">${offerRegion(o) === 'IN' ? 'Shops in India' : 'Shops in the US'}${offerRegion(o) === here ? '' : ' (for comparison)'}</th></tr>` : '';
    const rows = p.offers.map((o, i) => `${head(o, i)}<tr${o === p.bestOffer ? ' class="best"' : ''}>
      <th scope="row">${esc(o.store)}${o === p.bestOffer ? ' <span class="badge ok">Lowest</span>' : ''}</th>
      <td class="num">${offerMoney(o)}</td>
      <td class="note">${esc(niceNote(o))}</td>
      <td class="when">${when(o)}</td>
      <td><a class="shoplink" href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">Visit <span aria-hidden="true">↗</span></a></td></tr>`).join('');
    return `<section class="glass psec shops" id="shops"><h2>Prices at different shops</h2>
      <p class="psub">${p.offers.some(o => offerRegion(o) === here) ? '' : `We haven't found this at a shop in ${REGION_NAME[here]} yet, so these are prices elsewhere. `}${LIVE && p.offers.some(o => o.live) ? `Prices marked Live come straight from the shop (${esc(LIVE.source || 'shop price service')}), updated ${esc(ago(LIVE.updated))}. ` : ''}Other prices were read from each shop's own page on ${esc(SAVED.checkedLabel)}. Shops change prices often, so the price on the shop's page is the one that counts.</p>
      <div class="tablewrap"><table><thead><tr><th>Shop</th><th>Price</th><th>Details</th><th>When</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="psub"><a href="${search}" target="_blank" rel="noopener noreferrer">Search more shops on Google Shopping ↗</a></p></section>`;
  }

  // The View Transitions API gives the card-expands-into-page animation where the browser supports it.
  function swap(fn) {
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = document.startViewTransition(fn);
      t.ready.catch(() => { /* skipped because a newer navigation started: fine */ });
      t.finished.finally(() => document.querySelectorAll('.vt-src').forEach(el => el.classList.remove('vt-src')));
    } else fn();
  }

  function openProduct(id, srcEl) {
    const fromDash = !$('#dashboard').hidden;
    if (fromDash) dashScroll = window.scrollY;
    if (srcEl && fromDash) srcEl.classList.add('vt-src'); // only the dashboard card morphs; product to product just fades
    // Moving between products replaces the history entry, so Back always returns to the results.
    try { history[fromDash ? 'pushState' : 'replaceState']({ pp: id }, '', '#/p/' + id); } catch { /* sandboxed: still show the page */ }
    swap(() => { renderProduct(id); show('product'); });
  }

  function route(animate) {
    if (!state.onboarded) return;
    const id = productId();
    const go = () => {
      if (id) { renderProduct(id); show('product'); }
      else { show('dashboard', true); window.scrollTo(0, dashScroll); }
    };
    animate ? swap(go) : go();
  }

  $('#product').addEventListener('click', e => {
    const jump = e.target.closest('[data-scroll]');
    if (jump) { e.preventDefault(); document.getElementById(jump.dataset.scroll).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (e.target.closest('#pback')) {
      if (history.state && history.state.pp) history.back();
      else { try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ } route(true); }
      return;
    }
    const link = e.target.closest('[data-product]');
    if (link && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) {
      e.preventDefault();
      openProduct(link.dataset.product, null);
    }
  });
  window.addEventListener('popstate', () => route(true));

  // A small surface for the AI assistant (chat.js); everything else stays private.
  window.GearGuide = {
    get state() { return state; }, CAT, GAME, PROD, GLOSSARY, BUDGETS,
    computeNeeds, evaluate, rankCategory, alternatives, compatibility, fitForGame, specRows, specLine, comfort,
    budgetCap, bracketLabel, money, moneyExact, roundMoney, findGame, ALIASES, list, art, PLATFORMS, HAND_WORD, CURRENCY_NAMES,
    get fx() { return fx; },
    openProduct: id => openProduct(id, null),
    onboarded: () => state.onboarded,
  };

  renderProductsMenu();
  renderHero();
  renderGlossary();
  // Returning visitors go straight to their dashboard (or the product page in the link).
  if (state.onboarded) { openDashboard(); route(false); } else show('welcome');
  loadRates();
  loadLivePrices();
})();
