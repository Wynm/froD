import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/game/world.js';
import { Game } from '../src/game/game.js';
import { generateLevel } from '../src/game/level.js';
import { wildlifeConfig, WILDLIFE } from '../src/game/wildlife.js';
import { HOP_TIME, SCORE, SCORED_TIME } from '../src/game/constants.js';
import { mulberry32 } from '../src/core/rng.js';

const DT = 1 / 60;
function world(level = 4, seed = 42) {
  return new World(generateLevel(level, seed), mulberry32(seed));
}
function step(w, seconds) { for (let t = 0; t < seconds; t += DT) w.update(DT); }
function finishHop(w) { step(w, HOP_TIME + DT * 2); }
function quiet(w) {
  // Isolate the mechanic under test from traffic and scheduled spawns.
  for (const lane of w.lanes) if (lane.items) { lane.items = []; lane.speed = 0; }
  w.wildlife.snakes = [];
  w.wildlife.cfg = { ...w.wildlife.cfg, escort: true, heron: false, snakes: 0 };
  w.wildlife.escortTimer = 999;
  w.wildlife.heronTimer = 999;
  w.frog.y = 6; w.frog.x = 6;
}
function addLog(w, y = 3, x = 3, len = 5) {
  const log = { type: 'log', len, x, dive: null };
  w.lanes[y].items = [log];
  w.lanes[y].speed = 0;
  return log;
}

test('wildlife unlocks gradually and config is deterministic', () => {
  const a = generateLevel(4, 123), b = generateLevel(4, 123);
  assert.deepEqual(a.wildlife, b.wildlife);
  assert.equal(generateLevel(1, 1).wildlife.snakes, 0);
  assert.equal(generateLevel(1, 1).wildlife.heron, false);
  assert.equal(generateLevel(3, 1).wildlife.snakes, 1);
  assert.equal(generateLevel(4, 1).wildlife.heron, true);
  assert.equal(generateLevel(8, 1).wildlife.snakes, 2);
});

test('snakes inhabit long logs on distinct rows and stay within their habitat', () => {
  const w = world(8);
  assert.equal(w.wildlife.snakes.length, 2);
  assert.notEqual(w.wildlife.snakes[0].laneY, w.wildlife.snakes[1].laneY);
  for (const s of w.wildlife.snakes) {
    assert.ok(s.log.len >= 3);
    step(w, 2);
    assert.ok(s.offset >= 0.45 - 1e-9 && s.offset <= s.log.len - 0.45 + 1e-9);
    assert.ok(Math.abs(s.x - (s.log.x + s.offset)) < 1e-9);
  }
});

test('snake follows its log across a conveyor wrap', () => {
  const w = world(3); quiet(w);
  const log = addLog(w, 3, 16, 5);
  w.lanes[3].speed = 2; w.lanes[3].dir = 1;
  const s = { laneY: 3, log, offset: 2, x: 18, dir: 1, mode: 'patrol', phase: 0 };
  w.wildlife.snakes = [s];
  step(w, 0.5);
  assert.ok(log.x < 0, 'log wrapped');
  assert.ok(Math.abs(s.x - (log.x + s.offset)) < 1e-9);
});

test('snake chases a frog on the same log and emits one alert', () => {
  const w = world(); quiet(w);
  const log = addLog(w);
  w.wildlife.snakes = [{ laneY: 3, log, offset: 1, x: 4, dir: 1, mode: 'patrol', phase: 0 }];
  w.frog.y = 3; w.frog.x = 7; w.frog.ride = log;
  let alerts = 0; w.events.on('snakeAlert', () => alerts++);
  step(w, 0.3);
  assert.equal(w.wildlife.snakes[0].mode, 'chase');
  assert.ok(w.wildlife.snakes[0].x > 4);
  assert.equal(alerts, 1);
});

test('snake contact kills, adjacent rows are safe, shield does not block', () => {
  const w = world(); quiet(w);
  const log = addLog(w);
  w.wildlife.snakes = [{ laneY: 3, log, offset: 2, x: 5, dir: 1, mode: 'patrol', phase: 0 }];
  w.frog.y = 2; w.frog.x = 5; w.frog.ride = addLog(w, 2);
  w.update(DT); assert.ok(!w.frog.dead);
  w.frog.y = 3; w.frog.ride = log; w.frog.shield = true;
  w.update(DT);
  assert.equal(w.frog.deathCause, 'snake');
});

test('escort rides a log, is collected once, and follows the frog', () => {
  const w = world(); quiet(w);
  const log = addLog(w);
  w.lanes[3].speed = 1; w.lanes[3].dir = 1;
  w.wildlife.lady = { laneY: 3, log, offset: 2, x: 5, ttl: 10 };
  w.frog.y = 4; w.frog.x = 5;
  let pickups = 0; w.events.on('escortPickup', () => pickups++);
  w.hop('up'); finishHop(w);
  assert.ok(w.frog.escort);
  assert.equal(w.wildlife.lady, null);
  assert.equal(pickups, 1);
  const before = w.frog.x;
  step(w, 0.4);
  assert.ok(w.frog.x > before);
  assert.ok(w.frog.escort);
  assert.equal(pickups, 1);
});

test('delivering an escort marks the bay and adds the combo-scaled bonus', () => {
  const g = new Game(); g.start();
  const w = g.world;
  w.frog.escort = true; w.frog.x = 6; w.frog.y = 1; w.frog.hopping = null;
  w.timeLeft = 30;
  let home;
  g.events.on('home', d => { home = d; });
  w.hop('up');
  for (let t = 0; t < HOP_TIME + DT * 2; t += DT) g.update(DT);
  assert.ok(home.escort);
  assert.equal(home.escortBonus, SCORE.ESCORT);
  assert.equal(home.bonus, SCORE.HOME + 30 * SCORE.TIME_BONUS + SCORE.ESCORT);
  assert.equal(w.bays[2].escort, true);
  assert.equal(w.frog.escort, false);
});

test('death drops an escort; respawn never restores it', () => {
  const w = world(); quiet(w);
  w.frog.escort = true;
  let lost = 0; w.events.on('escortLost', () => lost++);
  w.die('water');
  assert.equal(lost, 1);
  assert.equal(w.frog.escort, false);
  w.respawn();
  assert.equal(w.frog.escort, false);
});

test('heron warns before striking and locks the target cell', () => {
  const w = world(); quiet(w);
  w.wildlife.cfg.heron = true;
  w.wildlife.heronTimer = 0;
  w.frog.idleT = 1;
  const events = [];
  w.events.on('*', (d, n) => { if (n.startsWith('heron') || n === 'death') events.push(n); });
  w.update(DT);
  assert.equal(w.wildlife.heron.phase, 'warning');
  assert.equal(events[0], 'heronWarn');
  assert.ok(!w.frog.dead);
  const target = w.wildlife.heron.x;
  w.frog.x = target + 2; // hop away from the locked shadow
  step(w, WILDLIFE.HERON_WARNING + DT);
  assert.ok(!w.frog.dead);
  assert.ok(events.includes('heronMiss'));
  assert.ok(!events.includes('death'));
});

test('standing in the heron shadow is fatal even with a car shield', () => {
  const w = world(); quiet(w);
  w.wildlife.cfg.heron = true;
  w.wildlife.heronTimer = 0;
  w.frog.idleT = 1; w.frog.shield = true;
  w.update(DT);
  step(w, WILDLIFE.HERON_WARNING + DT * 2);
  assert.equal(w.frog.deathCause, 'heron');
  assert.ok(w.frog.shield, 'car shield is not consumed by a bird');
});

test('heron respects sanctuary rows and respawn clears old warnings', () => {
  const w = world(); quiet(w);
  w.wildlife.cfg.heron = true;
  w.wildlife.heronTimer = 0;
  w.frog.y = 12; w.frog.idleT = 5;
  step(w, 1);
  assert.equal(w.wildlife.heron, null);
  w.frog.y = 6;
  w.update(DT);
  assert.ok(w.wildlife.heron);
  w.respawn();
  assert.equal(w.wildlife.heron, null);
  assert.ok(w.wildlife.heronTimer >= 3);
});

test('pause freezes wildlife schedules and animations', () => {
  const g = new Game(); g.start();
  g.level = 4; g.loadLevel();
  g.world.wildlife.heronTimer = 0.1;
  g.pause();
  const before = g.world.wildlife.heronTimer;
  for (let t = 0; t < 2; t += DT) g.update(DT);
  assert.equal(g.world.wildlife.heronTimer, before);
});

test('daily wildlife and runtime pickups are reproducible', () => {
  const a = new Game(), b = new Game();
  a.start('daily'); b.start('daily');
  a.level = b.level = 4;
  a.loadLevel(); b.loadLevel();
  assert.deepEqual(a.world.cfg.wildlife, b.world.cfg.wildlife);
  assert.equal(a.world.pickupTimer, b.world.pickupTimer);
  assert.equal(a.world.flyTimer, b.world.flyTimer);
  for (let t = 0; t < 10; t += DT) { a.update(DT); b.update(DT); }
  assert.deepEqual(a.world.wildlife.lady, b.world.wildlife.lady);
  assert.deepEqual(a.world.wildlife.snakes, b.world.wildlife.snakes);
});
