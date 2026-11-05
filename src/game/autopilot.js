// A heuristic frog bot. Used for the menu attract-mode demo and as a
// solvability check in tests. Pure logic — predicts landing safety by
// extrapolating conveyor positions over the hop duration.
import { COLS, HOP_TIME, FROG_HALF, SUPPORT_TOL, DIRS, rowKind } from './constants.js';

function futureX(lane, item, dt) {
  let x = item.x + lane.dir * lane.speed * dt;
  if (lane.dir > 0 && x > COLS + lane.margin) x -= lane.span;
  else if (lane.dir < 0 && x + item.len < -lane.margin) x += lane.span;
  return x;
}

function turtleUpAt(world, item, dt) {
  if (!item.dive) return true;
  const t = (world.time + dt + item.dive.phase) % item.dive.period;
  return t < item.dive.period - item.dive.dur;
}

// Is the cell reached by (dx,dy) safe to land on `dt` seconds from now?
function safeLanding(world, dx, dy, dt) {
  const f = world.frog;
  const tx = Math.round(f.x) + dx;
  const ty = f.y + dy;
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= 13) return false;
  const kind = rowKind(ty);
  if (kind === 'safe') return true;
  if (kind === 'goal') return world.bays.some(b => b.x === tx && !b.filled);
  const lane = world.lanes[ty];
  if (!lane || !lane.items) return true;
  if (kind === 'road') {
    for (const item of lane.items) {
      const x = futureX(lane, item, dt);
      if (x < tx + FROG_HALF + 0.15 && x + item.len > tx - FROG_HALF - 0.15) return false;
    }
    return true;
  }
  // river: need a platform under the landing cell
  for (const item of lane.items) {
    if (item.type === 'turtles' && !turtleUpAt(world, item, dt)) continue;
    const x = futureX(lane, item, dt);
    if (tx >= x - SUPPORT_TOL && tx <= x + item.len + SUPPORT_TOL) return true;
  }
  return false;
}

// Immediate threats that mean "don't just stand here".
function inDanger(world) {
  const f = world.frog;
  const kind = rowKind(f.y);
  if (kind === 'road') {
    const lane = world.lanes[f.y];
    for (const item of lane.items) {
      // will it overlap me within 0.3s?
      for (const dt of [0, 0.15, 0.3]) {
        const x = futureX(lane, item, dt);
        if (x < f.x + FROG_HALF + 0.1 && x + item.len > f.x - FROG_HALF - 0.1) return true;
      }
    }
  } else if (kind === 'river') {
    if (f.x < 0.9 || f.x > COLS - 1.9) return true; // drifting toward edge
    if (f.ride && f.ride.type === 'turtles' && !turtleUpAt(world, f.ride, 0.5)) return true;
  }
  return false;
}

function bayDirection(world) {
  const f = world.frog;
  const open = world.bays.filter(b => !b.filled);
  if (!open.length) return null;
  let best = open[0], bd = 1e9;
  for (const b of open) {
    const d = Math.abs(b.x - f.x);
    if (d < bd) { bd = d; best = b; }
  }
  if (best.x > f.x + 0.4) return 'right';
  if (best.x < f.x - 0.4) return 'left';
  return null;
}

export function decide(world) {
  const f = world.frog;
  if (!f || f.dead || f.scored || f.hopping) return null;

  const danger = inDanger(world);
  const toward = bayDirection(world);
  const side = toward === 'left' ? ['left', 'right'] : ['right', 'left'];

  if (danger) {
    for (const dir of ['up', ...side, 'down']) {
      const d = DIRS[dir];
      if (safeLanding(world, d.dx, d.dy, HOP_TIME)) return dir;
    }
    return 'up'; // desperate
  }

  // Prefer forward progress when the landing is safe.
  if (safeLanding(world, 0, -1, HOP_TIME + 0.03)) return 'up';

  // On the goal-approach row, line up with an open bay.
  if (f.y === 1 && toward && safeLanding(world, DIRS[toward].dx, 0, HOP_TIME)) return toward;

  // Waited too long? Reposition sideways to find a gap / alignment.
  if (f.idleT > 0.45) {
    for (const dir of side) {
      const d = DIRS[dir];
      if (safeLanding(world, d.dx, 0, HOP_TIME)) return dir;
    }
  }
  return null; // wait for the world to line up
}
