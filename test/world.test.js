import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/game/world.js';
import { generateLevel } from '../src/game/level.js';
import { HOP_TIME } from '../src/game/constants.js';

const DT = 1 / 60;
function makeWorld(level = 1, seed = 42) {
  const w = new World(generateLevel(level, seed), () => 0.5);
  return w;
}
function step(w, seconds) {
  for (let t = 0; t < seconds; t += DT) w.update(DT);
}
function finishHop(w) { step(w, HOP_TIME + DT * 2); }
function clearLane(w, y) { w.lanes[y].items = []; w.lanes[y].speed = 0; }

test('hop moves frog one cell and emits hop + progress', () => {
  const w = makeWorld();
  clearLane(w, 11);
  const events = [];
  w.events.on('*', (d, n) => events.push(n));
  assert.ok(w.hop('up'));
  finishHop(w);
  assert.equal(w.frog.y, 11);
  assert.equal(w.frog.x, 6);
  assert.ok(events.includes('hop'));
  assert.ok(events.includes('progress'));
});

test('progress only scores new forward rows', () => {
  const w = makeWorld();
  clearLane(w, 11);
  let rows = 0;
  w.events.on('progress', d => { rows += d.rows; });
  w.hop('up'); finishHop(w);
  w.hop('down'); finishHop(w);
  w.hop('up'); finishHop(w);
  assert.equal(rows, 1);
});

test('input is buffered during a hop', () => {
  const w = makeWorld();
  clearLane(w, 11); clearLane(w, 10);
  w.hop('up');
  w.update(DT); // mid-hop
  w.hop('up');  // buffered
  step(w, HOP_TIME * 2 + DT * 4);
  assert.equal(w.frog.y, 10);
});

test('car collision kills; shield absorbs once; invuln blocks', () => {
  const w = makeWorld();
  clearLane(w, 7);
  w.lanes[7].items = [{ type: 'car', len: 1, x: 4.8, variant: 0 }];
  w.frog.x = 5; w.frog.y = 7;
  w.frog.shield = true;
  let broke = false, died = false;
  w.events.on('shieldBreak', () => { broke = true; });
  w.events.on('death', () => { died = true; });
  w.update(DT);
  assert.ok(broke); assert.ok(!died); assert.ok(!w.frog.dead);
  w.frog.invuln = 0;
  w.update(DT);
  assert.ok(died);
  assert.equal(w.frog.deathCause, 'car');
});

test('landing on water without support drowns', () => {
  const w = makeWorld();
  clearLane(w, 5);
  w.frog.x = 6; w.frog.y = 6;
  w.hop('up'); finishHop(w);
  assert.ok(w.frog.dead);
  assert.equal(w.frog.deathCause, 'water');
});

test('frog rides a log and drifts with it', () => {
  const w = makeWorld();
  clearLane(w, 3);
  const log = { type: 'log', len: 3, x: 4, dive: null };
  w.lanes[3].items = [log];
  w.lanes[3].speed = 1; w.lanes[3].dir = 1;
  w.frog.x = 5; w.frog.y = 4;
  w.hop('up'); finishHop(w);
  assert.equal(w.frog.ride, log);
  const x0 = w.frog.x;
  step(w, 0.5);
  assert.ok(Math.abs(w.frog.x - (x0 + 0.5)) < 0.05, `drifted to ${w.frog.x}`);
  assert.ok(!w.frog.dead);
});

test('diving turtles drown the frog', () => {
  const w = makeWorld();
  clearLane(w, 3);
  const turtles = { type: 'turtles', len: 3, x: 4, dive: { period: 4, dur: 1.5, phase: 0 } };
  w.lanes[3].items = [turtles];
  w.frog.x = 5; w.frog.y = 4;
  w.hop('up'); finishHop(w);
  assert.equal(w.frog.ride, turtles);
  w.time = 2.6; // inside dive window [2.5, 4)
  w.update(DT);
  assert.ok(w.frog.dead);
  assert.equal(w.frog.deathCause, 'water');
});

test('carried off the edge = edge death', () => {
  const w = makeWorld();
  clearLane(w, 2);
  const log = { type: 'log', len: 4, x: 10, dive: null };
  w.lanes[2].items = [log];
  w.lanes[2].speed = 3; w.lanes[2].dir = 1;
  w.frog.x = 12.3; w.frog.y = 2; w.frog.ride = log;
  step(w, 0.3);
  assert.ok(w.frog.dead);
  assert.equal(w.frog.deathCause, 'edge');
});

test('reaching an empty bay scores home; hedge and filled bays kill', () => {
  const w = makeWorld();
  let home = null;
  w.events.on('home', d => { home = d; });
  w.frog.x = 6; w.frog.y = 1;
  w.hop('up'); finishHop(w);
  assert.ok(home); assert.equal(home.bayX, 6);
  assert.ok(w.frog.scored);
  assert.equal(w.baysFilled, 1);
  // filled bay → death
  w.respawn();
  w.frog.x = 6; w.frog.y = 1;
  w.hop('up'); finishHop(w);
  assert.equal(w.frog.deathCause, 'hedge');
  // hedge column → death
  w.respawn();
  w.frog.x = 1; w.frog.y = 1;
  w.hop('up'); finishHop(w);
  assert.equal(w.frog.deathCause, 'hedge');
});

test('fly in bay is consumed on home', () => {
  const w = makeWorld();
  w.bays[2].fly = 5; // bay x=6
  let home = null;
  w.events.on('home', d => { home = d; });
  w.frog.x = 6; w.frog.y = 1;
  w.hop('up'); finishHop(w);
  assert.ok(home.fly);
  assert.equal(w.bays[2].fly, 0);
});

test('timer runs out → time death', () => {
  const w = makeWorld();
  w.timeLeft = 0.01;
  w.update(0.02);
  assert.ok(w.frog.dead);
  assert.equal(w.frog.deathCause, 'time');
});

test('clock pickup adds time (capped), star grants shield', () => {
  const w = makeWorld();
  clearLane(w, 7);
  w.timeLeft = 20;
  w.pickup = { type: 'clock', x: 6, ttl: 5 };
  w.frog.x = 6; w.frog.y = 7;
  w.hop('up'); finishHop(w);
  // timer keeps ticking during the hop, so allow a small drift below 28
  assert.ok(w.timeLeft > 27.5 && w.timeLeft <= 28, `timeLeft=${w.timeLeft}`);
  assert.equal(w.pickup, null);
  w.pickup = { type: 'star', x: 6, ttl: 5 };
  w.hop('down'); finishHop(w);
  w.hop('up'); finishHop(w);
  assert.ok(w.frog.shield);
});

test('attract mode moves traffic but never kills or scores', () => {
  const w = makeWorld();
  w.attract = true;
  const x0 = w.lanes[7].items[0].x;
  step(w, 1);
  assert.notEqual(w.lanes[7].items[0].x, x0);
  assert.ok(!w.frog.dead);
});

test('long simulation stays sane (no NaN, items bounded)', () => {
  const w = makeWorld(9, 777);
  w.attract = true;
  step(w, 120);
  for (const lane of w.lanes) {
    if (!lane.items) continue;
    for (const it of lane.items) {
      assert.ok(Number.isFinite(it.x));
      assert.ok(it.x >= -lane.margin - 8 && it.x <= 13 + lane.margin + 8);
    }
  }
});
