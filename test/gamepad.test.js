import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/core/input.js';

function pad(overrides = {}) {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false }));
  for (const [i, v] of Object.entries(overrides.buttons || {})) buttons[i] = { pressed: v };
  return { connected: true, buttons, axes: overrides.axes || [0, 0] };
}
function setPads(p) {
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [p] }, configurable: true });
}

test('gamepad d-pad is edge-triggered and supports hold/release', () => {
  const input = new Input({}, {});
  const dirs = [];
  input.events.on('dir', d => dirs.push(d));

  setPads(pad({ buttons: { 12: true } })); // up pressed
  input.pollGamepad();
  assert.deepEqual(dirs, ['up']);
  assert.ok(input.held.has('up'));

  input.pollGamepad(); // still held → no repeat emit
  assert.deepEqual(dirs, ['up']);

  setPads(pad()); // released
  input.pollGamepad();
  assert.equal(input.held.size, 0);
});

test('gamepad stick, A and Start map correctly', () => {
  const input = new Input({}, {});
  const events = [];
  input.events.on('dir', d => events.push('dir:' + d));
  input.events.on('confirm', () => events.push('confirm'));
  input.events.on('pause', () => events.push('pause'));

  setPads(pad({ axes: [0.9, 0], buttons: { 0: true, 9: true } }));
  input.pollGamepad();
  assert.ok(events.includes('dir:right'));
  assert.ok(events.includes('confirm'));
  assert.ok(events.includes('pause'));
});

test('no gamepad API is harmless', () => {
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  const input = new Input({}, {});
  assert.doesNotThrow(() => input.pollGamepad());
});
