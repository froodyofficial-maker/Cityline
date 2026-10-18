/* GearGuide product art: SVG illustrations drawn from each product's real form factor
   (shape, layout, size, open/closed back, stick layout) in its brand colors.
   A product with a photo (an `img` field, or an entry in images.js) shows the photo instead,
   falling back to the art if it fails to load. */
window.LOADOUT_ART = (() => {
  // [body, accent] per brand
  const BRAND = {
    Logitech: ['#1d1f27', '#00b8fc'], Razer: ['#17191e', '#44d62c'], Pulsar: ['#e9e9ef', '#ff3d6e'],
    Zowie: ['#15161b', '#e3263a'], 'BenQ Zowie': ['#15161b', '#e3263a'], Wooting: ['#17171d', '#ff8a00'],
    SteelSeries: ['#16181d', '#ff5a1f'], Keychron: ['#2b2e37', '#ff6b2c'], Corsair: ['#131418', '#ffd400'],
    Redragon: ['#141418', '#ff1f3d'], 'Royal Kludge': ['#ececf2', '#7d6bff'], DrunkDeer: ['#1e1f26', '#3ee6c4'],
    HyperX: ['#141418', '#e31837'], Audeze: ['#1b1b20', '#d4a94f'], Drop: ['#24252c', '#ffcb2f'],
    'Turtle Beach': ['#141519', '#ff6a13'], Alienware: ['#e7e9ef', '#22e5ff'], LG: ['#17181d', '#ff2a55'],
    AOC: ['#17181d', '#ff2a2a'], Samsung: ['#e4e6ed', '#2f7bff'], MSI: ['#131418', '#ff2020'],
    Sony: ['#f2f3f7', '#3b74ff'], Microsoft: ['#1d1e24', '#2fd04a'], '8BitDo': ['#e8e8ee', '#ff4d4d'],
    GameSir: ['#17181d', '#7cff4f'], Nintendo: ['#1c1d22', '#e60012'],
  };
  let uid = 0;
  const light = hex => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16) > 500;

  function mouse(p, b, a, id) {
    const ergo = p.handed === 'right';
    const body = ergo
      ? 'M116 16 C148 14 164 46 161 84 C158 118 141 136 118 136 C95 136 81 117 83 84 C85 54 88 18 116 16 Z'
      : 'M120 16 C150 16 158 50 156 82 C154 117 140 136 120 136 C100 136 86 117 84 82 C82 50 90 16 120 16 Z';
    const side = (x) => `<rect x="${x}" y="56" width="5" height="11" rx="2" fill="${a}" opacity=".8"/><rect x="${x}" y="70" width="5" height="11" rx="2" fill="${a}" opacity=".8"/>`;
    const grid = p.traits.binds >= .9
      ? Array.from({ length: 12 }, (_, i) => `<circle cx="${50 + (i % 3) * 9}" cy="${56 + Math.floor(i / 3) * 9}" r="3.4" fill="${a}" opacity=".85"/>`).join('') +
        `<rect x="42" y="48" width="34" height="42" rx="9" fill="none" stroke="${a}" stroke-opacity=".4"/>`
      : '';
    const cable = p.wireless ? '' : `<path d="M120 16 C120 4 142 2 160 -6" stroke="${light(b) ? '#cfd2da' : '#2c2f38'}" stroke-width="3" fill="none"/>`;
    return `${cable}
      <path d="${body}" fill="url(#g${id})" stroke="${a}" stroke-opacity=".35" stroke-width="1.2"/>
      <path d="M${ergo ? 118 : 120} 18 L${ergo ? 118 : 120} 64 M86 66 C104 60 136 60 ${ergo ? 158 : 154} 66" stroke="${light(b) ? '#0003' : '#fff2'}" stroke-width="1.4" fill="none"/>
      <rect x="${ergo ? 114 : 116}" y="28" width="8" height="20" rx="4" fill="${a}" filter="url(#glow${id})"/>
      ${p.handed === 'ambi' ? side(81) + side(154) : side(82)}
      ${grid}
      <circle cx="${ergo ? 120 : 120}" cy="112" r="6" fill="${a}" opacity=".9" filter="url(#glow${id})"/>`;
  }

  function keyboard(p, b, a, id) {
    const spec = { full: [212, 22, 6], tkl: [178, 18, 6], 75: [154, 16, 6], 65: [140, 16, 5], 60: [132, 15, 5] }[p.layout];
    const [w, cols, rows] = spec;
    const low = p.name.includes('G915');
    const h = rows * 13 + 12, x0 = 120 - w / 2, y0 = 66 - h / 2 - (p.wristRest ? 8 : 0);
    const kw = (w - 12) / cols;
    let keys = '';
    for (let r = 0; r < rows; r++) {
      const y = y0 + 6 + r * 13;
      if (r === rows - 1) {
        const sx = x0 + 6 + kw * Math.floor(cols * .28), sw = kw * Math.ceil(cols * .42);
        for (let c = 0; c < cols; c++) {
          const kx = x0 + 6 + c * kw;
          if (kx >= sx && kx < sx + sw) continue;
          keys += `<rect x="${kx + .8}" y="${y}" width="${kw - 1.6}" height="${low ? 9 : 11}" rx="2" fill="${light(b) ? '#fff' : '#2a2d36'}"/>`;
        }
        keys += `<rect x="${sx + .8}" y="${y}" width="${sw - 1.6}" height="${low ? 9 : 11}" rx="2" fill="${light(b) ? '#fff' : '#2a2d36'}"/>`;
      } else {
        for (let c = 0; c < cols; c++) {
          const wRow = rows === 6 ? 2 : 1; // the QWERTY row, so the accent keys spell out Esc + WASD
          const accent = (r === 0 && c === 0) || (r === wRow && c === 2) || (r === wRow + 1 && c >= 1 && c <= 3);
          keys += `<rect x="${x0 + 6 + c * kw + .8}" y="${y}" width="${kw - 1.6}" height="${low ? 9 : 11}" rx="2" fill="${accent ? a : light(b) ? '#fff' : '#2a2d36'}" ${accent ? `opacity=".9"` : ''}/>`;
        }
      }
    }
    const macro = p.traits.binds >= .9 ? `<rect x="${x0 - 12}" y="${y0 + 18}" width="9" height="${h - 24}" rx="3" fill="${a}" opacity=".7"/>` : '';
    const rest = p.wristRest ? `<rect x="${x0 + 8}" y="${y0 + h + 6}" width="${w - 16}" height="14" rx="7" fill="${b}" stroke="${a}" stroke-opacity=".25"/>` : '';
    return `<rect x="${x0 - 4}" y="${y0 + h - 8}" width="${w + 8}" height="14" rx="8" fill="${a}" opacity=".55" filter="url(#blur${id})"/>
      <rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="8" fill="url(#g${id})" stroke="${a}" stroke-opacity=".35"/>
      ${keys}${macro}${rest}`;
  }

  function headset(p, b, a, id) {
    const open = p.back === 'open';
    const grill = cx => open ? Array.from({ length: 5 }, (_, i) => `<line x1="${cx - 12 + i * 6}" y1="70" x2="${cx - 12 + i * 6}" y2="102" stroke="${a}" stroke-opacity=".7" stroke-width="2"/>`).join('') : `<circle cx="${cx}" cy="86" r="9" fill="none" stroke="${a}" stroke-width="2.5" filter="url(#glow${id})"/>`;
    const cable = p.wireless ? '' : `<path d="M74 116 C70 138 100 140 112 152" stroke="${light(b) ? '#cfd2da' : '#2c2f38'}" stroke-width="3" fill="none"/>`;
    return `${cable}
      <path d="M72 82 C68 18 172 18 168 82" stroke="${b}" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M78 70 C80 30 160 30 162 70" stroke="${a}" stroke-opacity=".5" stroke-width="2" fill="none"/>
      <ellipse cx="72" cy="86" rx="22" ry="31" fill="url(#g${id})" stroke="${a}" stroke-opacity=".4"/>
      <ellipse cx="168" cy="86" rx="22" ry="31" fill="url(#g${id})" stroke="${a}" stroke-opacity=".4"/>
      ${grill(72)}${grill(168)}
      <path d="M58 104 C44 124 58 138 86 134" stroke="${b}" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="88" cy="134" r="5" fill="${a}" filter="url(#glow${id})"/>`;
  }

  function monitor(p, b, a, id) {
    const aspect = p.size >= 45 ? 3.56 : p.size >= 34 ? 2.37 : 1.78;
    const w = { 24: 128, 24.5: 128, 27: 142, 28: 146, 32: 156, 34: 200, 49: 226 }[p.size] || 140;
    const h = Math.max(w / aspect, 54), x = 120 - w / 2, y = 64 - h / 2 - 8;
    const curve = aspect > 2 ? 7 : 0;
    const frame = `M${x} ${y} Q120 ${y + curve} ${x + w} ${y} L${x + w} ${y + h} Q120 ${y + h + curve} ${x} ${y + h} Z`;
    const ix = x + 4, iy = y + 4, iw = w - 8, ih = h - 8;
    const horizon = iy + ih * .62;
    let grid = '';
    for (let i = 1; i <= 4; i++) grid += `<line x1="${ix}" y1="${horizon + i * i * ih * .022}" x2="${ix + iw}" y2="${horizon + i * i * ih * .022}" stroke="${a}" stroke-opacity=".45"/>`;
    for (let i = -4; i <= 4; i++) grid += `<line x1="${120 + i * iw * .06}" y1="${horizon}" x2="${120 + i * iw * .2}" y2="${iy + ih}" stroke="${a}" stroke-opacity=".35"/>`;
    return `<defs><clipPath id="c${id}"><path d="M${ix} ${iy} Q120 ${iy + curve} ${ix + iw} ${iy} L${ix + iw} ${iy + ih} Q120 ${iy + ih + curve} ${ix} ${iy + ih} Z"/></clipPath>
      <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14062e"/><stop offset=".62" stop-color="${a}" stop-opacity=".55"/><stop offset=".62" stop-color="#07040f"/></linearGradient></defs>
      <rect x="${x + 6}" y="${y + h - 4}" width="${w - 12}" height="10" rx="5" fill="${a}" opacity=".5" filter="url(#blur${id})"/>
      <path d="${frame}" fill="${b}" stroke="${a}" stroke-opacity=".35"/>
      <g clip-path="url(#c${id})"><rect x="${ix}" y="${iy}" width="${iw}" height="${ih + curve}" fill="url(#sky${id})"/>
        <circle cx="120" cy="${horizon}" r="${ih * .26}" fill="#ffb347" opacity=".9"/>
        <path d="M${ix} ${horizon} L${ix + iw * .2} ${horizon - ih * .2} L${ix + iw * .34} ${horizon - ih * .07} L${ix + iw * .5} ${horizon - ih * .28} L${ix + iw * .7} ${horizon - ih * .1} L${ix + iw * .84} ${horizon - ih * .22} L${ix + iw} ${horizon} Z" fill="#0b0618" opacity=".85"/>
        <rect x="${ix}" y="${horizon}" width="${iw}" height="${ih}" fill="#07040f"/>${grid}</g>
      <rect x="114" y="${y + h}" width="12" height="${118 - y - h}" fill="${b}"/>
      <rect x="${120 - Math.min(w * .3, 44)}" y="116" width="${Math.min(w * .6, 88)}" height="7" rx="3.5" fill="${b}" stroke="${a}" stroke-opacity=".3"/>`;
  }

  function controller(p, b, a, id) {
    if (p.wheel) {
      return `<circle cx="104" cy="70" r="50" fill="none" stroke="${b}" stroke-width="13"/>
        <circle cx="104" cy="70" r="50" fill="none" stroke="${a}" stroke-opacity=".5" stroke-width="2"/>
        <path d="M58 76 L92 78 L104 100 L116 78 L150 76" stroke="${b}" stroke-width="12" fill="none" stroke-linejoin="round"/>
        <circle cx="104" cy="76" r="15" fill="url(#g${id})" stroke="${a}" stroke-opacity=".5"/>
        <circle cx="104" cy="76" r="5" fill="${a}" filter="url(#glow${id})"/>
        <rect x="104" y="18" width="3" height="10" fill="${a}"/>
        <rect x="170" y="88" width="16" height="36" rx="4" fill="${b}" stroke="${a}" stroke-opacity=".4" transform="rotate(-8 178 106)"/>
        <rect x="192" y="88" width="16" height="36" rx="4" fill="${b}" stroke="${a}" stroke-opacity=".4" transform="rotate(-8 200 106)"/>`;
    }
    const sony = p.brand === 'Sony';
    const body = 'M74 42 C92 34 148 34 166 42 C194 52 206 112 192 126 C180 136 166 124 156 106 L84 106 C74 124 60 136 48 126 C34 112 46 52 74 42 Z';
    const ls = sony ? [98, 86] : [82, 64], rs = sony ? [142, 86] : [142, 86];
    const dpad = sony ? [76, 64] : [98, 86];
    const face = sony ? ['#5be0c8', '#ff6b8b', '#9a8cff', '#ff9ad5'] : ['#ffd54a', '#ff5a5a', '#4ab0ff', '#45e07a'];
    const stick = ([x, y]) => `<circle cx="${x}" cy="${y}" r="12" fill="#0d0e12" stroke="${a}" stroke-opacity=".6" stroke-width="${p.hall ? 2.2 : 1}"/><circle cx="${x}" cy="${y}" r="7" fill="${light(b) ? '#2a2d36' : '#3a3d48'}"/>`;
    const [dx, dy] = dpad;
    return `<path d="M60 44 C64 30 92 30 96 38 M144 38 C148 30 176 30 180 44" stroke="${b}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="${body}" fill="url(#g${id})" stroke="${a}" stroke-opacity=".4"/>
      ${sony ? `<rect x="100" y="46" width="40" height="22" rx="5" fill="${light(b) ? '#e0e2e8' : '#23252d'}" stroke="${a}" stroke-opacity=".5"/>` : `<circle cx="120" cy="54" r="7" fill="${a}" filter="url(#glow${id})"/>`}
      ${stick(ls)}${stick(rs)}
      <path d="M${dx - 4} ${dy - 12} h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 Z" fill="${light(b) ? '#2a2d36' : '#3a3d48'}"/>
      <circle cx="164" cy="54" r="5" fill="${face[0]}"/><circle cx="174" cy="64" r="5" fill="${face[1]}"/><circle cx="154" cy="64" r="5" fill="${face[2]}"/><circle cx="164" cy="74" r="5" fill="${face[3]}"/>
      ${p.paddles ? `<path d="M62 112 l8 8 M178 112 l-8 8" stroke="${a}" stroke-width="3.5" stroke-linecap="round" filter="url(#glow${id})"/>` : ''}`;
  }

  const DRAW = { mouse, keyboard, headset, monitor, controller };
  art.hasPhoto = p => !!(p.img || (window.LOADOUT_IMAGES || {})[p.id]);

  function art(p) {
    const id = ++uid;
    const [b, a] = p.colors || BRAND[p.brand] || ['#1d1f27', '#8f7bff'];
    const top = light(b) ? '#ffffff' : '#3a3e4b';
    const svg = `<svg viewBox="0 0 240 150" role="img" aria-label="Illustration of the ${p.brand} ${p.name}">
      <defs>
        <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${b}"/></linearGradient>
        <filter id="glow${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="blur${id}" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      ${DRAW[p.cat](p, b, a, id)}
    </svg>`;
    const src = p.img || (window.LOADOUT_IMAGES || {})[p.id];
    if (!src) return svg;
    return `<img class="photo" src="${src}" alt="${p.brand} ${p.name}" loading="lazy" onerror="this.parentNode.classList.remove('has-photo');this.replaceWith(document.createRange().createContextualFragment(this.nextElementSibling.innerHTML));"><template>${svg}</template>`;
  }

  return art;
})();
