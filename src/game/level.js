// Procedural level generation. Deterministic for a given (level, seed).
// Pure module — no DOM. Lanes are looping "conveyors" of items.
import { COLS, THEMES, timeLimitFor, BAYS_X } from './constants.js';
import { mulberry32, pick } from '../core/rng.js';
import { wildlifeConfig } from './wildlife.js';

const MARGIN = 4;                       // off-screen runway on each side
const VEHICLE_LENS = { car: 1, taxi: 1, racer: 1, truck: 2, bus: 2 };

function buildConveyor(rng, makeItem, gapFor, spanMin) {
  const items = [];
  let cursor = -MARGIN;
  const target = -MARGIN + spanMin;
  let guard = 0, lastGap = 0;
  while (cursor < target && guard++ < 64) {
    const item = makeItem(rng);
    item.x = cursor;
    items.push(item);
    lastGap = gapFor(rng, item);
    cursor += item.len + lastGap;
  }
  // Exact pattern length (last item end + margin) → seamless wrap.
  const span = Math.max(cursor - lastGap + MARGIN, spanMin);
  return { items, span };
}

function roadLane(rng, y, i, level, dirSeed, fastLane) {
  const speedMul = Math.min(2.2, 1 + 0.09 * (level - 1));
  const fast = i === fastLane;
  const dir = (i + dirSeed) % 2 === 0 ? 1 : -1;
  const speed = (1.4 + rng() * 1.1 + (fast ? 1.7 : 0)) * speedMul;
  const pool = fast ? ['racer']
    : level < 3 ? ['car', 'car', 'taxi', 'truck']
      : ['car', 'car', 'taxi', 'truck', 'bus'];
  const gapMin = 1.7 + speed * 0.45;      // always crossable
  const gapVar = Math.max(1.0, 2.6 - (level - 1) * 0.12);
  const gapFor = (r) => gapMin + r() * gapVar;
  const { items, span } = buildConveyor(rng, (r) => {
    const type = pick(r, pool);
    return { type, len: VEHICLE_LENS[type], variant: Math.floor(r() * 3) };
  }, gapFor, COLS + 2 * MARGIN + 4);
  return { y, kind: 'road', dir, speed, span, margin: MARGIN, items, fast };
}

function riverLane(rng, y, j, level, dirSeed, turtleLane) {
  const riverMul = Math.min(1.8, 1 + 0.05 * (level - 1));
  const dir = (j + dirSeed) % 2 === 0 ? -1 : 1;
  const speed = (0.7 + rng() * 0.7) * riverMul;
  const turtles = j === turtleLane || rng() < 0.18;
  const logLens = level < 3 ? [3, 4, 4, 5] : level < 6 ? [2, 3, 3, 4] : [2, 2, 3, 3, 4];
  const gapMin = 1.1 + speed * 0.5;
  const gapFor = (r) => Math.min(3.2, gapMin + r() * 1.5);
  const { items, span } = buildConveyor(rng, (r) => {
    if (turtles) {
      const len = r() < 0.5 ? 2 : 3;
      const period = Math.max(4.5, 9.5 - level * 0.3) + r() * 2;
      return { type: 'turtles', len, dive: { period, dur: 1.5, phase: r() * period } };
    }
    return { type: 'log', len: pick(r, logLens), dive: null };
  }, gapFor, COLS + 2 * MARGIN + 5);
  return { y, kind: 'river', dir, speed, span, margin: MARGIN, items };
}

export function generateLevel(level, seed) {
  const rng = mulberry32((seed >>> 0) ^ Math.imul(level, 2654435761));
  const dirSeed = Math.floor(rng() * 2);
  const fastLane = Math.floor(rng() * 5);
  const turtleLane = Math.floor(rng() * 5);
  const wildlife = wildlifeConfig(level, rng);
  const lanes = [{ y: 0, kind: 'goal' }];
  for (let j = 0; j < 5; j++) lanes.push(riverLane(rng, j + 1, j, level, dirSeed, turtleLane));
  lanes.push({ y: 6, kind: 'safe' });
  for (let i = 0; i < 5; i++) lanes.push(roadLane(rng, i + 7, i, level, 1 - dirSeed, fastLane));
  lanes.push({ y: 12, kind: 'safe' });
  return {
    level,
    theme: THEMES[(level - 1) % THEMES.length],
    timeLimit: timeLimitFor(level),
    bays: BAYS_X.map(x => ({ x, filled: false, fly: 0, escort: false })),
    wildlife,
    lanes
  };
}
