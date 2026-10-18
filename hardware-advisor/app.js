/* Loadout: scores every product against the user's games, body, setup and budget,
   then explains the score. Popularity (`pop`) is display-only. */
(() => {
  const { DIMS, CATEGORIES, PLATFORMS, GAMES, PRODUCTS } = window.LOADOUT;
  const CAT = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  const GAME = Object.fromEntries(GAMES.map(g => [g.id, g]));
  const PROD = Object.fromEntries(PRODUCTS.map(p => [p.id, p]));
  const STORE = 'loadout-prefs-v1';

  const OPTIONS = {
    hand: [['S', 'Small'], ['M', 'Medium'], ['L', 'Large']],
    grip: [['palm', 'Palm'], ['claw', 'Claw'], ['fingertip', 'Fingertip'], ['unsure', 'Not sure']],
    handed: [['right', 'Right'], ['left', 'Left']],
    weight: [['light', 'Ultralight'], ['balanced', 'Balanced'], ['heavy', 'Heavier'], ['any', 'Any']],
    desk: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']],
    conn: [['any', 'Either'], ['wireless', 'Wireless'], ['wired', 'Wired']],
  };
  const HAND_WORD = { S: 'small', M: 'medium', L: 'large' };
  const LAYOUT_WORD = { full: 'full-size', tkl: 'tenkeyless', 75: '75%', 65: '65%', 60: '60%' };

  const DEFAULTS = {
    games: ['valorant', 'eldenring'],
    cats: CATEGORIES.map(c => c.id),
    budget: Object.fromEntries(CATEGORIES.map(c => [c.id, c.def])),
    platforms: ['pc'],
    hand: 'M', grip: 'claw', handed: 'right', weight: 'any',
    desk: 'medium', conn: 'any',
    glasses: false, long: false, quiet: false,
    sort: 'match',
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
      }
    } catch { /* storage unavailable: use defaults */ }
    return base;
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ } }

  /* ---------------- text helpers ---------------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + n.toLocaleString('en-US');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
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
    if (p.cat === 'mouse' && state.handed === 'left' && p.handed === 'right') return 'right-hand-only shape';
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
      const w = p.weight;
      if (s.weight === 'light') w <= 65 ? add(1, `${w} g, in your ultralight range`) : add(w <= 85 ? .65 : .3, null, `${w} g is heavy for your ultralight preference`);
      if (s.weight === 'balanced') w >= 60 && w <= 95 ? add(1, `${w} g, a balanced weight`) : add(.7, null, `${w} g is ${w < 60 ? 'lighter' : 'heavier'} than the balanced feel you want`);
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
    const budget = state.budget[p.cat];
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
    if (within) why.push(p.price <= budget * .6 ? `${money(p.price)}, well under your ${money(budget)} budget, which leaves money for the rest of your setup.` : `${money(p.price)} fits your ${money(budget)} ${CAT[p.cat].one} budget.`);
    else warn.push(`${money(p.price - budget)} over your ${money(budget)} budget.`);
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
      r.within ? '<span class="badge ok">Within budget</span>' : '<span class="badge over">Over budget</span>',
      p.pop <= 2 ? '<span class="badge gem" title="Ranked on fit alone. Popularity is never part of the score.">Lesser-known pick</span>' : '',
      `<span class="badge" title="Shown for context only. It does not affect the match.">Popularity ${'●'.repeat(p.pop)}${'○'.repeat(5 - p.pop)}</span>`,
    ].join('');
    const bar = (name, v) => `<div class="bar">${name}<i style="--w:${Math.round(v * 100)}%"></i><span>${Math.round(v * 100)}</span></div>`;
    const alt = (lbl, a) => a ? `<button type="button" class="alt" data-goto="${a.p.id}"><span class="lbl">${lbl}</span><span class="nm">${esc(a.p.brand)} ${esc(a.p.name)}</span><span class="pc">${money(a.p.price)}</span><span class="pill ${tone(a.match)}">${a.match}%</span></button>` : '';
    const altHtml = alt('Spend less', alts.cheaper) + alt('Spend more', alts.pricier);

    return `<article class="card${i === 0 && sortedByMatch ? ' first' : ''}" id="card-${p.id}">
      <div class="ctop">
        <div class="ctitle">
          <div class="rank">${label}</div>
          <h4>${esc(p.name)}</h4>
          <div class="brandline">${esc(p.brand)} · <span class="price">${money(p.price)}</span></div>
        </div>
        <div class="ring" style="--p:${r.match};--c:${toneColor(r.match)}" role="img" aria-label="${r.match}% match"><b>${r.match}%<small>MATCH</small></b></div>
      </div>
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
      return wheel.price > state.budget.controller
        ? `You play racing games. A wheel like the ${wheel.brand} ${wheel.name} (${money(wheel.price)}) transforms them, but it's above your ${money(state.budget.controller)} budget. Raise the budget to see it ranked.`
        : 'You play racing games, so a wheel is ranked alongside regular controllers.';
    }
    return rel < .3 ? `Your selected games don't lean heavily on a ${cat.one}, so comfort and value carry more weight.` : '';
  }

  function renderResults() {
    const needs = computeNeeds();
    const out = $('#out');
    const cats = CATEGORIES.filter(c => state.cats.includes(c.id));

    const g = state.games.map(id => GAME[id].name);
    $('#summary').textContent = (g.length ? `For ${list(g, 3)}` : 'No games picked yet, so these are general matches')
      + ` · ${state.platforms.length ? list(state.platforms.map(x => PLATFORMS[x]), 4) : 'any platform'}`
      + ` · ${HAND_WORD[state.hand]} hands, ${state.desk} desk`;

    if (!cats.length) {
      out.innerHTML = '<div class="empty-state">Pick at least one hardware category to see matches.</div>';
      return;
    }

    out.innerHTML = cats.map(cat => {
      const { pool, hidden } = rankCategory(cat, needs);
      const within = pool.filter(r => r.within);
      const ordered = state.sort === 'match' ? within : [...within].sort((a, b) => state.sort === 'low' ? a.p.price - b.p.price : b.p.price - a.p.price);
      const sortedByMatch = state.sort === 'match';
      let top = ordered.slice(0, 3);
      let emptyMsg = '';
      if (!top.length) {
        // Nothing fits the budget: show the closest stretch options instead of an empty shelf.
        top = [...pool].sort((a, b) => a.p.price - b.p.price).slice(0, 2);
        emptyMsg = `<div class="catnote">Nothing in our catalog fits a ${money(state.budget[cat.id])} ${cat.one} budget. Here are the closest options above it.</div>`;
      }
      const shown = new Set(top.map(r => r.p.id));
      const rest = pool.filter(r => !shown.has(r.p.id));
      const gems = top.filter(r => r.p.pop <= 2).length;
      const note = categoryNote(cat, needs);

      return `<section class="cat" id="cat-${cat.id}">
        <div class="cathead">
          <h3>${icon(cat.id)}${cat.name}</h3>
          <span class="catmeta">${within.length} of ${pool.length} within ${money(state.budget[cat.id])}${gems ? ` · ${gems} lesser-known pick${gems > 1 ? 's' : ''} in your top results` : ''}</span>
        </div>
        ${note ? `<div class="catnote">${esc(note)}</div>` : ''}
        ${hidden.length ? `<div class="hidden-note">Hidden ${hidden.length}: ${hidden.map(h => `${esc(h.p.brand)} ${esc(h.p.name)} (${esc(h.reason)})`).join(', ')}.</div>` : ''}
        ${emptyMsg}
        <div class="cards">${top.map((r, i) => card(r, i, pool, sortedByMatch && !emptyMsg)).join('')}</div>
        ${rest.length ? `<details class="more"><summary>See all ${pool.length} ranked ${cat.name.toLowerCase()}, including over-budget options</summary>
          <div class="rows">${rest.map(r => `<div class="row${r.within ? '' : ' over'}">
            <span class="pill ${tone(r.match)}">${r.match}%</span>
            <span class="rn">${esc(r.p.brand)} ${esc(r.p.name)}<small>${esc(r.why[0] || r.p.pros[0])}</small></span>
            <span class="rtag">${r.within ? (r.p.pop <= 2 ? '<span class="badge gem">Lesser-known</span>' : '') : `<span class="tag">+${money(r.p.price - state.budget[cat.id])} over</span>`}</span>
            <span class="rp">${money(r.p.price)}</span>
          </div>`).join('')}</div></details>` : ''}
      </section>`;
    }).join('');

    const u = $('#updated');
    u.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => u.classList.remove('on')));
  }

  /* ---------------- preference controls ---------------- */
  function chip(kind, id, label, sub, on) {
    return `<button type="button" class="chip" data-multi="${kind}" data-val="${id}" aria-pressed="${on}">${esc(label)}${sub ? ` <small>${esc(sub)}</small>` : ''}</button>`;
  }

  function renderControls() {
    $('#games').innerHTML = GAMES.map(g => chip('games', g.id, g.name, g.genre, state.games.includes(g.id))).join('');
    $('#cats').innerHTML = CATEGORIES.map(c => chip('cats', c.id, c.name, '', state.cats.includes(c.id))).join('');
    $('#platforms').innerHTML = Object.entries(PLATFORMS).map(([id, n]) => chip('platforms', id, n, '', state.platforms.includes(id))).join('');
    document.querySelectorAll('.seg').forEach(seg => {
      const key = seg.dataset.key;
      seg.setAttribute('role', 'radiogroup');
      seg.innerHTML = OPTIONS[key].map(([v, l]) => `<button type="button" role="radio" data-key="${key}" data-val="${v}" aria-checked="${state[key] === v}">${l}</button>`).join('');
    });
    document.querySelectorAll('input[type="checkbox"][data-key]').forEach(cb => { cb.checked = !!state[cb.dataset.key]; });
    $('#sort').value = state.sort;
    renderBudgets();
    syncCounts();
    filterGames();
  }

  function renderBudgets() {
    const cats = CATEGORIES.filter(c => state.cats.includes(c.id));
    $('#budgets').innerHTML = cats.length ? cats.map(c => `<div class="budget">
      <label for="b-${c.id}">${c.name} <output id="o-${c.id}">up to ${money(state.budget[c.id])}</output></label>
      <input id="b-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${state.budget[c.id]}" data-budget="${c.id}">
    </div>`).join('') : '<p class="empty">Select a category to set its budget.</p>';
  }

  function syncCounts() {
    $('#gameCount').textContent = state.games.length ? `${state.games.length} selected` : 'none selected';
  }

  function filterGames() {
    const q = $('#gameSearch').value.trim().toLowerCase();
    document.querySelectorAll('#games .chip').forEach(el => {
      const g = GAME[el.dataset.val];
      el.hidden = !!q && !(g.name.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q));
    });
  }

  let timer = 0;
  function changed() {
    save();
    clearTimeout(timer);
    timer = setTimeout(renderResults, 90);
  }

  $('#prefs').addEventListener('click', e => {
    const m = e.target.closest('[data-multi]');
    if (m) {
      const arr = state[m.dataset.multi], v = m.dataset.val, i = arr.indexOf(v);
      i >= 0 ? arr.splice(i, 1) : arr.push(v);
      m.setAttribute('aria-pressed', i < 0);
      if (m.dataset.multi === 'cats') renderBudgets();
      syncCounts();
      return changed();
    }
    const s = e.target.closest('.seg [data-key]');
    if (s) {
      state[s.dataset.key] = s.dataset.val;
      s.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b === s));
      changed();
    }
  });
  $('#prefs').addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.budget) {
      state.budget[t.dataset.budget] = +t.value;
      $('#o-' + t.dataset.budget).textContent = 'up to ' + money(+t.value);
      changed();
    } else if (t.type === 'checkbox' && t.dataset.key) {
      state[t.dataset.key] = t.checked;
      changed();
    } else if (t.id === 'gameSearch') filterGames();
  });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; changed(); });
  $('#reset').addEventListener('click', () => {
    state = structuredClone(DEFAULTS);
    $('#gameSearch').value = '';
    renderControls();
    changed();
  });

  // Clicking an alternative jumps to its card, or opens the full ranking where it's listed.
  $('#out').addEventListener('click', e => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    const id = a.dataset.goto;
    let el = document.getElementById('card-' + id);
    if (!el) {
      const sec = document.getElementById('cat-' + PROD[id].cat);
      const det = sec && sec.querySelector('details.more');
      if (det) {
        det.open = true;
        el = [...det.querySelectorAll('.row')].find(r => r.querySelector('.rn').textContent.startsWith(`${PROD[id].brand} ${PROD[id].name}`));
      }
    }
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }
  });

  renderControls();
  renderResults();
})();
