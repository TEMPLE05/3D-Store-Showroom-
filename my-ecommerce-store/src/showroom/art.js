// Procedural product art for the demo catalog.
// Every function returns an SVG string; toDataUrl() turns it into an <img>/texture source.
// The garment outlines are exported as point lists so the 3D garments use the exact same silhouette.

export const toDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const shade = (hex, amt) => {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  r = f(r); g = f(g); b = f(b);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};
const isLight = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
};

const ptsToPath = (pts) => 'M' + pts.map((p) => p.join(',')).join(' L') + ' Z';

/* ---------- Garment outlines (viewBox 0 0 400 440, y down) ---------- */

export const OUTLINES = {
  tee: [
    [128, 34], [160, 50], [200, 58], [240, 50], [272, 34], [338, 62], [376, 132], [326, 160], [300, 130],
    [302, 410], [200, 420], [98, 410], [100, 130], [74, 160], [24, 132], [62, 62],
  ],
  hoodie: [
    [130, 40], [160, 52], [200, 58], [240, 52], [270, 40], [330, 62], [356, 120], [384, 370], [338, 384],
    [308, 170], [306, 404], [200, 414], [94, 404], [92, 170], [62, 384], [16, 370], [44, 120], [70, 62],
  ],
  trousers: [
    [92, 20], [308, 20], [316, 70], [344, 420], [236, 424], [204, 130], [196, 130], [164, 424], [56, 420], [84, 70],
  ],
};

const fabricDefs = (id, base) => `
  <defs>
    <linearGradient id="v${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity=".22"/>
      <stop offset=".22" stop-color="#000" stop-opacity="0"/>
      <stop offset=".5" stop-color="#fff" stop-opacity=".07"/>
      <stop offset=".78" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".25"/>
    </linearGradient>
    <linearGradient id="h${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
      <stop offset="1" stop-color="#000" stop-opacity=".18"/>
    </linearGradient>
    <pattern id="k${id}" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="${base}"/>
      <path d="M0 3h6" stroke="${shade(base, -0.06)}" stroke-width="1"/>
    </pattern>
  </defs>`;

const chestMark = (brand, color, x = 200, y = 150, size = 22) =>
  brand ? `<text x="${x}" y="${y}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${size}" letter-spacing="2" fill="${color}">${brand}</text>` : '';

let uid = 0;

export function teeSvg({ color = '#e9e4da', accent, brand = '', back = false, print = 'mark' } = {}) {
  const id = `t${uid++}`;
  const line = shade(color, -0.25);
  const ink = accent || (isLight(color) ? '#151515' : '#f4f1ea');
  const body = ptsToPath(OUTLINES.tee);
  const collar = back
    ? `<path d="M128 34 Q200 52 272 34" fill="none" stroke="${shade(color, -0.18)}" stroke-width="7"/>`
    : `<path d="M128 34 Q200 92 272 34" fill="none" stroke="${shade(color, -0.18)}" stroke-width="9"/>
       <path d="M140 38 Q200 80 260 38 Q200 66 140 38Z" fill="${shade(color, -0.35)}"/>`;
  let art = '';
  if (!back && print === 'mark') art = chestMark(brand, ink, 200, 160, 24);
  if (!back && print === 'stripe') art = `<rect x="100" y="200" width="202" height="26" fill="${ink}"/><rect x="100" y="234" width="202" height="8" fill="${ink}"/>`;
  if (!back && print === 'big') art = `<text x="200" y="250" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="64" fill="${ink}" letter-spacing="-2">${brand}</text>`;
  if (back && print !== 'stripe') art = `<text x="200" y="110" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="13" letter-spacing="5" fill="${ink}" opacity=".85">${brand}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440">${fabricDefs(id, color)}
    <path d="${body}" fill="url(#k${id})" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>
    ${art}
    <path d="M100 130 L100 410 M300 130 L302 410" stroke="${line}" stroke-width="1.5" stroke-dasharray="4 4" opacity=".5"/>
    <path d="M74 160 L100 130 M326 160 L300 130" stroke="${line}" stroke-width="2" opacity=".6"/>
    ${collar}
    <path d="${body}" fill="url(#v${id})"/><path d="${body}" fill="url(#h${id})"/>
  </svg>`;
}

export function hoodieSvg({ color = '#2b2b2e', accent, brand = '', back = false } = {}) {
  const id = `h${uid++}`;
  const line = shade(color, -0.3);
  const ink = accent || (isLight(color) ? '#151515' : '#f4f1ea');
  const body = ptsToPath(OUTLINES.hoodie);
  const hood = back
    ? `<path d="M118 44 Q120 -6 200 -4 Q280 -6 282 44 Q272 150 200 160 Q128 150 118 44Z" fill="${shade(color, -0.06)}" stroke="${line}" stroke-width="2"/>
       <path d="M200 -2 L200 156" stroke="${line}" stroke-width="2" opacity=".6"/>`
    : `<path d="M126 44 Q134 4 200 2 Q266 4 274 44 Q240 96 200 100 Q160 96 126 44Z" fill="${shade(color, -0.12)}" stroke="${line}" stroke-width="2"/>
       <path d="M148 46 Q200 120 252 46 Q200 70 148 46Z" fill="${shade(color, -0.55)}"/>
       <path d="M182 92 L178 182 M218 92 L222 182" stroke="${shade(color, 0.6)}" stroke-width="4" stroke-linecap="round"/>
       <circle cx="178" cy="186" r="5" fill="${shade(color, 0.5)}"/><circle cx="222" cy="186" r="5" fill="${shade(color, 0.5)}"/>`;
  const pocket = back ? '' : `<path d="M128 290 L272 290 L296 372 L104 372Z" fill="${shade(color, -0.05)}" stroke="${line}" stroke-width="2"/>
       <path d="M128 290 L104 372 M272 290 L296 372" stroke="${line}" stroke-width="3"/>`;
  const art = back
    ? `<text x="200" y="240" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="46" fill="${ink}" letter-spacing="1">${brand}</text>`
    : chestMark(brand, ink, 200, 240, 22);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 400 450">${fabricDefs(id, color)}
    <path d="${body}" fill="url(#k${id})" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="94" y="392" width="212" height="18" fill="${shade(color, -0.1)}"/>
    <path d="M338 384 L384 370 L380 344 L334 356Z M62 384 L16 370 L20 344 L66 356Z" fill="${shade(color, -0.12)}"/>
    ${art}${pocket}${hood}
    <path d="${body}" fill="url(#v${id})"/><path d="${body}" fill="url(#h${id})"/>
  </svg>`;
}

export function trousersSvg({ color = '#3b3f2f', back = false } = {}) {
  const id = `p${uid++}`;
  const line = shade(color, -0.3);
  const body = ptsToPath(OUTLINES.trousers);
  const pockets = back
    ? `<path d="M118 80 h64 v54 q-32 14 -64 0Z M218 80 h64 v54 q-32 14 -64 0Z" fill="none" stroke="${line}" stroke-width="2"/>`
    : `<path d="M96 50 Q132 70 140 110 M304 50 Q268 70 260 110" fill="none" stroke="${line}" stroke-width="2.5"/>
       <path d="M200 46 L200 128" stroke="${line}" stroke-width="2"/>
       <path d="M92 220 h64 v70 h-64Z M244 220 h64 v70 h-64Z" fill="${shade(color, -0.06)}" stroke="${line}" stroke-width="2"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440">${fabricDefs(id, color)}
    <path d="${body}" fill="url(#k${id})" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="92" y="20" width="216" height="30" fill="${shade(color, -0.12)}" stroke="${line}" stroke-width="2"/>
    ${[110, 160, 240, 290].map((x) => `<rect x="${x}" y="18" width="8" height="34" fill="${shade(color, -0.2)}"/>`).join('')}
    ${pockets}
    <path d="M60 396 L164 400 M236 400 L340 396" stroke="${line}" stroke-width="2" stroke-dasharray="5 4"/>
    <path d="${body}" fill="url(#v${id})"/><path d="${body}" fill="url(#h${id})"/>
  </svg>`;
}

export function capSvg({ color = '#1d1d1f', accent, brand = '', back = false } = {}) {
  const id = `c${uid++}`;
  const line = shade(color, -0.35);
  const ink = accent || (isLight(color) ? '#151515' : '#f4f1ea');
  const crown = 'M70 230 Q64 92 200 84 Q336 92 330 230Z';
  const front = `
    <path d="M60 236 Q200 200 340 236 Q370 270 330 292 Q200 262 70 292 Q30 270 60 236Z" fill="${shade(color, -0.1)}" stroke="${line}" stroke-width="2"/>
    <path d="M200 86 L200 230 M132 98 Q118 160 122 230 M268 98 Q282 160 278 230" stroke="${line}" stroke-width="2" fill="none" opacity=".7"/>
    ${brand ? `<text x="200" y="190" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="30" fill="${ink}" letter-spacing="1">${brand}</text>` : ''}`;
  const rear = `
    <path d="M150 200 Q200 160 250 200 L250 232 L150 232Z" fill="#0b0b0b" opacity=".85"/>
    <rect x="150" y="212" width="100" height="12" rx="3" fill="${shade(color, -0.2)}"/>
    <path d="M200 86 L200 160 M132 98 Q118 160 122 230 M268 98 Q282 160 278 230" stroke="${line}" stroke-width="2" fill="none" opacity=".7"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 40 400 280">${fabricDefs(id, color)}
    <path d="${crown}" fill="url(#k${id})" stroke="${line}" stroke-width="2"/>
    <circle cx="200" cy="86" r="8" fill="${shade(color, -0.2)}"/>
    ${back ? rear : front}
    <path d="${crown}" fill="url(#v${id})"/>
  </svg>`;
}

/* ---------- Sneakers (side profile, viewBox 0 0 420 240) ---------- */

// Heel on the left, toe on the right.
const SHOE_SHAPES = {
  runner: {
    upper: 'M52 170 C44 138 50 100 68 80 Q82 66 104 68 L150 72 Q172 76 184 90 L252 112 Q312 122 352 138 Q392 152 390 170 Z',
    collar: 'M76 78 Q112 64 154 76 Q122 92 82 90 Z',
    laces: { x: 168, y: 96, dx: 18, dy: 5, n: 5 },
    panel: 'M112 162 Q158 112 238 112 Q248 120 258 126 Q182 132 140 168Z',
    sole: 'M38 166 Q30 202 66 206 L356 206 Q398 204 394 172 L392 162 Z',
    soleH: 40,
  },
  court: {
    upper: 'M50 172 C46 144 52 112 68 96 Q82 84 104 86 L150 88 Q170 90 182 102 L252 120 Q316 130 356 146 Q390 158 388 172 Z',
    collar: 'M74 94 Q112 82 152 92 Q120 106 80 104 Z',
    laces: { x: 166, y: 106, dx: 18, dy: 4, n: 5 },
    panel: 'M104 166 Q150 120 236 120 Q246 128 254 132 Q176 138 132 170Z',
    sole: 'M40 170 Q36 196 62 198 L362 198 Q392 196 390 176 L390 168 Z',
    soleH: 28,
  },
  high: {
    upper: 'M50 170 C42 120 48 52 62 28 Q70 14 92 14 L148 16 Q164 18 168 36 L180 96 L252 116 Q316 128 356 144 Q390 156 388 170 Z',
    collar: 'M66 22 Q108 8 160 20 Q116 34 70 32 Z',
    laces: { x: 166, y: 44, dx: 4, dy: 13, n: 5 },
    panel: 'M90 150 Q140 96 230 112 Q242 120 252 124 Q170 128 118 162Z',
    sole: 'M40 168 Q36 196 62 198 L362 198 Q392 196 390 176 L390 166 Z',
    soleH: 28,
  },
};

export function sneakerSvg({ upper = '#f2f0ea', accent = '#d33b2c', sole = '#f7f5ef', shape = 'runner', brand = '', mirror = false } = {}) {
  const id = `s${uid++}`;
  if (mirror) brand = ''; // mirrored lettering would read backwards
  const s = SHOE_SHAPES[shape] || SHOE_SHAPES.runner;
  const line = shade(upper, -0.38);
  const ink = isLight(accent) ? '#151515' : '#fff';
  const L = s.laces;
  const laceColor = isLight(upper) ? shade(upper, -0.2) : shade(upper, 0.75);
  const laces = Array.from({ length: L.n }, (_, i) => {
    const x = L.x + i * L.dx, y = L.y + i * L.dy;
    return `<path d="M${x - 6} ${y - 9} L${x + 8} ${y + 7}" stroke="${laceColor}" stroke-width="5" stroke-linecap="round"/>`;
  }).join('');
  const panel = `<path d="${s.panel}" fill="${accent}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 240">
    <defs>
      <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity=".22"/>
      </linearGradient>
      <linearGradient id="sg${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".25"/>
      </linearGradient>
      <radialGradient id="sh${id}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="214" cy="214" rx="190" ry="14" fill="url(#sh${id})"/>
    <path d="${s.upper}" fill="${upper}" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M52 170 C46 140 52 112 66 96 L94 150 Q82 164 70 172Z" fill="${shade(upper, -0.1)}" stroke="${line}" stroke-width="1.5"/>
    <path d="M304 128 Q350 138 372 150 Q392 160 390 170 L318 168 Q318 146 304 128Z" fill="${shade(upper, -0.07)}" stroke="${line}" stroke-width="1.5"/>
    ${panel}
    <circle cx="74" cy="136" r="11" fill="${accent}"/>
    <text x="74" y="141" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="13" font-weight="900" fill="${ink}">${(brand || ' ')[0]}</text>
    <path d="${s.collar}" fill="${shade(upper, -0.6)}"/>
    ${laces}
    <path d="${s.upper}" fill="url(#g${id})"/>
    <path d="M60 160 Q200 150 380 162" stroke="${line}" stroke-width="1.5" stroke-dasharray="4 4" fill="none" opacity=".6"/>
    <path d="${s.sole}" fill="${sole}" stroke="${shade(sole, -0.35)}" stroke-width="2"/>
    <path d="M40 ${200 - (s.soleH > 30 ? 4 : 2)} L392 ${200 - (s.soleH > 30 ? 4 : 2)}" stroke="${shade(sole, -0.45)}" stroke-width="6" opacity=".55"/>
    <path d="${s.sole}" fill="url(#sg${id})"/>
  </svg>`;
  return mirror ? svg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 240">', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 240"><g transform="translate(420 0) scale(-1 1)">').replace(/<\/svg>$/, '</g></svg>') : svg;
}

/* ---------- Brand marks ---------- */

export function brandMarkSvg({ name, color = '#f2ede6', bg = 'none', style = 'word' }) {
  const glyph = {
    word: `<text x="160" y="72" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="46" letter-spacing="3" fill="${color}">${name}</text>`,
    slant: `<text x="160" y="72" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-style="italic" font-weight="900" font-size="48" fill="${color}" transform="skewX(-10) translate(12 0)">${name}</text>
            <path d="M40 86 L280 86" stroke="${color}" stroke-width="5"/>`,
    ring: `<circle cx="70" cy="58" r="30" fill="none" stroke="${color}" stroke-width="7"/><circle cx="70" cy="58" r="10" fill="${color}"/>
           <text x="190" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="38" letter-spacing="6" fill="${color}">${name}</text>`,
    stack: `<text x="160" y="56" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="40" letter-spacing="10" fill="${color}">${name}</text>
            <text x="160" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="15" letter-spacing="9" fill="${color}" opacity=".7">ATHLETIC</text>`,
  }[style];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120">${bg !== 'none' ? `<rect width="320" height="120" fill="${bg}"/>` : ''}${glyph}</svg>`;
}
