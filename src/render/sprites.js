// Procedural pixel-art sprites. Everything is baked to offscreen canvases at
// 16px/cell from string maps + tiny drawing helpers. Four theme palettes are
// derived from one base palette via color mixing. Requires DOM (browser only).

const MAPS = {
  frog: [
    '................',
    '..GGG......GGG..',
    '.GWWG......GWWG.',
    '.GWBGGGGGGGGBWG.',
    '..GGGGGGGGGGGG..',
    '.GGGLGGGGGGLGGG.',
    'GGGGLGGGGGGLGGGG',
    'GG.GGGGGGGGGG.GG',
    '...GGGGGGGGGG...',
    '.GGGGGLGGGLGGGG.',
    'GGG.GGGGGGGG.GGG',
    'GG...GGGGGG...GG',
    'GG............GG',
    '................',
    '................',
    '................'
  ],
  splat: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..GGGGGGGGGGGG..',
    '.GGGGGGGGGGGGGG.',
    'GGBGGGGGGGGGGBGG',
    'GGGGGGGGGGGGGGGG',
    '.GG.GG.GG.GG.GG.',
    '................',
    '................',
    '................'
  ],
  car: [
    '................',
    '................',
    '................',
    '...TT......TT...',
    '..cccccccccccc..',
    '.cCCCCCCCCCCCCc.',
    'RcCWWCCCCCCWWCcH',
    'RcCWWCCCCCCWWCcH',
    '.cCCCCCCCCCCCCc.',
    '..cccccccccccc..',
    '...TT......TT...',
    '................',
    '................',
    '................',
    '................',
    '................'
  ],
  racer: [
    '................',
    '................',
    '................',
    '....TT....TT....',
    '..ccccccccccc...',
    '.cCCCCCCCCCCCc..',
    'ccCWWCCCCCCCCcHH',
    'ccCWWCCCCCCCCcHH',
    '.cCCCCCCCCCCCc..',
    '..ccccccccccc...',
    '....TT....TT....',
    '................',
    '................',
    '................',
    '................',
    '................'
  ],
  turtle: [
    '................',
    '................',
    '................',
    '..ff......ff....',
    '....ssssss......',
    '...sSSSSSSs.hh..',
    '..sSSdSSdSSshhh.',
    '..sSSSSSSSSshh..',
    '...sSSSSSSs.....',
    '....ssssss......',
    '..ff......ff....',
    '................',
    '................',
    '................',
    '................',
    '................'
  ],
  turtleWarn: [
    '................',
    '................',
    '................',
    '................',
    '....ssssss......',
    '...sSSSSSSs.hh..',
    '..sSSdSSdSSshh..',
    '..sSSSSSSSSs....',
    'wwwwwwwwwwwwwwww',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................'
  ],
  turtleDown: [
    '................',
    '................',
    '................',
    '................',
    '......w.w.......',
    '.....w...w......',
    '......w.w.......',
    '................',
    'wwwwwwwwwwwwwwww',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................'
  ],
  fly1: [
    '..W..W..',
    '.WW..WW.',
    '..BBBB..',
    '.BBBBBB.',
    '..BBBB..',
    '...BB...',
    '........',
    '........'
  ],
  fly2: [
    '........',
    '........',
    '.WBBBBW.',
    '.WBBBBW.',
    '..BBBB..',
    '...BB...',
    '........',
    '........'
  ],
  star: [
    '................',
    '.......YY.......',
    '.......YY.......',
    '......YYYY......',
    '......YYYY......',
    '.YYYYYYYYYYYYYY.',
    '..YYYYYYYYYYYY..',
    '...YYYYYYYYYY...',
    '....YYYYYYYY....',
    '....YYYYYYYY....',
    '...YYYY..YYYY...',
    '...YYY....YYY...',
    '..YY........YY..',
    '................',
    '................',
    '................'
  ],
  logTile: [
    '................',
    '................',
    '................',
    'dddddddddddddddd',
    'LLLLLLLLLLLLLLLL',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'GGddGGGGddGGGGdG',
    'GGGGGGGGGGGGGGGG',
    'GGGGGGGGGGGGGGGG',
    'gggggggggggggggg',
    'dddddddddddddddd',
    '................',
    '................',
    '................',
    '................'
  ]
};

// ---- color helpers ---------------------------------------------------------
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

const BASE = {
  water1: '#2a6db5', water2: '#3f86cf', spark: '#9fd4f5', bayWater: '#1d4f86',
  road: '#3a3f47', roadLine: '#c9cdd4', curb: '#8f97a3',
  safe: '#b09a5e', safeDot: '#93804c',
  hedge: '#1e5c2e', hedgeLight: '#2e7d3e', hedgeDark: '#14421f',
  log: '#8a5a2b', logLight: '#a5713a', logDark: '#5f3d1c', logRing: '#c99a5e',
  shell: '#2e8b57', shellDark: '#1d5c39', skin: '#7fce8f',
  frog: '#3fae49', frogDark: '#2a7d33', frogLight: '#7fd487', eyeW: '#f4fff4', eyeB: '#101418',
  window: '#a8d8e8', tire: '#1c1c22', headlight: '#fff7ae', taillight: '#e04545',
  truckBox: '#d8d8d8', truckShade: '#a8a8a8',
  fly: '#20242c', wing: '#cfe8ff',
  star: '#ffd23e', starDark: '#c99a1e',
  clockRim: '#2a6db5', clockFace: '#f4f8ff', clockHand: '#20242c',
  car0: '#d94f3d', car0s: '#a83a2c',
  car1: '#e8c33a', car1s: '#b5952a',
  car2: '#3aa6a0', car2s: '#2b7d78',
  taxi: '#f2c230', taxis: '#bd941f',
  bus: '#e07b2a', buss: '#ad5c1d',
  racer: '#d94fa0', racers: '#a83a7a'
};

function themePalette(theme) {
  const p = { ...BASE };
  const tintAll = (color, t) => {
    for (const k of Object.keys(p)) p[k] = mix(p[k], color, t);
  };
  if (theme === 'dusk') {
    tintAll('#ff8c42', 0.14);
    p.water1 = '#3a5f9e'; p.water2 = '#5a7cc0'; p.spark = '#ffc98a';
    p.road = '#3a3540'; p.safe = '#a88a56';
  } else if (theme === 'night') {
    tintAll('#0a1030', 0.42);
    p.water1 = '#12275c'; p.water2 = '#1d3a7a'; p.spark = '#7fa8e8'; p.bayWater = '#0d1d44';
    p.road = '#23262e'; p.roadLine = '#8a90a0'; p.safe = '#5f5640';
    p.hedge = '#12301c'; p.hedgeLight = '#1a4226'; p.hedgeDark = '#0b1f12';
    p.headlight = '#fff7ae'; p.taillight = '#ff5a5a';
    p.frog = '#3f9e49'; p.frogLight = '#6fbf77';
    p.star = '#ffe066';
  } else if (theme === 'dawn') {
    tintAll('#ffd9e8', 0.13);
    p.water1 = '#3a7ab0'; p.water2 = '#5f9cd0'; p.spark = '#ffe8f0';
    p.safe = '#bda86a'; p.hedgeLight = '#3f9e50';
  }
  return p;
}

// ---- baking helpers ---------------------------------------------------------
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function bakeMap(map, colors, w = 16) {
  const h = map.length;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = map[y];
    for (let x = 0; x < Math.min(w, row.length); x++) {
      const col = colors[row[x]];
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    }
  }
  return c;
}

function rotate(src, turns) {
  const c = canvas(src.height, src.width);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(turns * Math.PI / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

function flipX(src) {
  const c = canvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function drawTruck(p, cabColor, cabShade) {
  const c = canvas(32, 16);
  const x = c.getContext('2d');
  // trailer
  x.fillStyle = p.truckShade; x.fillRect(0, 3, 22, 10);
  x.fillStyle = p.truckBox; x.fillRect(1, 4, 20, 8);
  x.fillStyle = p.truckShade;
  for (let i = 4; i < 20; i += 5) x.fillRect(i, 4, 1, 8);
  // cab
  x.fillStyle = cabShade; x.fillRect(23, 4, 8, 8);
  x.fillStyle = cabColor; x.fillRect(24, 5, 7, 6);
  x.fillStyle = p.window; x.fillRect(28, 5, 2, 6);
  x.fillStyle = p.headlight; x.fillRect(31, 6, 1, 4);
  x.fillStyle = p.taillight; x.fillRect(0, 5, 1, 6);
  // wheels
  x.fillStyle = p.tire;
  x.fillRect(3, 2, 3, 1); x.fillRect(3, 13, 3, 1);
  x.fillRect(16, 2, 3, 1); x.fillRect(16, 13, 3, 1);
  x.fillRect(26, 2, 3, 1); x.fillRect(26, 13, 3, 1);
  return c;
}

function drawBus(p, body, shade) {
  const c = canvas(32, 16);
  const x = c.getContext('2d');
  x.fillStyle = shade; x.fillRect(0, 3, 31, 10);
  x.fillStyle = body; x.fillRect(1, 4, 30, 8);
  x.fillStyle = p.window;
  for (let i = 3; i < 26; i += 5) x.fillRect(i, 5, 3, 6);
  x.fillRect(27, 5, 2, 6);
  x.fillStyle = p.headlight; x.fillRect(31, 6, 1, 4);
  x.fillStyle = p.taillight; x.fillRect(0, 5, 1, 6);
  x.fillStyle = p.tire;
  x.fillRect(4, 2, 3, 1); x.fillRect(4, 13, 3, 1);
  x.fillRect(24, 2, 3, 1); x.fillRect(24, 13, 3, 1);
  return c;
}

function drawHedge(p) {
  const c = canvas(16, 16);
  const x = c.getContext('2d');
  x.fillStyle = p.hedge; x.fillRect(0, 0, 16, 16);
  // deterministic bump texture
  let s = 12345;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    x.fillStyle = rnd() < 0.5 ? p.hedgeLight : p.hedgeDark;
    x.fillRect(Math.floor(rnd() * 15), Math.floor(rnd() * 15), 2, 1);
  }
  x.fillStyle = p.hedgeDark; x.fillRect(0, 15, 16, 1);
  x.fillStyle = p.hedgeLight; x.fillRect(0, 0, 16, 1);
  return c;
}

function drawClock(p) {
  const c = canvas(16, 16);
  const x = c.getContext('2d');
  for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) {
    const d = Math.hypot(xx - 7.5, yy - 7.5);
    if (d <= 7.2) { x.fillStyle = d > 5.8 ? p.clockRim : p.clockFace; x.fillRect(xx, yy, 1, 1); }
  }
  x.fillStyle = p.clockHand;
  x.fillRect(7, 4, 1, 4); x.fillRect(8, 8, 3, 1); x.fillRect(7, 7, 2, 2);
  return c;
}

function drawLogCap(p, side) {
  const c = canvas(16, 16);
  const x = c.getContext('2d');
  const tile = bakeMap(MAPS.logTile, { d: p.logDark, L: p.logLight, G: p.log, g: p.logDark });
  x.drawImage(tile, 0, 0);
  // rounded end + rings
  const ex = side === 'L' ? 0 : 13;
  x.fillStyle = p.logRing; x.fillRect(ex, 4, 3, 7);
  x.fillStyle = p.logDark; x.fillRect(side === 'L' ? 1 : 14, 6, 1, 3);
  x.fillStyle = p.log; x.fillRect(side === 'L' ? 2 : 13, 5, 1, 5);
  return c;
}

// ---- public API ---------------------------------------------------------
const cache = new Map();

export function bakeSprites(theme = 'day') {
  if (cache.has(theme)) return cache.get(theme);
  const p = themePalette(theme);
  const frogColors = { G: p.frog, D: p.frogDark, L: p.frogLight, W: p.eyeW, B: p.eyeB };
  const frogUp = bakeMap(MAPS.frog, frogColors);
  const carColors = (body, shade) => ({
    C: body, c: shade, W: p.window, T: p.tire, H: p.headlight, R: p.taillight
  });
  const turtleColors = { s: p.shellDark, S: p.shell, d: p.shellDark, f: p.skin, h: p.skin, w: p.spark };
  const sprites = {
    colors: p,
    frog: { up: frogUp, down: rotate(frogUp, 2), left: rotate(frogUp, 3), right: rotate(frogUp, 1) },
    splat: bakeMap(MAPS.splat, frogColors),
    car: [
      bakeMap(MAPS.car, carColors(p.car0, p.car0s)),
      bakeMap(MAPS.car, carColors(p.car1, p.car1s)),
      bakeMap(MAPS.car, carColors(p.car2, p.car2s))
    ],
    taxi: bakeMap(MAPS.car, carColors(p.taxi, p.taxis)),
    racer: bakeMap(MAPS.racer, carColors(p.racer, p.racers)),
    truck: [drawTruck(p, p.car0, p.car0s), drawTruck(p, p.car2, p.car2s), drawTruck(p, p.car1, p.car1s)],
    bus: [drawBus(p, p.bus, p.buss), drawBus(p, p.car2, p.car2s), drawBus(p, p.car0, p.car0s)],
    logTile: bakeMap(MAPS.logTile, { d: p.logDark, L: p.logLight, G: p.log, g: p.logDark }),
    logL: drawLogCap(p, 'L'),
    logR: drawLogCap(p, 'R'),
    turtle: {
      up: bakeMap(MAPS.turtle, turtleColors),
      warning: bakeMap(MAPS.turtleWarn, turtleColors),
      down: bakeMap(MAPS.turtleDown, turtleColors)
    },
    fly: [
      bakeMap(MAPS.fly1, { B: p.fly, W: p.wing }, 8),
      bakeMap(MAPS.fly2, { B: p.fly, W: p.wing }, 8)
    ],
    star: bakeMap(MAPS.star, { Y: p.star }),
    clock: drawClock(p),
    hedge: drawHedge(p)
  };
  sprites.turtleLeft = {
    up: flipX(sprites.turtle.up),
    warning: flipX(sprites.turtle.warning),
    down: flipX(sprites.turtle.down)
  };
  cache.set(theme, sprites);
  return sprites;
}

export { MAPS };
