import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel } from '../src/game/level.js';
import { COLS, rowKind } from '../src/game/constants.js';

test('levels are deterministic for (level, seed)', () => {
  const a = generateLevel(3, 12345);
  const b = generateLevel(3, 12345);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = generateLevel(3, 999);
  assert.notEqual(JSON.stringify(a), JSON.stringify(c));
});

test('level structure: 13 rows with correct kinds and 5 bays', () => {
  const lv = generateLevel(1, 7);
  assert.equal(lv.lanes.length, 13);
  for (const lane of lv.lanes) assert.equal(lane.kind, rowKind(lane.y));
  assert.equal(lv.bays.length, 5);
  assert.deepEqual(lv.bays.map(b => b.x), [0, 3, 6, 9, 12]);
});

test('road gaps are always crossable and items start in pattern range', () => {
  for (let seed = 1; seed <= 25; seed++) {
    for (const level of [1, 4, 9, 15]) {
      const lv = generateLevel(level, seed);
      for (const lane of lv.lanes.filter(l => l.kind === 'road')) {
        assert.ok(lane.span >= COLS + 2 * lane.margin);
        const sorted = [...lane.items].sort((a, b) => a.x - b.x);
        for (let i = 0; i < sorted.length; i++) {
          const it = sorted[i];
          assert.ok(it.x >= -lane.margin - 1e-9);
          assert.ok(it.x + it.len <= lane.span - lane.margin + 1e-9);
          if (i > 0) {
            const gap = it.x - (sorted[i - 1].x + sorted[i - 1].len);
            assert.ok(gap >= 1.7 + lane.speed * 0.45 - 1e-9,
              `gap ${gap} too small for speed ${lane.speed}`);
          }
        }
      }
    }
  }
});

test('river gaps stay hop-able (<= 3.2 cells)', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const lv = generateLevel(5, seed);
    for (const lane of lv.lanes.filter(l => l.kind === 'river')) {
      const sorted = [...lane.items].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].len);
        assert.ok(gap <= 3.2 + 1e-9, `river gap ${gap} too wide`);
        assert.ok(gap >= 1.0, `river gap ${gap} negative-ish`);
      }
    }
  }
});

test('difficulty scales: higher levels are faster on average', () => {
  const avg = (level) => {
    let sum = 0, n = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const lane of generateLevel(level, seed).lanes) {
        if (lane.kind === 'road') { sum += lane.speed; n++; }
      }
    }
    return sum / n;
  };
  assert.ok(avg(8) > avg(1) * 1.3);
});

test('time limit shrinks with level but never below 35', () => {
  assert.equal(generateLevel(1, 1).timeLimit, 60);
  assert.equal(generateLevel(5, 1).timeLimit, 52);
  assert.equal(generateLevel(50, 1).timeLimit, 35);
});

test('themes cycle day → dusk → night → dawn', () => {
  assert.equal(generateLevel(1, 1).theme, 'day');
  assert.equal(generateLevel(2, 1).theme, 'dusk');
  assert.equal(generateLevel(3, 1).theme, 'night');
  assert.equal(generateLevel(4, 1).theme, 'dawn');
  assert.equal(generateLevel(5, 1).theme, 'day');
});
