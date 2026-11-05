import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Meta, ACHIEVEMENTS } from '../src/game/meta.js';
import { resetStore } from '../src/core/storage.js';

test('high scores: qualification, ordering, top-10 cap', () => {
  resetStore();
  const m = new Meta();
  assert.ok(m.qualifies('classic', 100));
  assert.ok(!m.qualifies('classic', 0));
  for (let i = 1; i <= 12; i++) {
    m.addScoreEntry('classic', { name: 'P' + i, score: i * 100, level: 1, date: '2026-11-05' });
  }
  const top = m.topScores('classic');
  assert.equal(top.length, 10);
  assert.equal(top[0].score, 1200);
  assert.equal(top[9].score, 300);
  assert.ok(!m.qualifies('classic', 250));
  assert.ok(m.qualifies('classic', 350));
  assert.equal(m.bestScore('classic'), 1200);
});

test('daily scores are filtered by date', () => {
  resetStore();
  const m = new Meta();
  m.addScoreEntry('daily', { name: 'A', score: 500, level: 5, date: '2026-11-04' });
  m.addScoreEntry('daily', { name: 'B', score: 900, level: 5, date: '2026-11-05' });
  assert.equal(m.topScores('daily', '2026-11-05').length, 1);
  assert.equal(m.bestScore('daily', '2026-11-05'), 900);
  assert.equal(m.bestScore('daily', '2026-11-06'), 0);
});

test('achievements unlock once and are persisted', () => {
  resetStore();
  const m = new Meta();
  assert.deepEqual(m.evaluate(), []);
  m.bump('homes');
  const unlocked = m.evaluate();
  assert.ok(unlocked.includes('first_home'));
  assert.deepEqual(m.evaluate(), []);
  const m2 = new Meta(); // reload from memory backend
  assert.ok(m2.store.achievements.first_home);
});

test('stats: deaths by cause and game end records', () => {
  resetStore();
  const m = new Meta();
  m.recordDeath('car'); m.recordDeath('car'); m.recordDeath('water');
  m.recordGameEnd({ score: 4200, level: 3 });
  assert.equal(m.stats.deaths.car, 2);
  assert.equal(m.stats.deaths.water, 1);
  assert.equal(m.stats.games, 1);
  assert.equal(m.stats.bestScore, 4200);
  assert.equal(m.stats.bestLevel, 3);
});

test('every achievement has icon, cond and goal', () => {
  for (const a of ACHIEVEMENTS) {
    assert.equal(typeof a.cond, 'function');
    assert.equal(typeof a.goal, 'function');
    assert.ok(a.icon);
  }
});
