// Pixel particle system + screen shake + flash. Coordinates in art pixels.
export class FX {
  constructor() {
    this.parts = [];
    this.shakeMag = 0;
    this.flashColor = null;
    this.flashA = 0;
    this.reduceMotion = false;
  }

  burst(x, y, { count = 12, colors = ['#fff'], speed = 40, life = 0.5, gravity = 60, size = 2 } = {}) {
    const n = this.reduceMotion ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3,
        life: life * (0.6 + Math.random() * 0.7), max: life,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: size * (0.7 + Math.random() * 0.6),
        grav: gravity
      });
    }
    if (this.parts.length > 400) this.parts.splice(0, this.parts.length - 400);
  }

  splash(x, y) {
    this.burst(x, y, { count: 18, colors: ['#7fd4ff', '#b8e8ff', '#3a9ad9'], speed: 55, life: 0.6, gravity: 140 });
  }
  hit(x, y) {
    this.burst(x, y, { count: 16, colors: ['#ff5a5a', '#ffd23e', '#fff'], speed: 65, life: 0.5, gravity: 80 });
    this.shake(3.5);
    this.flash('#ff3b30', 0.22);
  }
  dust(x, y) {
    this.burst(x, y + 6, { count: 4, colors: ['#c9b98a', '#a89468'], speed: 18, life: 0.3, gravity: -10, size: 1.5 });
  }
  sparkle(x, y) {
    this.burst(x, y, { count: 12, colors: ['#ffe066', '#fff7cc', '#ffd23e'], speed: 35, life: 0.6, gravity: -20, size: 1.5 });
  }
  confetti(x, y) {
    this.burst(x, y, { count: 26, colors: ['#ff5a5a', '#ffd23e', '#6ee76e', '#7fd4ff', '#e08fff'], speed: 70, life: 0.9, gravity: 90 });
  }
  bubbles(x, y) {
    this.burst(x, y, { count: 8, colors: ['#b8e8ff', '#7fd4ff'], speed: 15, life: 0.8, gravity: -60, size: 1.5 });
  }

  shake(m) { if (!this.reduceMotion) this.shakeMag = Math.max(this.shakeMag, m); }
  flash(color, a) { if (!this.reduceMotion) { this.flashColor = color; this.flashA = a; } }

  shakeOffset() {
    if (this.shakeMag <= 0.05) return [0, 0];
    return [(Math.random() - 0.5) * this.shakeMag * 2, (Math.random() - 0.5) * this.shakeMag * 2];
  }

  update(dt) {
    this.shakeMag = Math.max(0, this.shakeMag - dt * 14);
    this.flashA = Math.max(0, this.flashA - dt * 0.9);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
    if (this.flashA > 0.01 && this.flashColor) {
      ctx.globalAlpha = this.flashA;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = 1;
    }
  }
}
