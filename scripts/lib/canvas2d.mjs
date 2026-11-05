// A tiny software Canvas2D good enough to run froD's renderer headlessly:
// fillRect, drawImage, affine transforms, globalAlpha, path fill, clearRect.
// Nearest-neighbor sampling keeps the pixel-art crisp. Used for screenshots.

function parseColor(s) {
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map(Number);
    return [p[0], p[1], p[2], p[3] === undefined ? 255 : Math.round(p[3] * 255)];
  }
  return [0, 0, 0, 255];
}

const ident = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
function mul(m, n) {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f
  };
}
function apply(m, x, y) { return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; }
function inverse(m) {
  const det = m.a * m.d - m.b * m.c;
  return {
    a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det
  };
}

class Ctx {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = { m: ident(), alpha: 1, fill: [0, 0, 0, 255] };
    this.stack = [];
    this.path = [];
    this.imageSmoothingEnabled = false;
  }
  set fillStyle(v) { this.state.fill = parseColor(v); }
  get fillStyle() { return this.state.fillStyleRaw; }
  set globalAlpha(v) { this.state.alpha = v; }
  get globalAlpha() { return this.state.alpha; }
  save() { this.stack.push({ m: { ...this.state.m }, alpha: this.state.alpha, fill: [...this.state.fill] }); }
  restore() { const s = this.stack.pop(); if (s) this.state = s; }
  translate(x, y) { this.state.m = mul(this.state.m, { a: 1, b: 0, c: 0, d: 1, e: x, f: y }); }
  scale(x, y) { this.state.m = mul(this.state.m, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }); }
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.state.m = mul(this.state.m, { a: c, b: s, c: -s, d: c, e: 0, f: 0 }); }
  beginPath() { this.path = []; }
  moveTo(x, y) { this.path.push([x, y]); }
  lineTo(x, y) { this.path.push([x, y]); }
  closePath() { if (this.path.length) this.path.push(this.path[0]); }
  fill() { this._poly(this.path.map(([x, y]) => apply(this.state.m, x, y)), this.state.fill, false); }

  _blend(px, py, r, g, b, a) {
    const c = this.canvas;
    if (px < 0 || py < 0 || px >= c.width || py >= c.height || a <= 0) return;
    const i = (py * c.width + px) * 4;
    const d = c.data;
    const ia = 1 - a;
    d[i] = r * a + d[i] * ia;
    d[i + 1] = g * a + d[i + 1] * ia;
    d[i + 2] = b * a + d[i + 2] * ia;
    d[i + 3] = Math.min(255, a * 255 + d[i + 3] * ia);
  }

  _poly(pts, color, clear) {
    if (pts.length < 3) return;
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const [r, g, b, ca] = color;
    const a = clear ? 1 : (ca / 255) * this.state.alpha;
    for (let py = Math.floor(minY); py <= Math.ceil(maxY); py++) {
      const yc = py + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) {
          xs.push(x1 + (yc - y1) / (y2 - y1) * (x2 - x1));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let px = Math.round(xs[k]); px < Math.round(xs[k + 1]); px++) {
          if (clear) {
            const c = this.canvas;
            if (px >= 0 && py >= 0 && px < c.width && py < c.height) {
              const i = (py * c.width + px) * 4;
              c.data[i] = c.data[i + 1] = c.data[i + 2] = c.data[i + 3] = 0;
            }
          } else this._blend(px, py, r, g, b, a);
        }
      }
    }
  }

  fillRect(x, y, w, h) {
    const m = this.state.m;
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => apply(m, px, py));
    this._poly(pts, this.state.fill, false);
  }
  clearRect(x, y, w, h) {
    const m = this.state.m;
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => apply(m, px, py));
    this._poly(pts, [0, 0, 0, 0], true);
  }
  drawImage(src, dx, dy) {
    const m = this.state.m;
    const sw = src.width, sh = src.height;
    const corners = [[dx, dy], [dx + sw, dy], [dx, dy + sh], [dx + sw, dy + sh]].map(([x, y]) => apply(m, x, y));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of corners) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    const inv = inverse(m);
    const alpha = this.state.alpha;
    for (let py = Math.floor(minY); py <= Math.ceil(maxY); py++) {
      for (let px = Math.floor(minX); px <= Math.ceil(maxX); px++) {
        const [sx, sy] = apply(inv, px + 0.5, py + 0.5);
        const u = Math.floor(sx - dx), v = Math.floor(sy - dy);
        if (u < 0 || v < 0 || u >= sw || v >= sh) continue;
        const si = (v * sw + u) * 4;
        const a = (src.data[si + 3] / 255) * alpha;
        if (a <= 0) continue;
        this._blend(px, py, src.data[si], src.data[si + 1], src.data[si + 2], a);
      }
    }
  }
}

export class Canvas {
  constructor(w = 300, h = 150) {
    this._w = w; this._h = h;
    this.data = Buffer.alloc(w * h * 4);
    this._ctx = new Ctx(this);
  }
  get width() { return this._w; }
  set width(v) { this._w = v; this.data = Buffer.alloc(this._w * this._h * 4); }
  get height() { return this._h; }
  set height(v) { this._h = v; this.data = Buffer.alloc(this._w * this._h * 4); }
  getContext() { return this._ctx; }
  toDataURL() { return 'data:image/png;base64,SOFTWARE'; }
}

// Nearest-neighbor upscale for crisp screenshots.
export function scaleUp(canvas, factor) {
  const out = new Canvas(canvas.width * factor, canvas.height * factor);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const si = (Math.floor(y / factor) * canvas.width + Math.floor(x / factor)) * 4;
    const di = (y * out.width + x) * 4;
    out.data[si] !== undefined && canvas.data.copy(out.data, di, si, si + 4);
  }
  return out;
}
