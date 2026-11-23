/* GearGuide AI: a chat helper aimed at people new to gaming hardware.
   - Built-in assistant (always available, works offline): answers from GearGuide's own catalogue,
     scoring engine and jargon buster.
   - Claude (optional): if the visitor saves their own Anthropic API key, open-ended questions go to
     Claude with the catalogue and their profile as context. The key stays in this browser and is
     sent only to api.anthropic.com, through the official SDK (vendor/anthropic-sdk.js, loaded on demand). */
(() => {
  const G = window.GearGuide;
  const { PRODUCTS, CATEGORIES, GAMES, DIMS } = window.LOADOUT;
  const MODEL = 'claude-opus-5-5';
  const KEY_STORE = 'gearguide-anthropic-key', USE_STORE = 'gearguide-use-claude';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  let claudeHistory = []; // Messages API history: user text + full assistant content, appended only
  let busy = false;
  let greeted = false;

  /* ---------------- panel ---------------- */
  const panel = $('#chat'), log = $('#chatLog'), input = $('#chatInput');
  const hasKey = () => !!store.get(KEY_STORE);
  const usingClaude = () => hasKey() && store.get(USE_STORE) !== 'off';

  function renderMode() {
    $('#chatMode').textContent = usingClaude()
      ? 'Claude (Opus 5.5) · using your API key'
      : "Built-in assistant · answers from GearGuide's data";
    $('#useClaude').checked = usingClaude();
    $('#useClaude').disabled = !hasKey();
    $('#apiKey').placeholder = hasKey() ? 'Key saved. Paste a new one to replace it.' : 'sk-ant-…';
  }

  function openChat() {
    panel.hidden = false;
    document.body.classList.add('chat-open');
    if (!greeted) {
      greeted = true;
      bot(`<p>Hi! I'm GearGuide's assistant, here to help if you're new to gaming gear.</p>
        <p>I can explain words like <b>DPI</b> or <b>Rapid Trigger</b>, suggest gear for your games and budget, compare two products, or tell you why a pick suits you.</p>`, 'Built-in');
    }
    renderSuggestions();
    renderMode();
    input.focus();
  }
  function closeChat() {
    panel.hidden = true;
    document.body.classList.remove('chat-open');
    $('#chatFab').focus();
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-open-chat], #askNav')) openChat(); });
  $('#chatClose').addEventListener('click', closeChat);
  panel.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(); });

  $('#chatSettingsBtn').addEventListener('click', () => {
    const s = $('#chatSettings');
    s.hidden = !s.hidden;
    $('#chatSettingsBtn').setAttribute('aria-expanded', !s.hidden);
    if (!s.hidden) $('#apiKey').focus();
  });
  $('#saveKey').addEventListener('click', () => {
    const k = $('#apiKey').value.trim();
    if (!k) { $('#apiKey').focus(); return; }
    store.set(KEY_STORE, k);
    store.set(USE_STORE, 'on');
    $('#apiKey').value = '';
    $('#chatSettings').hidden = true;
    $('#chatSettingsBtn').setAttribute('aria-expanded', 'false');
    renderMode();
    bot(k.startsWith('sk-ant-')
      ? '<p>Key saved in this browser. I\'ll answer with Claude from now on. You can switch back to the built-in assistant in ⚙ settings.</p>'
      : '<p>Key saved, but it doesn\'t look like an Anthropic key (they start with <code>sk-ant-</code>). If Claude rejects it, I\'ll tell you.</p>', 'Settings');
  });
  $('#removeKey').addEventListener('click', () => {
    store.set(KEY_STORE, null); store.set(USE_STORE, null);
    claudeHistory = [];
    renderMode();
    bot('<p>Key removed from this browser. I\'m back to the built-in assistant.</p>', 'Settings');
  });
  $('#useClaude').addEventListener('change', e => { store.set(USE_STORE, e.target.checked ? 'on' : 'off'); renderMode(); });

  function renderSuggestions() {
    const s = G.state;
    const m = usd => G.roundMoney(usd, false);
    let items;
    if (G.onboarded()) {
      const cat = G.CAT[s.view];
      const { pool } = G.rankCategory(cat, G.computeNeeds());
      const top = pool.filter(r => r.within);
      items = [
        `Why is my top ${cat.one} a good fit?`,
        top[1] ? `Compare ${top[0].p.name} vs ${top[1].p.name}` : `Cheaper ${cat.one} options?`,
        'What does DPI mean?',
        `Best ${cat.one} for ${s.games[0] ? G.GAME[s.games[0]].name : 'Minecraft'} under ${m(cat.id === 'monitor' ? 300 : 40)}`,
      ];
    } else {
      items = ["I'm new to PC gaming. Where do I start?", `Best mouse for Valorant under ${m(50)}`, 'What does Rapid Trigger mean?', 'Open-back or closed-back headset?'];
    }
    $('#chatSuggest').innerHTML = items.map(t => `<button type="button">${esc(t)}</button>`).join('');
  }
  $('#chatSuggest').addEventListener('click', e => { const b = e.target.closest('button'); if (b) send(b.textContent); });

  /* ---------------- messages ---------------- */
  function addMsg(cls, html) {
    const el = document.createElement('div');
    el.className = 'msg ' + cls;
    el.innerHTML = html;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }
  const bot = (html, src) => addMsg('bot', html + (src ? `<span class="src">${esc(src)}</span>` : ''));

  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; });
  $('#chatForm').addEventListener('submit', e => { e.preventDefault(); send(input.value); });

  async function send(text) {
    text = text.trim();
    if (!text || busy) return;
    input.value = ''; input.style.height = 'auto';
    addMsg('user', esc(text).replace(/\n/g, '<br>'));
    if (usingClaude()) {
      busy = true;
      try { await askClaude(text); } finally { busy = false; }
    } else {
      bot(answer(text), 'Built-in assistant · GearGuide data');
    }
    renderSuggestions();
  }

  // Product links inside chat answers open the product page.
  log.addEventListener('click', e => {
    const a = e.target.closest('[data-product]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (!G.onboarded()) { bot('<p>Set up your dashboard first (it takes 20 seconds), then I can open product pages for you.</p>'); return; }
    if (matchMedia('(max-width: 640px)').matches) closeChat();
    G.openProduct(a.dataset.product);
  });

  /* ---------------- built-in assistant ---------------- */
  const norm = s => s.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Find catalogue products named in the text, longest names first, in reading order.
  function findProducts(text) {
    const t = ' ' + norm(text) + ' ', compact = t.replace(/ /g, '');
    const hits = [];
    for (const p of PRODUCTS) {
      const base = p.name.replace(/\s*\(.*?\)\s*/g, '');
      const names = [`${p.brand} ${p.name}`, `${p.brand} ${base}`, p.name, base].map(norm).filter(n => n.length >= 2);
      for (const n of new Set(names)) {
        let at = t.indexOf(' ' + n + ' ');
        if (at < 0 && n.length >= 4) at = compact.indexOf(n.replace(/ /g, '')) >= 0 ? t.indexOf(n.split(' ')[0]) : -1;
        if (at >= 0) { hits.push({ p, at, len: n.length }); break; }
      }
    }
    // "Model O-" / "Model O minus" vs "Model O"
    if (/model\s*o\s*(-|minus)/i.test(text)) {
      const i = hits.findIndex(h => h.p.id === 'modelo');
      if (i >= 0) hits.splice(i, 1);
      if (!hits.some(h => h.p.id === 'modelominus')) hits.push({ p: G.PROD.modelominus, at: norm(text).indexOf('model o'), len: 8 });
    }
    // Drop a short match that sits inside a longer one ("Cobra" inside "M711 Cobra").
    const kept = hits.filter(h => !hits.some(o => o !== h && o.len > h.len && Math.abs(o.at - h.at) <= o.len && norm(`${o.p.brand} ${o.p.name}`).includes(norm(h.p.name))));
    return kept.sort((x, y) => x.at - y.at || y.len - x.len).map(h => h.p).filter((p, i, a) => a.indexOf(p) === i);
  }

  function findGames(text) {
    const t = ' ' + norm(text) + ' ';
    const out = [];
    for (const [alias, id] of Object.entries(G.ALIASES)) if (alias.length > 2 && t.includes(' ' + alias + ' ') && !out.includes(id)) out.push(id);
    for (const g of GAMES) {
      const n = norm(g.name);
      if ((t.includes(' ' + n + ' ') || (n.split(' ')[0].length > 4 && t.includes(' ' + n.split(' ')[0] + ' '))) && !out.includes(g.id)) out.push(g.id);
    }
    return out;
  }

  const CAT_WORDS = [
    ['mousepad', /mouse ?pads?|mouse ?mats?|desk ?mats?/], ['mouse', /\bmice\b|\bmouse\b|\bmouses\b/], ['keyboard', /keyboards?/],
    ['headset', /headsets?|headphones?|earphones?/], ['monitor', /monitors?|screens?|displays?/], ['controller', /controllers?|gamepads?|\bpads?\b|wheels?/],
  ];
  const findCat = text => { const t = text.toLowerCase(); for (const [id, re] of CAT_WORDS) if (re.test(t)) return id; return null; };

  // Budget in the visitor's words ("under ₹3000", "below 50", "$40", "3k") converted to US dollars.
  function findBudget(text) {
    const m = text.match(/(?:under|below|less than|max(?:imum)?|budget(?: of| is)?|up ?to|within|for|<)\s*(₹|rs\.?|inr|\$|usd|€|eur|£|gbp|¥|jpy)?\s*([\d][\d,]*(?:\.\d+)?)\s*(k)?\s*(₹|rs|inr|\$|usd|dollars?|rupees?|€|euros?|£|pounds?)?/i)
      || text.match(/(₹|rs\.?|\$|€|£|¥)\s*([\d][\d,]*(?:\.\d+)?)\s*(k)?/i);
    if (!m) return null;
    const sym = ((m.length > 4 ? (m[1] || m[4]) : m[1]) || '').toLowerCase();
    let v = parseFloat(m[2].replace(/,/g, '')) * (m[3] ? 1000 : 1);
    if (!v) return null;
    let cur = G.state.currency;
    if (/₹|rs|inr|rupee/.test(sym)) cur = 'INR';
    else if (/€|eur/.test(sym)) cur = 'EUR';
    else if (/£|gbp|pound/.test(sym)) cur = 'GBP';
    else if (/¥|jpy/.test(sym)) cur = 'JPY';
    else if (/\$|usd|dollar/.test(sym) && !['CAD', 'AUD', 'NZD', 'SGD', 'HKD'].includes(cur)) cur = 'USD';
    const rate = G.fx.rates[cur];
    if (!rate) cur = 'USD';
    return { usd: v / (rate || 1), label: new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(v) };
  }

  const pickHtml = (r, line) => `<a class="pick" href="#/p/${r.p.id}" data-product="${r.p.id}"><span class="thumb cat-${r.p.cat}">${G.art(r.p)}</span><span><b>${esc(r.p.brand)} ${esc(r.p.name)} · ${G.money(r.p.price)}</b><small>${r.match}% match${line ? ' · ' + esc(line) : ''}</small></span></a>`;

  // Score with temporary overrides (games, hands, connection) without touching the saved profile.
  function withState(over, fn) {
    const s = G.state, saved = {};
    for (const k in over) { saved[k] = s[k]; s[k] = over[k]; }
    try { return fn(); } finally { Object.assign(s, saved); }
  }

  const GLOSS_WORDS = {
    match: ['match %', 'match percent', 'match score'], dpi: ['dpi', 'cpi', 'sensitivity'], polling: ['polling'], weight: ['grams', 'how heavy', 'weight'],
    grip: ['grip', 'claw', 'palm', 'fingertip'], shape: ['ergonomic', 'symmetric', 'ambidextrous'], wireless: ['wireless', 'wired', 'bluetooth', 'dongle'],
    switches: ['switch', 'linear', 'tactile', 'clicky', 'mechanical'], rapid: ['rapid trigger', 'magnetic', 'hall effect keyboard'], layout: ['tkl', 'tenkeyless', '60%', '75%', 'full size', 'full-size', 'numpad', 'number pad'],
    openback: ['open back', 'open-back', 'closed back', 'closed-back'], refresh: ['refresh', 'hz'], resolution: ['1080p', '1440p', '4k', 'resolution'],
    panel: ['ips', ' va ', ' tn ', 'oled', 'panel'], hdmi21: ['hdmi'], hall: ['drift', 'hall effect', 'tmr'], paddles: ['paddle', 'back button'], pad: ['control pad', 'speed pad', 'cloth pad', 'hybrid pad'],
  };
  function findTerms(text) {
    const t = ' ' + text.toLowerCase() + ' ';
    return G.GLOSSARY.filter(g => (GLOSS_WORDS[g.id] || []).some(w => t.includes(w)));
  }

  function answer(text) {
    const t = text.toLowerCase();
    const s = G.state;
    const products = findProducts(text);
    const games = findGames(text);
    const cat = findCat(text) || (products[0] && products[0].cat);
    const budget = findBudget(text);
    const asksMeaning = /\b(what|what's|whats|meaning|mean|means|explain|difference|is it worth|do i need|should i care)\b/.test(t);

    if (/^(hi|hey|hello|yo|sup|hii+)\b/.test(t) && t.length < 20) return '<p>Hi! Ask me about any gear, a game you play, or a word you don\'t understand.</p>';
    if (/^(thanks|thank you|thx|ty|cheers)/.test(t)) return '<p>You\'re welcome! Ask me anything else about your setup.</p>';

    // Jargon: "what does DPI mean?", "open-back or closed-back?"
    const terms = findTerms(text);
    const shopping = findCat(text) || games.length || budget;
    if (terms.length && !products.length && (asksMeaning || (!shopping && (/ or |\?$/.test(t) || t.split(' ').length <= 4)))) {
      return terms.slice(0, 2).map(g => `<p><b>${esc(g.term)}</b>: ${esc(g.text)}</p>`).join('')
        + '<p>More words like this are in the <a href="#glossary" data-nav-glossary>Jargon buster</a>.</p>';
    }

    // Why GearGuide instead of a general AI chatbot
    if (/\b(chatgpt|gemini|copilot|other ai|another ai|free ai|ai chatbot|chat ?bot|why (should i )?use (gearguide|this)|why gearguide|better than)\b/.test(t) && !products.length) {
      return `<p>General AI chatbots are handy, but for buying gear they have some blind spots that GearGuide is built to avoid:</p>
        <ul><li><b>Where answers come from:</b> a chatbot repeats what it read online, and much of that is sponsored reviews, affiliate "best of" lists and popularity leaderboards. GearGuide's picks come from a fixed catalogue rated by a gamer from hands-on experience.</li>
        <li><b>No sponsors:</b> popularity and brand never change a score here.</li>
        <li><b>Real prices:</b> every price comes from a named shop's page with a link and the date it was checked, and Best Buy (US) and Flipkart (India) prices update live. Chatbots often give old or made-up prices.</li>
        <li><b>Fits you:</b> it always uses your games, hand size, grip and budget, and explains every match.</li>
        <li><b>Consistent:</b> the same answers give the same picks every time.</li></ul>
        <p>A chatbot knows about more products than our ${G.PROD ? Object.keys(G.PROD).length : 72}, so use both: GearGuide to find what fits you, and always check the shop before you buy.</p>`;
    }

    // Getting started
    if (/\b(new|beginner|first|start|starting|getting into|where do i|what should i buy|what do i need)\b/.test(t) && !products.length && !games.length) {
      return `<p>Welcome! Here's a simple order to buy things in, if you play on PC:</p>
        <ol><li><b>Mouse</b> and a <b>mouse pad</b>: the biggest difference for the money. A mouse that fits your hand matters more than fancy specs.</li>
        <li><b>Headset</b>: lets you hear where enemies are and talk to friends.</li>
        <li><b>Monitor</b>: a 144 to 180 Hz screen feels much smoother than a basic 60 Hz one, if your PC can keep up.</li>
        <li><b>Keyboard</b>: any decent one works to start; upgrade later.</li></ol>
        <p>On a console, start with a comfortable <b>controller</b> and a <b>headset</b>.</p>
        <p>${G.onboarded() ? 'Your dashboard already has picks for you. Ask me "why is my top mouse a good fit?"' : 'Press <b>Get started</b> and tell me the games you play; I\'ll take it from there.'}</p>`;
    }

    // Compare two products
    if (products.length >= 2 && (/\bvs\.?\b|versus|compare|or |better|difference/.test(t))) {
      const [a, b] = products;
      if (a.cat !== b.cat) return `<p>Those are different kinds of gear (a ${G.CAT[a.cat].one} and a ${G.CAT[b.cat].one}), so they don't compete. Want a comparison within one type?</p>`;
      const needs = G.computeNeeds();
      const ra = G.evaluate(a, needs), rb = G.evaluate(b, needs);
      const rows = [['Price', G.money(a.price), G.money(b.price)], ['Match for you', ra.match + '%', rb.match + '%'], ['Specs', G.specLine(a), G.specLine(b)], ['Best thing', a.pros[0], b.pros[0]], ['Watch out for', a.cons[0], b.cons[0]]];
      const win = ra.match === rb.match ? null : ra.match > rb.match ? [ra, rb] : [rb, ra];
      return `<table><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table>`
        + (win ? `<p>For what you told me, the <b>${esc(win[0].p.name)}</b> fits a bit better: ${esc((win[0].why[0] || win[0].p.pros[0]).replace(/\.$/, ''))}. The ${esc(win[1].p.name)} is still a fine choice if ${esc(win[1].p.pros[0].toLowerCase())} matters more to you.</p>` : '<p>They score the same for you, so pick on price or looks.</p>')
        + pickHtml(ra) + pickHtml(rb);
    }

    // One product: cheaper option, fit for a game, or a summary
    if (products.length === 1) {
      const p = products[0], needs = G.computeNeeds(), r = G.evaluate(p, needs);
      if (/cheap|alternative|instead|similar|less|budget/.test(t)) {
        const { pool } = G.rankCategory(G.CAT[p.cat], needs);
        const cheaper = pool.filter(x => x.p.price < p.price * .8).sort((x, y) => y.match - x.match).slice(0, 3);
        return cheaper.length ? `<p>Cheaper ${esc(G.CAT[p.cat].name.toLowerCase())} than the ${esc(p.name)} (${G.money(p.price)}) that still fit you:</p>` + cheaper.map(x => pickHtml(x, x.p.pros[0])).join('') : `<p>The ${esc(p.name)} is already one of the cheapest ${esc(G.CAT[p.cat].name.toLowerCase())} I know that fits you.</p>`;
      }
      if (games.length) {
        const g = G.GAME[games[0]], fit = G.fitForGame(p, g);
        if (fit == null) return `<p>${esc(g.name)} doesn't really depend on a ${esc(G.CAT[p.cat].one)}, so the ${esc(p.name)} will work fine but won't make a big difference there.</p>` + pickHtml(r);
        const word = fit >= .85 ? 'a great fit' : fit >= .7 ? 'a good fit' : fit >= .55 ? 'an okay fit' : 'not the best fit';
        return `<p>The <b>${esc(p.brand)} ${esc(p.name)}</b> is ${word} for ${esc(g.name)} (${Math.round(fit * 100)}% for what that game needs).</p><ul><li>${esc(p.pros[0])}</li><li>Watch out: ${esc(p.cons[0])}</li></ul>` + pickHtml(r);
      }
      return `<p><b>${esc(p.brand)} ${esc(p.name)}</b>, about ${G.money(p.price)}. ${esc(G.specLine(p))}.</p>
        <ul>${p.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p>Watch out for: ${esc(p.cons.join('; ').toLowerCase())}.</p>
        <p>For you it's a <b>${r.match}% match</b>${r.why[0] ? ': ' + esc(r.why[0].replace(/\.$/, '')) : ''}.</p>` + pickHtml(r);
    }

    // Explain my top pick
    if (/\b(my|the) (top|best|first)\b|why (is|this)|top pick/.test(t) && G.onboarded()) {
      const c = G.CAT[cat || s.view];
      const { pool } = G.rankCategory(c, G.computeNeeds());
      const top = pool.filter(x => x.within)[0] || pool[0];
      if (!top) return `<p>I don't have a ${esc(c.one)} pick for you yet.</p>`;
      return `<p>Your top ${esc(c.one)} is the <b>${esc(top.p.brand)} ${esc(top.p.name)}</b> (${top.match}% match). Here's why:</p><ul>${top.why.map(x => `<li>${esc(x)}</li>`).join('')}${top.warn.slice(0, 2).map(x => `<li>Heads up: ${esc(x)}</li>`).join('')}</ul>` + pickHtml(top);
    }

    // Recommend: "best mouse for Valorant under ₹3000", "wireless headset", "keyboard for WoW"
    if (cat || games.length || budget) {
      const c = G.CAT[cat || (G.onboarded() ? s.view : 'mouse')];
      const over = {};
      if (games.length) over.games = games;
      if (/\bwireless\b/.test(t)) over.conn = 'wireless'; else if (/\bwired\b/.test(t)) over.conn = 'wired';
      if (/left[- ]?hand|lefty|left handed/.test(t)) over.handed = 'left';
      if (/small hands?/.test(t)) over.hand = 'S'; else if (/(big|large) hands?/.test(t)) over.hand = 'L';
      const ranked = withState(over, () => G.rankCategory(c, G.computeNeeds()).pool);
      let list = ranked.filter(r => !budget || r.p.price <= budget.usd);
      if (/light(weight)?\b/.test(t) && c.id === 'mouse') list = list.filter(r => r.p.weight != null && r.p.weight <= 65);
      if (/quiet/.test(t) && c.id === 'keyboard') list = list.filter(r => r.p.noise >= .75);
      if (over.conn === 'wireless') list = list.filter(r => r.p.wireless);
      const top = list.slice(0, 3);
      const forWhat = [games.length ? 'for ' + G.list(games.map(id => G.GAME[id].name), 2) : '', budget ? 'under ' + budget.label : ''].filter(Boolean).join(' ');
      if (!top.length) {
        const cheapest = ranked.slice().sort((a, b) => a.p.price - b.p.price)[0];
        return `<p>I couldn't find a ${esc(c.one)} ${esc(forWhat)} that matches everything you asked.</p>` + (cheapest ? `<p>The cheapest one that fits is:</p>` + pickHtml(cheapest, cheapest.p.pros[0]) : '');
      }
      return `<p>Good ${esc(c.name.toLowerCase())} ${esc(forWhat)}${forWhat ? '' : 'for you'}:</p>` + top.map(r => pickHtml(r, (r.why[0] || r.p.pros[0]).replace(/\.$/, ''))).join('')
        + `<p>Tap one to see why it fits. ${games.length ? '' : 'Tell me the game you play for sharper picks.'}</p>`;
    }

    return `<p>I'm not sure I understood that. Here's what I can do:</p>
      <ul><li>Explain a word: "What does polling rate mean?"</li><li>Suggest gear: "Best headset for Fortnite under ${G.roundMoney(60, false)}"</li>
      <li>Compare: "G502 Hero vs Basilisk V3"</li><li>Check a product: "Is the Viper V3 Pro good for small hands?"</li></ul>`
      + (hasKey() ? '' : '<p>For open-ended questions, you can connect Claude in ⚙ settings with your own Anthropic API key.</p>');
  }

  log.addEventListener('click', e => {
    if (!e.target.closest('[data-nav-glossary]')) return;
    e.preventDefault();
    if (G.onboarded()) { document.querySelector('[data-nav="glossary"]').click(); if (matchMedia('(max-width: 640px)').matches) closeChat(); }
    else bot(G.GLOSSARY.map(g => `<p><b>${esc(g.term)}</b>: ${esc(g.text)}</p>`).join(''), 'Jargon buster');
  });

  /* ---------------- Claude ---------------- */
  let sdkLoading = null;
  function loadSdk() {
    if (window.AnthropicSDK) return Promise.resolve(window.AnthropicSDK);
    if (!sdkLoading) sdkLoading = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'vendor/anthropic-sdk.js';
      sc.onload = () => (window.AnthropicSDK ? resolve(window.AnthropicSDK) : reject(new Error('SDK did not load')));
      sc.onerror = () => { sdkLoading = null; reject(new Error('Could not load vendor/anthropic-sdk.js')); };
      document.head.appendChild(sc);
    });
    return sdkLoading;
  }

  // Stable system prompt (catalogue + glossary), cached between requests. Per-visitor details go in each user turn.
  let systemPrompt = null;
  function buildSystem() {
    if (systemPrompt) return systemPrompt;
    const catalogue = PRODUCTS.map(p => ({
      id: p.id, type: p.cat, brand: p.brand, name: p.name, lowest_price_usd: p.price, list_price_usd: p.msrp || undefined,
      shop_prices: (p.offers || []).map(o => `${o.store}: ${o.price} ${o.cur}${o.live ? ' (live)' : ''}${o.note ? ` (${o.note})` : ''}`),
      specs: G.specLine(p), strengths: p.pros, weaknesses: p.cons,
      ratings: Object.fromEntries(Object.entries(p.traits).map(([k, v]) => [DIMS[k], Math.round(v * 100)])),
      lesser_known: p.pop <= 2 || undefined,
    }));
    const games = GAMES.map(g => ({ name: g.name, genre: g.genre, needs: Object.entries(g.needs).filter(([, v]) => v >= .5).map(([k]) => DIMS[k]) }));
    systemPrompt = `You are GearGuide's assistant, inside a website that helps people who are new to gaming choose gaming hardware: mice, keyboards, headsets, monitors, controllers and racing wheels, and mouse pads.

How to answer:
- The person is probably a beginner. Use plain, friendly language. When you use a technical word (DPI, polling rate, Rapid Trigger, refresh rate, IPS, open-back, Hall-effect sticks and so on), explain it in a few simple words the first time.
- Keep answers short: usually 2 to 6 sentences, or a short bulleted list. Use **bold** for product names and simple "- " bullet lists. No headings, no tables unless comparing products.
- Recommend only products from the catalogue below. When you mention one, write its id in double square brackets right after its name, like **Razer Viper V3 Pro** [[viperv3]], so the site can link it.
- Never say one product is the best for everyone. Explain trade-offs and why something suits this person.
- lowest_price_usd is the lowest new price found across real shops (each shop's price is in shop_prices; they were read from the shops' own pages in late November 2026, and ones marked live, from Best Buy or Flipkart, are refreshed daily). Prices in INR are from Indian shops; when the person uses INR, quote Indian shop prices first. Name the shop when you give a price. Convert to the person's currency using the rate in their message, round sensibly, and say prices change and to check a shop before buying.
- Ratings (0 to 100) are GearGuide's own judgement from spec sheets and reviews, not lab tests.
- If something isn't in the catalogue, you can talk about it in general terms but say GearGuide hasn't reviewed it.
- If asked about something unrelated to gaming gear, games or setting up to play, answer briefly if it is harmless and steer back to gear.

Games GearGuide knows, with what each one asks of your gear:
${JSON.stringify(games)}

Jargon buster (the site's own plain-English definitions):
${JSON.stringify(G.GLOSSARY.map(g => ({ term: g.term, meaning: g.text })))}

Catalogue:
${JSON.stringify(catalogue)}`;
    return systemPrompt;
  }

  function profileNote() {
    const s = G.state;
    const cur = G.fx.rates[s.currency] ? s.currency : 'USD';
    const parts = [
      `currency ${cur} (1 USD = ${G.fx.rates[cur]} ${cur})`,
      `games: ${s.games.length ? s.games.map(id => G.GAME[id].name).join(', ') : 'none chosen yet'}`,
      `platforms: ${s.platforms.map(x => G.PLATFORMS[x]).join(', ') || 'not set'}`,
      `hand: ${G.HAND_WORD[s.hand]}${s.handCm ? ` (${s.handCm} cm)` : ''}, ${s.handed}-handed, grip ${s.grip}`,
      `desk ${s.desk}, connection preference ${s.conn}`,
    ];
    if (G.onboarded()) {
      const cat = G.CAT[s.view];
      const top = G.rankCategory(cat, G.computeNeeds()).pool.filter(r => r.within).slice(0, 3);
      parts.push(`budget for ${cat.name.toLowerCase()}: ${G.bracketLabel(cat.id, s.budget[cat.id])}`);
      if (top.length) parts.push(`their current top ${cat.name.toLowerCase()} on the site: ${top.map(r => `${r.p.brand} ${r.p.name} [[${r.p.id}]] ${r.match}%`).join('; ')}`);
    }
    return `[About me, from my GearGuide settings: ${parts.join('; ')}]`;
  }

  // Minimal, safe markdown: escape first, then bold, inline code, bullet/numbered lists, paragraphs, [[id]] links.
  function md(src) {
    const lines = esc(src).split('\n');
    let html = '', listType = null, para = [];
    const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\s*\[\[([\w-]+)\]\]/g, (m, id) => G.PROD[id] ? ` <a href="#/p/${id}" data-product="${id}">(view)</a>` : '');
    const flushP = () => { if (para.length) { html += `<p>${inline(para.join(' '))}</p>`; para = []; } };
    const flushL = () => { if (listType) { html += `</${listType}>`; listType = null; } };
    for (const raw of lines) {
      const l = raw.trim();
      const bullet = l.match(/^[-*•]\s+(.*)/), num = l.match(/^\d+[.)]\s+(.*)/);
      if (bullet || num) {
        flushP();
        const want = bullet ? 'ul' : 'ol';
        if (listType !== want) { flushL(); html += `<${want}>`; listType = want; }
        html += `<li>${inline((bullet || num)[1])}</li>`;
      } else if (!l) { flushP(); flushL(); }
      else { flushL(); para.push(l); }
    }
    flushP(); flushL();
    return html;
  }

  async function askClaude(text) {
    const el = addMsg('bot', '<span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>');
    const userTurn = { role: 'user', content: `${profileNote()}\n\n${text}` };
    claudeHistory.push(userTurn);
    let Anthropic;
    try {
      Anthropic = await loadSdk();
      const client = new Anthropic({ apiKey: store.get(KEY_STORE), dangerouslyAllowBrowser: true });
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',            // if Claude declines, the API retries on a fallback model in the same call
        cache_control: { type: 'ephemeral' },
        output_config: { effort: 'low' }, // quick, chatty answers
        system: buildSystem(),
        messages: claudeHistory,
      });
      let acc = '', queued = false;
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          acc += ev.delta.text;
          if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; el.innerHTML = md(acc); log.scrollTop = log.scrollHeight; }); }
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === 'refusal') {
        claudeHistory.pop();
        el.innerHTML = '<p>Sorry, I can\'t help with that one. Ask me about gaming gear instead!</p><span class="src">Claude</span>';
        return;
      }
      claudeHistory.push({ role: 'assistant', content: final.content }); // full content, unchanged
      const finalText = final.content.filter(b => b.type === 'text').map(b => b.text).join('\n\n');
      el.innerHTML = md(finalText || acc) + `<span class="src">Claude · ${esc(final.model || MODEL)}</span>`;
      log.scrollTop = log.scrollHeight;
    } catch (err) {
      claudeHistory.pop(); // keep the history valid for the next try
      el.classList.add('err');
      const A = Anthropic || window.AnthropicSDK;
      let msg;
      if (A && err instanceof A.AuthenticationError) msg = 'Anthropic rejected the API key. Check it in ⚙ settings.';
      else if (A && err instanceof A.PermissionDeniedError) msg = "This API key doesn't have access to Claude Opus 5.5.";
      else if (A && err instanceof A.RateLimitError) msg = 'Claude is busy or your key hit its rate limit. Try again in a minute.';
      else if (A && err instanceof A.BadRequestError) msg = 'Claude couldn\'t process that request: ' + esc(err.message);
      else if (A && err instanceof A.APIConnectionError) msg = "Couldn't reach Anthropic. Are you offline?";
      else if (A && err instanceof A.APIError) msg = `Claude returned an error (${err.status || 'unknown'}).`;
      else msg = 'Claude isn\'t available right now (' + esc(err.message || 'unknown error') + ').';
      el.innerHTML = `<p>${msg} Here's the built-in answer instead:</p>` + answer(text) + '<span class="src">Built-in assistant · GearGuide data</span>';
      log.scrollTop = log.scrollHeight;
    }
  }

  renderMode();
})();
