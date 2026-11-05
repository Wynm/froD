// Integration smoke test: boots the real main.js against a minimal DOM shim,
// then drives the loop, starts a game, hops, pauses and resumes. Catches
// wiring/runtime errors that pure-logic tests and syntax checks miss.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// ---- tiny DOM shim -----------------------------------------------------------
class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, force) {
    const want = force === undefined ? !this.set.has(c) : force;
    want ? this.set.add(c) : this.set.delete(c);
    return want;
  }
  contains(c) { return this.set.has(c); }
}
class El {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.style = {};
    this.dataset = {};
    this.attrs = {};
    this.listeners = {};
    this.classList = new ClassList(this);
    this._text = '';
    this.parentNode = null;
  }
  get className() { return [...this.classList.set].join(' '); }
  set className(v) { this.classList.set = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get innerHTML() { return ''; }
  set innerHTML(v) { if (v === '') this.children = []; }
  get firstChild() { return this.children[0] || null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  dispatch(t, ev = {}) { (this.listeners[t] || []).forEach(fn => fn(ev)); }
  querySelectorAll() { return []; }
  setPointerCapture() {}
  focus() {}
}
function makeCanvas() {
  const c = new El('canvas');
  c.width = 208; c.height = 208;
  const noop = () => {};
  const ctx = new Proxy({}, {
    get: (t, p) => (p === 'canvas' ? c : noop),
    set: () => true
  });
  c.getContext = () => ctx;
  c.toDataURL = () => 'data:image/png;base64,TEST';
  return c;
}

const byId = new Map();
function getEl(id) {
  if (!byId.has(id)) byId.set(id, id === 'game' ? makeCanvas() : new El('div'));
  return byId.get(id);
}
const winListeners = {};
let rafCb = null;

globalThis.window = globalThis;
globalThis.document = {
  getElementById: getEl,
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : new El(tag)),
  documentElement: new El('html'),
  body: new El('body'),
  hidden: false,
  addEventListener: (t, fn) => { (winListeners[t] ||= []).push(fn); },
  querySelectorAll: () => []
};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'ar' }, configurable: true });
Object.defineProperty(globalThis, 'location', { value: { protocol: 'http:', hostname: 'localhost' }, configurable: true });
globalThis.matchMedia = () => ({ matches: false });
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.setInterval = () => 0;
globalThis.setTimeout = () => 0;
globalThis.confirm = () => true;
globalThis.window.addEventListener = (t, fn) => { (winListeners[t] ||= []).push(fn); };
globalThis.window.matchMedia = globalThis.matchMedia;

function frames(n, start) {
  let t = start;
  for (let i = 0; i < n; i++) { t += 16.7; const cb = rafCb; cb(t); }
  return t;
}
function findButton(root, text) {
  const stack = [root];
  while (stack.length) {
    const el = stack.pop();
    if (el.tagName === 'BUTTON' && el.textContent === text) return el;
    stack.push(...el.children);
  }
  return null;
}

test('app boots, renders menu, starts a game, hops, pauses and resumes', async () => {
  await import('../src/main.js');
  assert.ok(rafCb, 'loop scheduled');

  // menu renders with a Play button (Arabic default)
  let t = frames(10, 1000);
  const screensRoot = getEl('screens');
  const play = findButton(screensRoot, '▶ العب');
  assert.ok(play, 'menu play button exists');

  // start classic
  play.onclick();
  t = frames(5, t);
  assert.ok(!getEl('hud').classList.contains('hidden'), 'HUD visible in game');

  const keydown = winListeners['keydown'];
  assert.ok(keydown && keydown.length);

  // pause immediately (frog is safe on the start row), verify, resume
  keydown.forEach(fn => fn({ code: 'KeyP', preventDefault() {}, target: { tagName: 'BODY' } }));
  t = frames(5, t);
  const resume = findButton(screensRoot, '▶ متابعة');
  assert.ok(resume, 'pause screen shows resume');
  resume.onclick();
  t = frames(5, t);

  // hop with keyboard and let the world simulate
  const ev = { code: 'ArrowUp', repeat: false, preventDefault() {}, target: { tagName: 'BODY' } };
  keydown.forEach(fn => fn(ev));
  t = frames(120, t);

  // language switch re-renders without crashing
  const { setLang } = await import('../src/core/i18n.js');
  setLang('en');
  t = frames(10, t);
  assert.ok(true);
});
