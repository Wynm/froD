import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, mulberry32, rngFrom, todayKey } from '../src/core/rng.js';

test('hashSeed is deterministic and well-distributed', () => {
  assert.equal(hashSeed('frod'), hashSeed('frod'));
  assert.notEqual(hashSeed('frod'), hashSeed('froD'));
});

test('mulberry32 produces [0,1) and repeats for same seed', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('rngFrom string seeds work', () => {
  const a = rngFrom('daily-2026-11-05'), b = rngFrom('daily-2026-11-05');
  assert.equal(a(), b());
});

test('todayKey formats UTC date', () => {
  assert.equal(todayKey(new Date('2026-11-05T23:59:59Z')), '2026-11-05');
});
