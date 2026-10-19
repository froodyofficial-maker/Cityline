/* GearGuide: scores every product against the user's games, body, setup and budget,
   then explains the score. Popularity (`pop`) is display-only. */
(() => {
  const { DIMS, CATEGORIES, PLATFORMS, GAMES, PRODUCTS, PRICES_CHECKED } = window.LOADOUT;
  const art = window.LOADOUT_ART;
  const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  const GAME = Object.fromEntries(GAMES.map(g => [g.id, g]));
  const PROD = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const STORE = 'gearguide-prefs-v1';

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
    mouse: [[0, 40], [40, 80], [80, 120], [120, 180], [180, null]],
    keyboard: [[0, 60], [60, 120], [120, 180], [180, 260], [260, null]],
    headset: [[0, 60], [60, 120], [120, 200], [200, 300], [300, null]],
    monitor: [[0, 200], [200, 350], [350, 700], [700, 1200], [1200, null]],
    controller: [[0, 60], [60, 120], [120, 220], [220, null]],
  };
  const DEFAULT_BUDGET = { mouse: 2, keyboard: 2, headset: 2, monitor: 2, controller: 1 };
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
  // Round a USD amount, after conversion, to two significant figures for bracket labels.
  function roundMoney(usd) {
    const v = usd * rate();
    if (v < 10) return fmt(usd, false);
    const step = 10 ** (Math.floor(Math.log10(v)) - 1);
    return new Intl.NumberFormat(LOCALE[cur()] || 'en-US', { style: 'currency', currency: cur(), maximumFractionDigits: 0 }).format(Math.round(v / step) * step);
  }
  function bracketLabel(cat, i) {
    const [lo, hi] = BUDGETS[cat][i];
    if (!lo) return `Under ${roundMoney(hi)}`;
    if (hi == null) return `${roundMoney(lo)} and up`;
    return `${roundMoney(lo)} – ${roundMoney(hi)}`;
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
    if (den < .15) {
      const t = Object.values(p.traits);
      return .1 + .8 * t.reduce((a, b) => a + b, 0) / t.length;
    }
    return num / den;
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
      if (s.weight === 'light') w <= 62 ? add(1, `${w} g, in your 40–60 g range`) : add(w <= 80 ? .65 : .3, null, `${w} g is heavier than your 40–60 g preference`);
      if (s.weight === 'balanced') w >= 58 && w <= 92 ? add(1, `${w} g, in your 60–90 g range`) : add(.7, null, `${w} g is ${w < 60 ? 'lighter' : 'heavier'} than the 60–90 g you want`);
      if (s.weight === 'heavy') w >= 90 ? add(1, `${w} g, the planted feel you like`) : add(w >= 70 ? .75 : .5, null, `${w} g may feel floaty if you like some heft`);
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
    const g = gameFit(p, needs);
    const c = comfort(p);
    const b = within ? 1 : Math.max(0, 1 - 2 * (p.price - budget) / budget);
    const wC = state.long ? .36 : .3, wG = .9 - wC;
    const match = Math.round(Math.min(98, Math.max(20, 100 * (wG * g + wC * c.score + .1 * b))));

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

    return { p, match, within, parts: { game: g, comfort: c.score, budget: b }, why, warn };
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
    if (p.cat === 'mouse') return `${p.weight} g · ${p.handed === 'right' ? 'Right-hand ergonomic' : p.handed === 'ambi' ? 'Ambidextrous' : 'Symmetric'} · ${p.wireless ? 'Wireless' : 'Wired'}`;
    if (p.cat === 'keyboard') return `${cap(LAYOUT_WORD[p.layout])} · ${p.rapid ? 'Rapid Trigger · ' : ''}${p.wireless ? 'Wireless' : 'Wired'}`;
    if (p.cat === 'headset') return `${p.weight} g · ${cap(p.back)}-back · ${p.wireless ? 'Wireless' : 'Wired'} · ${p.platforms.map(x => PLATFORMS[x]).join(', ')}`;
    if (p.cat === 'monitor') return p.spec;
    return `${p.platforms.map(x => PLATFORMS[x]).join(', ')} · ${p.wireless ? 'Wireless' : 'Wired'}${p.hall ? ' · Hall-effect sticks' : ''}${p.paddles ? ' · Back buttons' : ''}`;
  }

  function card(r, i, pool, sortedByMatch) {
    const { p } = r;
    const alts = alternatives(r, pool);
    const label = !sortedByMatch ? (r.within ? 'Within budget' : 'Over budget') : i === 0 ? 'Closest fit for you' : 'Also a strong fit';
    const badges = [
      !r.within ? '<span class="badge over">Over budget</span>' : p.price < budgetLow(p.cat) ? '<span class="badge ok">Under your range</span>' : '<span class="badge ok">In your budget</span>',
      p.pop <= 2 ? '<span class="badge gem" title="Ranked on fit alone. Popularity is never part of the score.">Lesser-known pick</span>' : '',
      `<span class="badge" title="Shown for context only. It does not affect the match.">Popularity ${'●'.repeat(p.pop)}${'○'.repeat(5 - p.pop)}</span>`,
    ].join('');
    const bar = (name, v) => `<div class="bar">${name}<i style="--w:${Math.round(v * 100)}%"></i><span>${Math.round(v * 100)}</span></div>`;
    const alt = (lbl, a) => a ? `<button type="button" class="alt" data-goto="${a.p.id}"><span class="lbl">${lbl}</span><span class="nm">${esc(a.p.brand)} ${esc(a.p.name)}</span><span class="pc">${money(a.p.price)}</span><span class="pill ${tone(a.match)}">${a.match}%</span></button>` : '';
    const altHtml = alt('Spend less', alts.cheaper) + alt('Spend more', alts.pricier);

    const listTag = p.msrp && Math.abs(p.msrp - p.price) >= 1 ? `<s title="Manufacturer list price">List ${moneyExact(p.msrp)}</s>` : '';
    const shop = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(p.brand + ' ' + p.name)}`;
    return `<article class="card glass cat-${p.cat}${i === 0 && sortedByMatch ? ' first' : ''}" id="card-${p.id}">
      <div class="pimg${art.hasPhoto(p) ? ' has-photo' : ''}">${art(p)}
        <div class="ring" style="--p:${r.match};--c:${toneColor(r.match)}" role="img" aria-label="${r.match}% match"><b>${r.match}%<small>MATCH</small></b></div>
        <div class="rank">${label}</div>
        <button type="button" class="phbtn" data-photo="${p.id}" aria-haspopup="menu" aria-label="Add or change the photo of the ${esc(p.brand)} ${esc(p.name)}" title="${userPhotos[p.id] ? 'Change photo' : 'Add a real photo'}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></button>
      </div>
      <div class="ctop">
        <div class="ctitle">
          <div class="brandline">${esc(p.brand)}</div>
          <h4>${esc(p.name)}</h4>
        </div>
        <div class="pricebox"><b>${money(p.price)}</b><span>typical price</span>${listTag}</div>
      </div>
      <a class="shop" href="${shop}" target="_blank" rel="noopener noreferrer">Check live prices ↗</a>
      <div class="badges">${badges}</div>
      <div class="spec">${esc(specLine(p))}</div>
      <div class="bars">${bar('Game fit', r.parts.game)}${bar('Comfort', r.parts.comfort)}${bar('Budget', r.parts.budget)}</div>
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
    if ((cat.id === 'mouse' || cat.id === 'keyboard') && consoleOnly())
      return 'Few console games support mouse and keyboard well. Consider skipping this category.';
    if ((cat.id === 'mouse' || cat.id === 'keyboard') && needs.pad >= .8 && needs.aim < .5 && needs.binds < .5)
      return `Your games play best on a controller, so a ${cat.one} matters less here.`;
    if (cat.id === 'controller' && needs.racing >= .6) {
      const wheel = PRODUCTS.find(p => p.wheel);
      return wheel.price > budgetCap('controller')
        ? `You play racing games. A wheel like the ${wheel.brand} ${wheel.name} (${money(wheel.price)}) transforms them, but it's above your budget. Raise the budget to see it ranked.`
        : 'You play racing games, so a wheel is ranked alongside regular controllers.';
    }
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
    let top = ordered.slice(0, 3);
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

    out.innerHTML = `
      ${note ? `<div class="catnote">${esc(note)}</div>` : ''}
      ${hidden.length ? `<div class="hidden-note">Hidden ${hidden.length}: ${hidden.map(h => `${esc(h.p.brand)} ${esc(h.p.name)} (${esc(h.reason)})`).join(', ')}.</div>` : ''}
      ${emptyMsg}
      <div class="cards">${top.map((r, i) => card(r, i, pool, sortedByMatch && !emptyMsg)).join('')}</div>
      ${rest.length ? `<details class="allrank glass"><summary>See all ${pool.length} ranked ${cat.name.toLowerCase()}</summary>
        <div class="rows">${rest.map(r => `<div class="row${r.within ? '' : ' over'}" data-id="${r.p.id}">
          <span class="pill ${tone(r.match)}">${r.match}%</span>
          <span class="rn"><span class="thumb cat-${r.p.cat}">${art(r.p)}</span><span>${esc(r.p.brand)} ${esc(r.p.name)}<small>${esc(r.why[0] || r.p.pros[0])}</small></span></span>
          <span class="rtag">${r.within ? (r.p.pop <= 2 ? '<span class="badge gem">Lesser-known</span>' : '') : `<span class="tag">+${money(r.p.price - limit)} over</span>`}</span>
          <span class="rp">${money(r.p.price)}</span>
        </div>`).join('')}</div></details>` : ''}`;
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
    $('#fxnote').textContent = state.currency === 'USD'
      ? `Prices are typical US prices checked ${PRICES_CHECKED}.`
      : `Prices are converted from US prices (checked ${PRICES_CHECKED}) at ${state.currency === 'INR' && !fx.live ? 'the market rate' : 'ECB rates'} of ${d}; local shops often differ because of taxes and import duties.`;
  }

  async function loadRates() {
    for (const url of ['https://api.frankfurter.dev/v1/latest?base=USD', 'https://api.frankfurter.app/latest?from=USD']) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        if (!data.rates || !data.rates.EUR) continue;
        fx = { live: true, date: data.date, dates: {}, rates: { ...fx.rates, ...data.rates, USD: 1 } };
        renderCurrency();
        if (!$('#dashboard').hidden) { renderBudget(); renderResults(); }
        return;
      } catch { /* offline or blocked: keep saved rates */ }
    }
  }

  /* ---------------- your own product photos ----------------
     Photos you upload (resized) or image links you paste are kept in this browser and
     override images.js. A link that fails to load falls back to the illustration. */
  const PHOTO_STORE = 'gearguide-photos-v1';
  window.LOADOUT_IMAGES = window.LOADOUT_IMAGES || {};
  const BASE_IMAGES = { ...window.LOADOUT_IMAGES };
  let userPhotos = {};
  try { userPhotos = JSON.parse(localStorage.getItem(PHOTO_STORE) || '{}') || {}; } catch { /* storage unavailable */ }
  Object.assign(window.LOADOUT_IMAGES, userPhotos);

  function setPhoto(id, src) {
    const next = { ...userPhotos };
    if (src) next[id] = src; else delete next[id];
    try { localStorage.setItem(PHOTO_STORE, JSON.stringify(next)); }
    catch { alert('Your browser is out of space for photos. Remove a few, or use image links instead.'); return; }
    userPhotos = next;
    if (src) window.LOADOUT_IMAGES[id] = src;
    else if (BASE_IMAGES[id]) window.LOADOUT_IMAGES[id] = BASE_IMAGES[id];
    else delete window.LOADOUT_IMAGES[id];
    renderResults();
  }

  // Shrink uploads to at most 640 px on a white background so they fit in browser storage.
  function readPhoto(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 640 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL('image/jpeg', .85));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  let photoFor = null;
  function openPhotoMenu(btn) {
    photoFor = btn.dataset.photo;
    const m = $('#photoMenu');
    m.querySelector('[data-act="remove"]').hidden = !userPhotos[photoFor];
    m.querySelector('.pm-title').textContent = `${PROD[photoFor].brand} ${PROD[photoFor].name}`;
    m.hidden = false;
    const r = btn.getBoundingClientRect();
    m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + 'px';
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
    m.querySelector('button:not([hidden])').focus();
  }
  const closePhotoMenu = () => { $('#photoMenu').hidden = true; };

  $('#photoMenu').addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const id = photoFor;
    closePhotoMenu();
    if (act === 'upload') $('#photoFile').click();
    if (act === 'remove') setPhoto(id, null);
    if (act === 'link') {
      const url = prompt('Paste an image link.\nTip: on the brand or shop page, right-click the product photo and choose "Copy image address".');
      if (url == null) return;
      if (!/^https?:\/\/\S+$/i.test(url.trim())) { alert('That doesn\'t look like an image link. It should start with https://'); return; }
      setPhoto(id, url.trim());
    }
  });
  $('#photoFile').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !photoFor) return;
    try { setPhoto(photoFor, await readPhoto(file)); }
    catch { alert('That file could not be read as an image.'); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePhotoMenu(); });
  document.addEventListener('click', e => {
    if (!$('#photoMenu').hidden && !e.target.closest('#photoMenu') && !e.target.closest('[data-photo]')) closePhotoMenu();
  });

  /* ---------------- screens ---------------- */
  const SCREENS = ['welcome', 'prepare', 'loading', 'dashboard'];
  function show(id) {
    SCREENS.forEach(s => { $('#' + s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function renderPrepare() {
    $('#gameList').innerHTML = GAMES.map(g => `<option value="${esc(g.name)}">`).join('');
    const names = state.games.map(id => GAME[id].name);
    $('#prepGames').innerHTML = [0, 1, 2, 3].map(i => `<input class="line" list="gameList" aria-label="Game ${i + 1}" placeholder="${i ? '' : 'e.g. Minecraft'}" value="${esc(names[i] || '')}">`).join('');
    $('#prepHand').value = state.handCm || '';
    $('#prepProducts').innerHTML = CATEGORIES.map(c => `<label class="check"><input type="checkbox" value="${c.id}" ${state.cats.includes(c.id) ? 'checked' : ''}><i></i>${cap(c.one)}</label>`).join('');
    $('#prepError').textContent = '';
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
    state.onboarded = true;
    save();
    show('loading');
    const wait = matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 1300;
    setTimeout(openDashboard, wait);
  }

  function openDashboard() {
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
    $('#budget').innerHTML = BUDGETS[state.view].map((_, i) => `<option value="${i}" ${i === state.budget[state.view] ? 'selected' : ''}>${bracketLabel(state.view, i)}</option>`).join('');
  }
  function renderTypes() {
    $('#types').innerHTML = state.cats.map(id => `<button type="button" class="chip" data-view="${id}" aria-pressed="${id === state.view}">${cap(CAT[id].one)}</button>`).join('');
    $('#cats').innerHTML = CATEGORIES.map(c => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${state.cats.includes(c.id)}">${cap(c.one)}</button>`).join('');
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
  }

  let timer = 0;
  function changed() {
    save();
    clearTimeout(timer);
    timer = setTimeout(renderResults, 60);
  }
  const toggleIn = (arr, v) => { const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); };

  $('#side').addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;
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
    } else if (t.dataset.cat) {
      if (state.cats.length === 1 && state.cats[0] === t.dataset.cat) return; // keep at least one
      toggleIn(state.cats, t.dataset.cat);
      state.cats.sort((a, b) => CATEGORIES.findIndex(c => c.id === a) - CATEGORIES.findIndex(c => c.id === b));
      if (!state.cats.includes(state.view)) state.view = state.cats[0];
      renderTypes(); renderBudget(); changed();
    } else if (t.dataset.platform) {
      toggleIn(state.platforms, t.dataset.platform);
      t.setAttribute('aria-pressed', state.platforms.includes(t.dataset.platform));
      changed();
    } else if (t.id === 'restart') {
      state.onboarded = false; save();
      renderPrepare(); show('prepare');
    }
  });
  $('#side').addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'budget') state.budget[state.view] = +t.value;
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
  document.addEventListener('click', e => {
    if (!$('#gamePicker').hidden && !e.target.closest('#gamePicker') && e.target.id !== 'addGame') $('#gamePicker').hidden = true;
  });

  $('#sort').addEventListener('change', e => { state.sort = e.target.value; changed(); });
  $('#currency').addEventListener('change', e => { state.currency = e.target.value; save(); renderCurrency(); renderBudget(); renderResults(); });

  $('#start').addEventListener('click', () => { renderPrepare(); show('prepare'); });
  $('#build').addEventListener('click', buildDashboard);
  $('#prepForm').addEventListener('keydown', e => { if (e.key === 'Enter') buildDashboard(); });

  // Clicking an alternative jumps to its card, or opens the full ranking where it's listed.
  $('#out').addEventListener('click', e => {
    const ph = e.target.closest('[data-photo]');
    if (ph) return openPhotoMenu(ph);
    const a = e.target.closest('[data-goto]');
    if (!a) return;
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

  // Returning visitors go straight to their dashboard.
  if (state.onboarded) openDashboard(); else show('welcome');
  loadRates();
})();
