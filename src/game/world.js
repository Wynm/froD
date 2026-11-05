// World simulation: frog, conveyors, collisions, timer, pickups.
// Pure logic (no DOM) so it can be unit-tested in Node.
import {
  COLS, START_ROW, GOAL_ROW, MEDIAN_ROW, HOP_TIME, FROG_HALF, SUPPORT_TOL,
  DIRS, rowKind
} from './constants.js';
import { Emitter } from '../core/events.js';

export class World {
  constructor(config, rng = Math.random) {
    this.cfg = config;
    this.lanes = config.lanes;
    this.bays = config.bays.map(b => ({ ...b }));
    this.rng = rng;
    this.events = new Emitter();
    this.time = 0;
    this.attract = false;
    this.timeLeft = config.timeLimit;
    this.pickup = null;
    this.pickupTimer = 4 + rng() * 5;
    this.flyTimer = 2 + rng() * 4;
    this.frog = null;
    this.respawn();
  }

  get baysFilled() { return this.bays.filter(b => b.filled).length; }

  respawn() {
    this.timeLeft = this.cfg.timeLimit;
    this.pickup = null;
    this.pickupTimer = 4 + this.rng() * 5;
    this.frog = {
      x: 6, y: START_ROW, dir: 'up',
      hopping: null, buffered: null,
      dead: false, deathCause: null, deathT: 0,
      scored: false, shield: false, invuln: 0,
      minY: START_ROW, ride: null, crossedRoad: false,
      idleT: 0
    };
  }

  // ---- input -------------------------------------------------------------
  hop(dirName) {
    const f = this.frog;
    if (!f || f.dead || f.scored || this.attract) return false;
    if (f.hopping) { f.buffered = dirName; return false; }
    const d = DIRS[dirName];
    if (!d) return false;
    const x1 = Math.max(0, Math.min(COLS - 1, Math.round(f.x) + d.dx));
    const y1 = f.y + d.dy;
    if (y1 < 0 || y1 >= 13) return false;
    if (x1 === Math.round(f.x) && d.dx !== 0 && (f.x < 0.2 || f.x > COLS - 1.2)) return false;
    f.dir = dirName;
    f.ride = null;
    f.hopping = { x0: f.x, y0: f.y, x1, y1, t: 0 };
    f.idleT = 0;
    this.events.emit('hop', { dir: dirName });
    return true;
  }

  // helpers ---------------------------------------------------------------
  laneAt(y) { return this.lanes[y]; }

  turtleState(item) {
    if (!item.dive) return 'up';
    const t = (this.time + item.dive.phase) % item.dive.period;
    const start = item.dive.period - item.dive.dur;
    if (t >= start) return 'down';
    if (t >= start - 0.9) return 'warning';
    return 'up';
  }

  supportAt(lane, x) {
    if (!lane || lane.kind !== 'river') return null;
    for (const item of lane.items) {
      if (item.type === 'turtles' && this.turtleState(item) === 'down') continue;
      if (x >= item.x - SUPPORT_TOL && x <= item.x + item.len + SUPPORT_TOL) return item;
    }
    return null;
  }

  vehicleHit(lane, x) {
    if (!lane || lane.kind !== 'road') return null;
    for (const item of lane.items) {
      if (item.x < x + FROG_HALF && item.x + item.len > x - FROG_HALF) return item;
    }
    return null;
  }

  die(cause) {
    const f = this.frog;
    if (f.dead || f.scored) return;
    if (cause === 'car' && f.invuln > 0) return;
    if (cause === 'car' && f.shield) {
      f.shield = false;
      f.invuln = 1.2;
      this.events.emit('shieldBreak', { x: f.x, y: f.y });
      return;
    }
    f.dead = true;
    f.deathCause = cause;
    f.deathT = 0;
    f.ride = null;
    f.hopping = null;
    this.events.emit('death', { cause, x: f.x, y: f.y });
  }

  land() {
    const f = this.frog;
    const h = f.hopping;
    f.hopping = null;
    f.x = h.x1; f.y = h.y1;
    const kind = rowKind(f.y);

    if (kind === 'goal') {
      const bay = this.bays.find(b => b.x === f.x && !b.filled);
      if (bay) {
        bay.filled = true;
        const hadFly = bay.fly > 0;
        bay.fly = 0;
        f.scored = true;
        this.events.emit('home', { bayX: bay.x, fly: hadFly, timeLeft: this.timeLeft });
      } else {
        this.die('hedge');
      }
    } else if (kind === 'river') {
      const item = this.supportAt(this.laneAt(f.y), f.x);
      if (item) f.ride = item;
      else this.die('water');
    } else if (kind === 'road') {
      if (this.vehicleHit(this.laneAt(f.y), f.x)) this.die('car');
    }

    if (!f.dead && !f.scored) {
      // forward progress scoring
      if (f.y < f.minY) {
        this.events.emit('progress', { rows: f.minY - f.y });
        f.minY = f.y;
      }
      // road-crossing milestone (median reached from below, once per life)
      if (f.y === MEDIAN_ROW && h.y0 > MEDIAN_ROW && !f.crossedRoad) {
        f.crossedRoad = true;
        this.events.emit('crossRoad', {});
      }
      // pickups on the median
      if (f.y === MEDIAN_ROW && this.pickup && Math.abs(f.x - this.pickup.x) < 0.5) {
        const p = this.pickup;
        this.pickup = null;
        if (p.type === 'star') f.shield = true;
        if (p.type === 'clock') this.timeLeft = Math.min(this.cfg.timeLimit, this.timeLeft + 8);
        this.events.emit('pickup', { type: p.type, x: p.x, y: MEDIAN_ROW });
      }
    }

    // buffered input → chain hops smoothly
    if (f.buffered && !f.dead && !f.scored) {
      const b = f.buffered; f.buffered = null;
      this.hop(b);
    } else {
      f.buffered = null;
    }
  }

  // ---- per-frame ----------------------------------------------------------
  update(dt) {
    this.time += dt;
    // conveyors always move (also in attract mode)
    for (const lane of this.lanes) {
      if (!lane.items) continue;
      const v = lane.dir * lane.speed * dt;
      for (const item of lane.items) {
        item.x += v;
        if (lane.dir > 0 && item.x > COLS + lane.margin) item.x -= lane.span;
        else if (lane.dir < 0 && item.x + item.len < -lane.margin) item.x += lane.span;
      }
    }
    if (this.attract) return;

    const f = this.frog;
    f.idleT += dt;
    if (f.invuln > 0) f.invuln = Math.max(0, f.invuln - dt);

    if (f.dead) { f.deathT += dt; return; }
    if (f.scored) return;

    // bonus fly ttl
    for (const b of this.bays) if (b.fly > 0) b.fly = Math.max(0, b.fly - dt);
    this.flyTimer -= dt;
    if (this.flyTimer <= 0) {
      const empty = this.bays.filter(b => !b.filled && b.fly <= 0);
      if (empty.length && this.rng() < 0.75) {
        empty[Math.floor(this.rng() * empty.length)].fly = 6;
      }
      this.flyTimer = 4 + this.rng() * 5;
    }

    // pickup spawn / ttl
    if (this.pickup) {
      this.pickup.ttl -= dt;
      if (this.pickup.ttl <= 0) this.pickup = null;
    } else {
      this.pickupTimer -= dt;
      if (this.pickupTimer <= 0) {
        this.pickup = {
          type: this.rng() < 0.5 ? 'star' : 'clock',
          x: 1 + Math.floor(this.rng() * 11), ttl: 6
        };
        this.pickupTimer = 7 + this.rng() * 6;
      }
    }

    // timer
    const prev = Math.ceil(this.timeLeft);
    this.timeLeft -= dt;
    const now = Math.ceil(this.timeLeft);
    if (now !== prev && now <= 5 && now > 0) this.events.emit('tick', { left: now });
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.die('time'); return; }

    // hop animation
    if (f.hopping) {
      f.hopping.t += dt / HOP_TIME;
      if (f.hopping.t >= 1) this.land();
      return;
    }

    // idle on river: drift with platform, re-check support & edges
    if (rowKind(f.y) === 'river') {
      const lane = this.laneAt(f.y);
      f.x += lane.dir * lane.speed * dt;
      if (f.x < -0.45 || f.x > COLS - 0.55) { this.die('edge'); return; }
      let ok = f.ride && this.supportAt(lane, f.x) === f.ride;
      if (f.ride && f.ride.type === 'turtles' && this.turtleState(f.ride) === 'down') ok = false;
      if (!ok) {
        const item = this.supportAt(lane, f.x);
        if (item) f.ride = item;
        else { this.die('water'); return; }
      }
    } else if (rowKind(f.y) === 'road') {
      if (this.vehicleHit(this.laneAt(f.y), f.x)) this.die('car');
    }
  }
}
