// Validates pixel-map data (no DOM needed — MAPS is pure data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, mix } from '../src/render/sprites.js';

test('all sprite maps are rectangular', () => {
  for (const [name, map] of Object.entries(MAPS)) {
    const w = map[0].length;
    assert.ok(w > 0, name);
    map.forEach((row, i) => {
      assert.equal(row.length, w, `${name} row ${i} has length ${row.length}, expected ${w}`);
    });
  }
});

test('color mixing stays in gamut and is deterministic', () => {
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(mix('#ff0000', '#0000ff', 0), '#ff0000');
  assert.equal(mix('#ff0000', '#0000ff', 1), '#0000ff');
});
