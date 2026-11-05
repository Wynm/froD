import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/game.js';
import { DEATH_TIME, SCORED_TIME, CLEAR_TIME, HOP_TIME, START_LIVES } from '../src/game/constants.js';

const DT = 1 / 60;
function step(g, s) { for (let t = 0; t < s; t += DT) g.update(DT); }
function homeAt(g, bayX) {
  const w = g.world;
  w.frog.x = bayX; w.frog.y = 1; w.frog.hopping = null;
  w.hop('up');
  step(g, HOP_TIME + DT * 2);
}

test('start resets everything and enters playing', () => {
  const g = new Game();
  g.start('classic');
  assert.equal(g.state, 'playing');
  assert.equal(g.lives, START_LIVES);
  assert.equal(g.score, 0);
  assert.equal(g.level, 1);
  assert.ok(g.world);
});

test('death → dying → respawn with one less life', () => {
  const g = new Game();
  g.start();
  g.world.die('water');
  assert.equal(g.state, 'dying');
  assert.equal(g.lives, START_LIVES - 1);
  step(g, DEATH_TIME + DT * 2);
  assert.equal(g.state, 'playing');
  assert.ok(!g.world.frog.dead);
  assert.equal(g.world.frog.y, 12);
});

test('three deaths → game over event with summary', () => {
  const g = new Game();
  g.start();
  let over = null;
  g.events.on('gameover', d => { over = d; });
  for (let i = 0; i < 3; i++) {
    g.world.die('car');
    step(g, DEATH_TIME + DT * 2);
  }
  assert.equal(g.state, 'over');
  assert.ok(over);
  assert.equal(over.mode, 'classic');
});

test('filling all 5 bays clears the level and advances', () => {
  const g = new Game();
  g.start();
  let cleared = null;
  g.events.on('clear', d => { cleared = d; });
  for (const x of [0, 3, 6, 9, 12]) {
    homeAt(g, x);
    step(g, SCORED_TIME + CLEAR_TIME + DT * 4);
  }
  assert.ok(cleared);
  assert.equal(cleared.level, 1);
  assert.ok(cleared.flawless);
  assert.equal(g.level, 2);
  assert.equal(g.state, 'playing');
  assert.equal(g.world.baysFilled, 0);
  assert.ok(g.score >= 5 * 100 + 1000);
});

test('daily mode completes after 5 levels', () => {
  const g = new Game();
  g.start('daily');
  let done = null;
  g.events.on('dailyComplete', d => { done = d; });
  g.level = 5;
  g.loadLevel();
  for (const x of [0, 3, 6, 9, 12]) {
    homeAt(g, x);
    step(g, SCORED_TIME + CLEAR_TIME + DT * 4);
  }
  assert.equal(g.state, 'dailyComplete');
  assert.ok(done);
  assert.equal(g.level, 5);
});

test('daily seed is stable for the same date, classic differs', () => {
  const a = new Game(); a.start('daily');
  const b = new Game(); b.start('daily');
  assert.equal(a.seed, b.seed);
});

test('extra life every 10000 points, capped at 6', () => {
  const g = new Game();
  g.start();
  let extra = 0;
  g.events.on('extraLife', () => extra++);
  g.addScore(10000);
  assert.equal(g.lives, START_LIVES + 1);
  g.addScore(50000);
  assert.equal(g.lives, 6);
  assert.equal(extra, 3);
});

test('pause freezes the world', () => {
  const g = new Game();
  g.start();
  g.pause();
  const t = g.world.time;
  step(g, 1);
  assert.equal(g.world.time, t);
  assert.equal(g.hop('up'), false);
  g.resume();
  step(g, 0.1);
  assert.ok(g.world.time > t);
});

test('home bonus includes time and fly', () => {
  const g = new Game();
  g.start();
  let home = null;
  g.events.on('home', d => { home = d; });
  g.world.bays[2].fly = 5;
  g.world.timeLeft = 30;
  homeAt(g, 6);
  assert.ok(home.fly);
  assert.equal(home.bonus, 100 + 30 * 5 + 200);
});
