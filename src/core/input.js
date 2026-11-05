// Unified input: keyboard (WASD/arrows), swipe + tap on canvas, on-screen d-pad.
// Emits: dir, pause, mute, confirm, gesture (for audio unlock).
import { Emitter } from './events.js';

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right'
};

export class Input {
  constructor(canvas, dpad) {
    this.events = new Emitter();
    this.canvas = canvas;
    this.dpad = dpad;
    this.held = new Set();
    this._swipe = null;
    this._padPrev = {};
    this._padA = false;
    this._padStart = false;
  }

  // Poll the first connected gamepad: d-pad / left stick to hop, A to hop
  // forward, Start to pause. Edge-triggered, with hold-to-repeat via `held`.
  pollGamepad() {
    const pads = navigator.getGamepads?.();
    if (!pads) return;
    let pad = null;
    for (const p of pads) { if (p && p.connected) { pad = p; break; } }
    if (!pad) return;
    this.events.emit('gesture', {});
    const pressed = (i) => !!pad.buttons[i]?.pressed;
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const dirs = {
      up: pressed(12) || ay < -0.5,
      down: pressed(13) || ay > 0.5,
      left: pressed(14) || ax < -0.5,
      right: pressed(15) || ax > 0.5
    };
    for (const dir of ['up', 'down', 'left', 'right']) {
      const now = dirs[dir], was = this._padPrev[dir];
      if (now && !was) { this.held.delete(dir); this.held.add(dir); this.events.emit('dir', dir); }
      if (!now && was) this.held.delete(dir);
      this._padPrev[dir] = now;
    }
    const a = pressed(0);
    if (a && !this._padA) this.events.emit('confirm', {});
    this._padA = a;
    const start = pressed(9);
    if (start && !this._padStart) this.events.emit('pause', {});
    this._padStart = start;
  }

  heldDir() {
    // most recently pressed wins
    const arr = [...this.held];
    return arr.length ? arr[arr.length - 1] : null;
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.events.emit('gesture', {});
      const dir = KEYMAP[e.code];
      if (dir) {
        e.preventDefault();
        if (!e.repeat) {
          this.held.delete(dir); this.held.add(dir);
          this.events.emit('dir', dir);
        }
        return;
      }
      if (e.code === 'KeyP' || e.code === 'Escape') { e.preventDefault(); this.events.emit('pause', {}); }
      if (e.code === 'KeyM') this.events.emit('mute', {});
      if (e.code === 'Enter' || e.code === 'Space') {
        if (e.code === 'Space') e.preventDefault();
        this.events.emit('confirm', {});
      }
    });
    window.addEventListener('keyup', (e) => {
      const dir = KEYMAP[e.code];
      if (dir) this.held.delete(dir);
    });
    window.addEventListener('blur', () => this.held.clear());

    // swipe / tap on the canvas
    const THRESH = 24;
    this.canvas.addEventListener('pointerdown', (e) => {
      this.events.emit('gesture', {});
      this._swipe = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      this.canvas.setPointerCapture?.(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this._swipe) return;
      const dx = e.clientX - this._swipe.x;
      const dy = e.clientY - this._swipe.y;
      if (Math.hypot(dx, dy) >= THRESH) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        this.events.emit('dir', dir);
        this._swipe = { x: e.clientX, y: e.clientY, t: performance.now(), moved: true };
      }
    });
    const end = (e) => {
      if (!this._swipe) return;
      if (!this._swipe.moved && performance.now() - this._swipe.t < 300) {
        this.events.emit('dir', 'up'); // quick tap = hop forward
      }
      this._swipe = null;
    };
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', () => { this._swipe = null; });

    // d-pad buttons (hold to repeat via held set)
    this.dpad?.querySelectorAll('[data-dir]').forEach(btn => {
      const dir = btn.dataset.dir;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.events.emit('gesture', {});
        this.held.delete(dir); this.held.add(dir);
        this.events.emit('dir', dir);
        btn.setPointerCapture?.(e.pointerId);
      });
      const release = () => this.held.delete(dir);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', e => e.preventDefault());
    });
  }
}
