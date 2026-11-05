import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_KEYS, hasKey, t, setLang } from '../src/core/i18n.js';

test('ar and en have identical key coverage', () => {
  for (const k of ALL_KEYS) {
    assert.ok(hasKey('en', k), `en missing ${k}`);
    assert.ok(hasKey('ar', k), `ar missing ${k}`);
  }
});

test('interpolation works in both languages', () => {
  setLang('ar');
  assert.ok(t('clear.banner', { n: 3 }).includes('3'));
  setLang('en');
  assert.equal(t('clear.banner', { n: 3 }), '🎉 Level 3 complete!');
});

test('unknown keys fall back gracefully', () => {
  assert.equal(t('nope.nope'), 'nope.nope');
});
