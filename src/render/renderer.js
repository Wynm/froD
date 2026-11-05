// Canvas renderer. World is 208×208 art pixels, scaled up with pixelated CSS.
// Coordinate convention:
//   grid-centered things (frog, bays, pickups): pixel = coord*16  (top-left)
//   continuous things (vehicles, logs, turtles): pixel-left = coord*16 + 8
// This keeps collision math and visuals perfectly aligned.
import { W, H, CELL, COLS, GOAL_ROW, MEDIAN_ROW, START_ROW, rowKind } from '../game/constants.js';
import { bakeSprites } from './sprites.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = 'day';
    this.sprites = bakeSprites('day');
  }

  setTheme(theme) {
    if (theme !== this.theme) {
      this.theme = theme;
      this.sprites = bakeSprites(theme);
    }
  }

  draw(world, game, fx, t) {
    const ctx = this.ctx;
    const S = this.sprites;
    const p = S.colors;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const [sx, sy] = fx.shakeOffset();
    ctx.translate(Math.round(sx), Math.round(sy));

    this.drawBackground(world, t);
    this.drawPlatforms(world, t);
    this.drawVehicles(world, t);
    this.drawPickup(world, t);
    this.drawBayContents(world, t);
    if (!world.attract) this.drawFrog(world, game, t);
    if (this.theme === 'night' || this.theme === 'dusk') this.drawLights(world, t);
    if (this.theme === 'night') this.drawFireflies(t);
    fx.draw(ctx);
    ctx.restore();
  }

  // ---- background ----------------------------------------------------------
  drawBackground(world, t) {
    const ctx = this.ctx, p = this.sprites.colors, S = this.sprites;
    for (let y = 0; y < 13; y++) {
      const kind = rowKind(y);
      const py = y * CELL;
      if (kind === 'goal') {
        for (let x = 0; x < COLS; x++) ctx.drawImage(S.hedge, x * CELL, py);
        for (const b of world.bays) {
          const bx = b.x * CELL;
          ctx.fillStyle = p.bayWater; ctx.fillRect(bx, py, CELL, CELL);
          ctx.fillStyle = p.water2; ctx.fillRect(bx + 1, py + 2, CELL - 2, 1);
          // pulsing rim on empty bays to guide the player
          if (!b.filled) {
            const a = 0.35 + 0.25 * Math.sin(t * 3 + b.x);
            ctx.globalAlpha = a;
            ctx.fillStyle = p.frogLight;
            ctx.fillRect(bx, py + CELL - 2, CELL, 1);
            ctx.fillRect(bx, py, 1, CELL);
            ctx.fillRect(bx + CELL - 1, py, 1, CELL);
            ctx.globalAlpha = 1;
          }
        }
      } else if (kind === 'river') {
        ctx.fillStyle = p.water1; ctx.fillRect(0, py, W, CELL);
        const lane = world.lanes[y];
        ctx.fillStyle = p.water2;
        for (let i = 0; i < 8; i++) {
          const speed = lane ? lane.dir * lane.speed * 9 : 4;
          let x = ((i * 31 + t * speed) % (W + 24));
          if (x < 0) x += W + 24;
          x -= 12;
          ctx.globalAlpha = 0.65;
          ctx.fillRect(Math.round(x), py + 3 + (i * 7) % 10, 5, 1);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.spark;
        for (let i = 0; i < 2; i++) {
          if (Math.sin(t * 2.4 + y * 1.7 + i * 2.9) > 0.75) {
            ctx.fillRect((y * 53 + i * 97) % W, py + 5 + i * 6, 1, 1);
          }
        }
      } else if (kind === 'safe') {
        ctx.fillStyle = p.safe; ctx.fillRect(0, py, W, CELL);
        ctx.fillStyle = p.safeDot;
        for (let i = 0; i < 14; i++) ctx.fillRect((i * 37 + y * 11) % W, py + 2 + (i * 5) % 12, 1, 1);
      } else { // road
        ctx.fillStyle = p.road; ctx.fillRect(0, py, W, CELL);
        ctx.fillStyle = p.roadLine;
        // dashed line at the top of each road lane except the first
        if (y > 7) for (let x = 0; x < W; x += 8) ctx.fillRect(x, py, 4, 1);
      }
    }
    // curbs around the road
    ctx.fillStyle = p.curb;
    ctx.fillRect(0, 7 * CELL - 1, W, 1);
    ctx.fillRect(0, 12 * CELL, W, 1);
  }

  // ---- river platforms -------------------------------------------------------
  drawPlatforms(world, t) {
    const ctx = this.ctx, S = this.sprites;
    for (const lane of world.lanes) {
      if (lane.kind !== 'river') continue;
      const py = lane.y * CELL;
      for (const item of lane.items) {
        const px = Math.round(item.x * CELL + 8);
        if (px > W + 32 || px + item.len * CELL < -32) continue;
        if (item.type === 'log') {
          ctx.drawImage(S.logL, px, py);
          for (let i = 1; i < item.len - 1; i++) ctx.drawImage(S.logTile, px + i * CELL, py);
          ctx.drawImage(S.logR, px + (item.len - 1) * CELL, py);
        } else {
          const state = world.turtleState(item);
          const set = lane.dir < 0 ? S.turtleLeft : S.turtle;
          const img = set[state];
          for (let i = 0; i < item.len; i++) ctx.drawImage(img, px + i * CELL, py);
        }
      }
    }
  }

  // ---- vehicles --------------------------------------------------------------
  drawVehicles(world, t) {
    const ctx = this.ctx, S = this.sprites;
    for (const lane of world.lanes) {
      if (lane.kind !== 'road') continue;
      const py = lane.y * CELL;
      for (const item of lane.items) {
        const px = Math.round(item.x * CELL + 8);
        const w = item.len * CELL;
        if (px > W + 32 || px + w < -32) continue;
        let img;
        if (item.type === 'car') img = S.car[item.variant];
        else if (item.type === 'taxi') img = S.taxi;
        else if (item.type === 'racer') img = S.racer;
        else if (item.type === 'truck') img = S.truck[item.variant];
        else img = S.bus[item.variant];
        if (lane.dir < 0) {
          ctx.save();
          ctx.translate(px + w, py);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        } else {
          ctx.drawImage(img, px, py);
        }
      }
    }
  }

  drawLights(world, t) {
    const ctx = this.ctx;
    ctx.save();
    for (const lane of world.lanes) {
      if (lane.kind !== 'road') continue;
      const py = lane.y * CELL;
      for (const item of lane.items) {
        const px = item.x * CELL + 8;
        const w = item.len * CELL;
        if (px > W + 32 || px + w < -32) continue;
        const frontX = lane.dir > 0 ? px + w : px;
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#fff7ae';
        ctx.beginPath();
        ctx.moveTo(frontX, py + 5);
        ctx.lineTo(frontX + lane.dir * 26, py + 2);
        ctx.lineTo(frontX + lane.dir * 26, py + 13);
        ctx.lineTo(frontX, py + 10);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawFireflies(t) {
    const ctx = this.ctx;
    for (let i = 0; i < 6; i++) {
      const x = (Math.sin(t * 0.31 + i * 2.1) * 0.5 + 0.5) * W;
      const y = (Math.cos(t * 0.23 + i * 1.7) * 0.5 + 0.5) * H;
      const a = 0.3 + 0.5 * Math.max(0, Math.sin(t * 1.9 + i * 1.3));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- pickups & bay contents -------------------------------------------------
  drawPickup(world, t) {
    if (!world.pickup) return;
    const ctx = this.ctx, S = this.sprites;
    const p = world.pickup;
    const bob = Math.round(Math.sin(t * 4) * 1.5);
    const px = p.x * CELL, py = MEDIAN_ROW * CELL + bob;
    const blink = p.ttl < 2 && Math.sin(t * 12) > 0;
    if (blink) return;
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 5);
    ctx.fillStyle = p.type === 'star' ? S.colors.star : S.colors.clockRim;
    ctx.fillRect(px + 2, py + 2, 12, 12);
    ctx.globalAlpha = 1;
    ctx.drawImage(p.type === 'star' ? S.star : S.clock, px, py);
  }

  drawBayContents(world, t) {
    const ctx = this.ctx, S = this.sprites;
    const frame = Math.floor(t * 10) % 2;
    for (const b of world.bays) {
      const bx = b.x * CELL;
      if (b.filled) {
        ctx.drawImage(S.frog.up, bx, GOAL_ROW * CELL);
      } else if (b.fly > 0) {
        const bob = Math.round(Math.sin(t * 6 + b.x) * 1);
        const blink = b.fly < 1.5 && Math.sin(t * 12) > 0;
        if (!blink) ctx.drawImage(S.fly[frame], bx + 4, GOAL_ROW * CELL + 4 + bob);
      }
    }
  }

  // ---- frog -------------------------------------------------------------------
  drawFrog(world, game, t) {
    const f = world.frog;
    if (!f || f.scored) return;
    const ctx = this.ctx, S = this.sprites;
    let cx = f.x * CELL + 8;
    let cy = f.y * CELL + 8;
    let arc = 0, scaleX = 1, scaleY = 1, alpha = 1;
    let img = S.frog[f.dir] || S.frog.up;

    if (f.dead) {
      const dt = f.deathT;
      if (f.deathCause === 'car') {
        img = S.splat;
        alpha = dt > 0.7 ? Math.max(0, 1 - (dt - 0.7) / 0.4) : 1;
      } else if (f.deathCause === 'water') {
        cy += dt * 7;
        alpha = Math.max(0, 1 - dt / 0.95);
        img = S.frog.up;
      } else if (f.deathCause === 'edge') {
        const lane = world.lanes[f.y];
        cx += (lane ? lane.dir : 1) * dt * 40;
        alpha = Math.max(0, 1 - dt / 0.9);
        img = S.frog.up;
      } else if (f.deathCause === 'hedge') {
        cx += Math.sin(dt * 40) * 2 * Math.max(0, 1 - dt);
        img = S.frog.up;
        alpha = dt > 0.8 ? Math.max(0, 1 - (dt - 0.8) / 0.35) : 1;
      } else { // time
        img = S.frog.up;
        alpha = dt > 0.8 ? Math.max(0, 1 - (dt - 0.8) / 0.35) : 1;
        // dizzy stars
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + i * 2.09;
          ctx.fillStyle = S.colors.star;
          ctx.fillRect(Math.round(cx + Math.cos(a) * 8), Math.round(cy - 8 + Math.sin(a) * 3), 2, 2);
        }
      }
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, Math.round(cx - 8), Math.round(cy - 8));
      ctx.globalAlpha = 1;
      return;
    }

    if (f.hopping) {
      const h = f.hopping;
      const tt = Math.min(1, h.t);
      cx = lerp(h.x0, h.x1, tt) * CELL + 8;
      cy = lerp(h.y0, h.y1, tt) * CELL + 8;
      arc = Math.sin(Math.PI * tt) * 5;
      const stretch = Math.sin(Math.PI * tt) * 0.18;
      if (h.x0 !== h.x1) { scaleX = 1 + stretch; scaleY = 1 - stretch; }
      else { scaleY = 1 + stretch; scaleX = 1 - stretch; }
      // ground shadow
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      ctx.fillRect(Math.round(cx - 5), Math.round(cy + 5), 10, 2);
      ctx.globalAlpha = 1;
    } else {
      const breathe = 1 + Math.sin(t * 3) * 0.02;
      scaleY = breathe; scaleX = 1 / breathe;
    }

    if (f.invuln > 0 && Math.sin(t * 24) < 0) alpha = 0.35;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(cx), Math.round(cy - arc));
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(img, -8, -8);
    ctx.restore();
    ctx.globalAlpha = 1;

    // shield ring
    if (f.shield) {
      const a = 0.5 + 0.3 * Math.sin(t * 6);
      ctx.globalAlpha = a;
      ctx.fillStyle = S.colors.star;
      const r = 9;
      for (let i = 0; i < 8; i++) {
        const ang = i * Math.PI / 4 + t * 1.5;
        ctx.fillRect(Math.round(cx + Math.cos(ang) * r) - 1, Math.round(cy - arc + Math.sin(ang) * r) - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }
}
