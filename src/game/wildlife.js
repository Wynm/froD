// Wildlife layer: escort frogs, log snakes and a telegraphed heron.
// Pure simulation. Schedules are seeded by the level config and driven by
// world.time, so retries / daily runs do not depend on input timing or RNG calls.
import { COLS, START_ROW, GOAL_ROW, rowKind } from './constants.js';

export const WILDLIFE = {
  ESCORT_TTL: 12,
  ESCORT_EVERY: 14,
  SNAKE_HALF: 0.24,
  HERON_WARNING: 1.35,
  HERON_STRIKE: 0.32,
  HERON_RECOVER: 0.55,
  HERON_RADIUS: 0.62
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function wildlifeConfig(level, rng) {
  return {
    escort: true,
    snakes: level >= 3 ? (level >= 8 ? 2 : 1) : 0,
    heron: level >= 4,
    escortFirst: 3 + rng() * 2,
    escortPhase: Math.floor(rng() * 5),
    heronFirst: 6.5 + rng() * 2,
    heronEvery: Math.max(8, 13 - level * 0.25) + rng() * 2,
    snakePhase: rng() * Math.PI * 2
  };
}

export class Wildlife {
  constructor(world) {
    this.world = world;
    this.cfg = world.cfg.wildlife || { escort: false, snakes: 0, heron: false };
    this.lady = null;
    this.escortTimer = this.cfg.escortFirst ?? 4;
    this.escortSerial = this.cfg.escortPhase ?? 0;
    this.snakes = [];
    this.heron = null;
    this.heronTimer = this.cfg.heronFirst ?? 8;
    this.spawnSnakes();
  }

  // Choose long, distinct logs as habitats. Never put a snake on a tiny log or
  // on a diving turtle: the player always has other routes across the river.
  spawnSnakes() {
    const count = this.cfg.snakes || 0;
    const habitats = [];
    for (const lane of this.world.lanes) {
      if (lane.kind !== 'river') continue;
      for (const log of lane.items) {
        if (log.type === 'log' && log.len >= 3) habitats.push({ lane, log });
      }
    }
    habitats.sort((a, b) => b.log.len - a.log.len || a.lane.y - b.lane.y || a.log.x - b.log.x);
    const used = new Set();
    for (const h of habitats) {
      if (this.snakes.length >= count) break;
      if (used.has(h.lane.y)) continue;
      used.add(h.lane.y);
      const offset = h.log.len * 0.5;
      this.snakes.push({
        laneY: h.lane.y, log: h.log, offset,
        x: h.log.x + offset, dir: 1, mode: 'patrol',
        phase: (this.cfg.snakePhase || 0) + this.snakes.length * 1.7
      });
    }
  }

  onRespawn() {
    // A new life is never struck by an old warning. Waiting escorts survive.
    this.heron = null;
    this.heronTimer = Math.max(this.heronTimer, 3);
    if (this.world.frog) this.world.frog.escort = false;
  }

  loseEscort() {
    const f = this.world.frog;
    if (!f?.escort) return;
    f.escort = false;
    this.lady = null;
    this.escortTimer = Math.min(this.escortTimer, 5);
    this.world.events.emit('escortLost', { x: f.x, y: f.y });
  }

  spawnEscort() {
    const w = this.world;
    const candidates = [];
    for (const lane of w.lanes) {
      if (lane.kind !== 'river') continue;
      if (this.snakes.some(s => s.laneY === lane.y)) continue;
      for (const log of lane.items) {
        if (log.type !== 'log' || log.len < 3) continue;
        const offset = log.len * 0.5;
        const x = log.x + offset;
        if (x >= 1 && x <= COLS - 2) candidates.push({ lane, log, offset, x });
      }
    }
    if (!candidates.length) { this.escortTimer = 1; return; }
    candidates.sort((a, b) => a.lane.y - b.lane.y || a.log.x - b.log.x);
    const c = candidates[this.escortSerial++ % candidates.length];
    this.lady = { laneY: c.lane.y, log: c.log, offset: c.offset, x: c.x, ttl: WILDLIFE.ESCORT_TTL };
    w.events.emit('escortSpawn', { x: c.x, y: c.laneY });
  }

  updateSnakes(dt) {
    const w = this.world, f = w.frog;
    for (const s of this.snakes) {
      const chasing = !f.dead && !f.scored && !f.hopping && f.y === s.laneY && f.ride === s.log;
      const mode = chasing ? 'chase' : 'patrol';
      if (mode === 'chase' && s.mode !== 'chase') w.events.emit('snakeAlert', { x: s.x, y: s.laneY });
      s.mode = mode;
      if (chasing) {
        const delta = f.x - s.x;
        if (Math.abs(delta) > 0.05) s.dir = Math.sign(delta);
        s.offset += s.dir * (0.62 + Math.min(0.3, w.cfg.level * 0.02)) * dt;
      } else {
        // Slow, readable patrol; phase makes each habitat feel distinct.
        s.offset += Math.cos(w.time * 0.9 + s.phase) * 0.42 * dt;
      }
      const lo = 0.45, hi = s.log.len - 0.45;
      if (s.offset <= lo || s.offset >= hi) {
        s.offset = clamp(s.offset, lo, hi);
        s.dir *= -1;
        s.phase += Math.PI;
      }
      s.x = s.log.x + s.offset;
    }
  }

  snakeHit(x, y, ride = null) {
    const f = this.world.frog;
    for (const s of this.snakes) {
      if (y !== s.laneY) continue;
      if (ride && ride !== s.log) continue;
      if (Math.abs(x - s.x) < 0.34 + WILDLIFE.SNAKE_HALF) return s;
    }
    return null;
  }

  // Used by the autopilot: conservative prediction of a snake's landing cell.
  snakeDanger(x, y, dt = 0) {
    for (const s of this.snakes) {
      if (y !== s.laneY) continue;
      const lane = this.world.lanes[y];
      const futureLog = s.log.x + lane.dir * lane.speed * dt;
      const futureX = futureLog + s.offset + s.dir * 0.4 * dt;
      if (Math.abs(x - futureX) < 0.95) return true;
    }
    return false;
  }

  updateEscort(dt) {
    const w = this.world, f = w.frog;
    if (this.lady) {
      this.lady.x = this.lady.log.x + this.lady.offset;
      this.lady.ttl -= dt;
      if (this.lady.ttl <= 0 || this.lady.x < -1 || this.lady.x > COLS) {
        this.lady = null;
        this.escortTimer = WILDLIFE.ESCORT_EVERY;
      } else if (!f.dead && !f.scored && !f.hopping && !f.escort &&
                 f.y === this.lady.laneY && f.ride === this.lady.log &&
                 Math.abs(f.x - this.lady.x) < 0.55) {
        f.escort = true;
        const pos = { x: this.lady.x, y: this.lady.laneY };
        this.lady = null;
        this.escortTimer = WILDLIFE.ESCORT_EVERY;
        w.events.emit('escortPickup', pos);
      }
    } else if (!f.escort && !f.dead && !f.scored) {
      this.escortTimer -= dt;
      if (this.escortTimer <= 0) this.spawnEscort();
    }
  }

  updateHeron(dt) {
    const w = this.world, f = w.frog;
    if (!this.cfg.heron) return;
    if (this.heron) {
      const h = this.heron;
      h.t += dt;
      if (h.phase === 'warning' && h.t >= WILDLIFE.HERON_WARNING) {
        h.phase = 'strike'; h.t = 0;
        w.events.emit('heronStrike', { x: h.x, y: h.y });
        const grounded = !f.hopping && !f.dead && !f.scored;
        if (grounded && f.y === h.y && Math.abs(f.x - h.x) < WILDLIFE.HERON_RADIUS) {
          w.die('heron');
        } else {
          w.events.emit('heronMiss', { x: h.x, y: h.y });
        }
      } else if (h.phase === 'strike' && h.t >= WILDLIFE.HERON_STRIKE) {
        h.phase = 'recover'; h.t = 0;
      } else if (h.phase === 'recover' && h.t >= WILDLIFE.HERON_RECOVER) {
        this.heron = null;
        this.heronTimer = this.cfg.heronEvery ?? 12;
      }
      return;
    }
    if (f.dead || f.scored || f.hopping) return;
    this.heronTimer -= dt;
    // The start bank and completed homes are sanctuary. A locked shadow gives
    // more than a second to hop away; shields do not stop a bird.
    if (this.heronTimer <= 0 && f.y !== START_ROW && f.y !== GOAL_ROW && f.idleT > 0.35) {
      this.heron = { x: f.x, y: f.y, t: 0, phase: 'warning' };
      w.events.emit('heronWarn', { x: f.x, y: f.y });
    }
  }

  update(dt) {
    const w = this.world;
    if (!this.cfg.escort && !this.cfg.snakes && !this.cfg.heron) return;
    this.updateSnakes(dt);
    if (w.frog.dead || w.frog.scored) {
      // Keep an existing strike animation moving, but never spawn new threats.
      if (this.heron) {
        this.heron.t += dt;
        if (this.heron.phase === 'strike' && this.heron.t > WILDLIFE.HERON_STRIKE) {
          this.heron.phase = 'recover'; this.heron.t = 0;
        } else if (this.heron.phase === 'recover' && this.heron.t > WILDLIFE.HERON_RECOVER) {
          this.heron = null;
        }
      }
      return;
    }
    this.updateEscort(dt);
    this.updateHeron(dt);
    const f = w.frog;
    if (!f.dead && !f.scored && !f.hopping && rowKind(f.y) === 'river') {
      if (this.snakeHit(f.x, f.y, f.ride)) w.die('snake');
    }
  }
}
