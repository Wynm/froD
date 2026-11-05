// Solvability check: a heuristic bot must be able to make progress and reach
// homes — evidence that generated levels are actually beatable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/game/world.js';
import { generateLevel } from '../src/game/level.js';
import { decide } from '../src/game/autopilot.js';
import { mulberry32 } from '../src/core/rng.js';

const DT = 1 / 60;
function runBot(level, seed, seconds) {
  const w = new World(generateLevel(level, seed), mulberry32(seed));
  let homes = 0, deaths = 0, maxY = 12;
  w.events.on('home', () => homes++);
  w.events.on('death', () => deaths++);
  for (let t = 0; t < seconds; t += DT) {
    const dir = decide(w);
    if (dir) w.hop(dir);
    w.update(DT);
    maxY = Math.min(maxY, w.frog.y);
    if (w.frog.dead && w.frog.deathT > 1.1) w.respawn();
    else if (w.frog.scored) w.respawn();
    if (w.baysFilled >= 5) break;
  }
  return { homes, deaths, maxY, filled: w.baysFilled };
}

test('bot reaches at least one home on level 1 across seeds', () => {
  let totalHomes = 0;
  for (const seed of [1, 7, 42, 99, 2026]) {
    const r = runBot(1, seed, 90);
    totalHomes += r.homes;
    assert.ok(r.maxY <= 6, `seed ${seed}: bot never crossed the road (maxY=${r.maxY})`);
  }
  assert.ok(totalHomes >= 3, `bot only reached ${totalHomes} homes across 5 seeds`);
});

test('bot can fully clear level 1 within a generous time budget', () => {
  let cleared = 0;
  for (const seed of [1, 7, 42]) {
    const r = runBot(1, seed, 240);
    if (r.filled >= 5) cleared++;
  }
  assert.ok(cleared >= 1, 'bot should fully clear at least one level-1 layout');
});

test('decide never throws and only returns valid directions', () => {
  const w = new World(generateLevel(3, 5), mulberry32(5));
  const valid = new Set(['up', 'down', 'left', 'right', null]);
  for (let t = 0; t < 30; t += DT) {
    const d = decide(w);
    assert.ok(valid.has(d));
    if (d) w.hop(d);
    w.update(DT);
    if (w.frog.dead) w.respawn();
  }
});
