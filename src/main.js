// froD — boot & wiring. Connects the pure-logic engine to DOM, canvas, audio,
// input, persistence and the fixed-timestep loop.
import { resetStore } from './core/storage.js';
import { Game } from './game/game.js';
import { World } from './game/world.js';
import { generateLevel } from './game/level.js';
import { Meta } from './game/meta.js';
import { W, H, CELL } from './game/constants.js';
import { todayKey } from './core/rng.js';
import { setLang, getLang, detectLang, t, applyDOM, onLangChange } from './core/i18n.js';
import { AudioEngine } from './core/audio.js';
import { Input } from './core/input.js';
import { FX } from './core/particles.js';
import { bakeSprites } from './render/sprites.js';
import { Renderer } from './render/renderer.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';

const meta = new Meta();
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const fx = new FX();
const audio = new AudioEngine();
const game = new Game();
const sprites = bakeSprites('day');
const frogURL = sprites.frog.up.toDataURL();
const hud = new HUD(frogURL);
const input = new Input(canvas, document.getElementById('dpad'));
input.attach();

let attract = makeAttract();
function makeAttract() {
  const w = new World(generateLevel(1, (Math.random() * 1e9) >>> 0));
  w.attract = true;
  return w;
}

// ---- settings ---------------------------------------------------------------
function applySettings() {
  const s = meta.settings;
  audio.configure({ sfx: s.sfx, music: s.music, musicOn: s.musicOn });
  fx.reduceMotion = s.reduceMotion;
  document.body.classList.toggle('reduce-motion', s.reduceMotion);
  document.getElementById('stage').classList.toggle('crt', s.crt);
  updateTouchpad();
}
function touchEnabled() {
  const s = meta.settings.touch;
  if (s === 'on') return true;
  if (s === 'off') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}
function updateTouchpad() {
  const inGame = ['playing', 'dying', 'scored', 'clear'].includes(game.state);
  document.getElementById('touchpad').hidden = !(touchEnabled() && inGame);
}

// ---- language ---------------------------------------------------------------
setLang(meta.settings.lang || detectLang());
applyDOM();
onLangChange(() => {
  applyDOM();
  if (screens.current) screens.show(screens.current, screens.lastData || {});
});

// ---- screens & actions --------------------------------------------------------
let pendingEntry = null;
const screens = new Screens(document.getElementById('screens'), meta, {
  ui: () => { audio.unlock(); audio.play('ui'); },
  play: (mode) => { audio.unlock(); game.start(mode); },
  resume: () => game.resume(),
  restart: () => game.start(game.mode),
  quit: () => { game.toMenu(); attract = makeAttract(); showMenu(); },
  settings: (partial) => { Object.assign(meta.settings, partial); meta.save(); applySettings(); },
  setLang: (l) => { meta.settings.lang = l; meta.save(); setLang(l); },
  resetData: () => {
    const lang = getLang();
    meta.store = resetStore();
    meta.settings.lang = lang;
    meta.save();
    applySettings();
  },
  clearScores: () => meta.clearScores(),
  saveName: (name) => {
    if (!pendingEntry) return;
    meta.addScoreEntry(pendingEntry.mode, { ...pendingEntry, name });
    pendingEntry = null;
  },
  share: async (d, btn) => {
    const text = `froD 🐸 ${t('mode.' + d.mode)} ${d.date || todayKey()} — ${d.score.toLocaleString('en-US')} pts, level ${d.level}`;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = t('over.copied');
    } catch {
      screens.toast(text, { ms: 4000 });
    }
  }
}, frogURL);
screens.lastData = {};

function showMenu() {
  hud.setVisible(false);
  screens.show('menu');
  updateTouchpad();
}

// ---- achievements ---------------------------------------------------------------
let achAccum = 0;
function checkAchievements() {
  for (const id of meta.evaluate()) {
    audio.play('achievement');
    screens.toast(t('toast.achievement', { name: t('ach.' + id) }), { gold: true, ms: 3000 });
  }
}

// ---- game events → audio / FX / HUD / meta -----------------------------------------
const px = (c) => c * CELL + 8;
game.events.on('start', () => {
  screens.hideAll();
  hud.setVisible(true);
  hud.setScore(0);
  hud.setBest(meta.bestScore(game.mode));
  hud.setLevel(1);
  hud.setLives(game.lives);
  renderer.setTheme(game.world.cfg.theme);
  audio.setMood(game.world.cfg.theme);
  audio.setPaused(false);
  audio.play('croak');
  updateTouchpad();
});
game.events.on('level', ({ level, theme }) => {
  hud.setLevel(level);
  renderer.setTheme(theme);
  audio.setMood(theme);
  meta.stats.bestLevel = Math.max(meta.stats.bestLevel, level);
});
game.events.on('score', ({ score }) => hud.setScore(score));
game.events.on('lives', ({ lives }) => hud.setLives(lives));
game.events.on('hop', () => {
  audio.play('hop');
  meta.bump('hops');
  const f = game.world.frog;
  if (f) fx.dust(px(f.x), px(f.y));
});
game.events.on('death', ({ cause, x, y }) => {
  meta.recordDeath(cause);
  if (cause === 'car') { audio.play('hit'); fx.hit(px(x), px(y)); }
  else if (cause === 'water') { audio.play('splash'); fx.splash(px(x), px(y)); }
  else if (cause === 'edge') { audio.play('splash'); fx.splash(px(x), px(y)); }
  else if (cause === 'hedge') { audio.play('bonk'); fx.hit(px(x), px(y)); }
  else { audio.play('timeDeath'); }
  checkAchievements();
});
game.events.on('home', ({ bayX, fly }) => {
  audio.play('home');
  if (fly) { audio.play('fly'); meta.bump('flies'); screens.toast(t('toast.fly')); }
  meta.bump('homes');
  fx.confetti(px(bayX), px(0));
  checkAchievements();
});
game.events.on('clear', ({ level, flawless }) => {
  audio.play('clear');
  meta.bump('clears');
  if (flawless) meta.bump('flawlessLevels');
  for (let i = 0; i < 5; i++) fx.confetti(px(i * 3), px(0) + i * 4);
  screens.banner(t('clear.banner', { n: level }), flawless ? t('clear.flawless') : null, 2300);
  checkAchievements();
});
game.events.on('pickup', ({ type, x, y }) => {
  meta.bump('pickups');
  audio.play(type === 'star' ? 'shield' : 'pickup');
  fx.sparkle(px(x), px(y));
  screens.toast(t(type === 'star' ? 'toast.shield' : 'toast.clock'));
  checkAchievements();
});
game.events.on('shieldBreak', ({ x, y }) => {
  audio.play('shieldBreak');
  fx.sparkle(px(x), px(y));
  fx.shake(2);
  screens.toast(t('toast.shieldBreak'));
});
game.events.on('extraLife', () => { audio.play('extraLife'); screens.toast(t('toast.extraLife'), { gold: true }); });
game.events.on('tick', () => audio.play('tick'));
game.events.on('crossRoad', () => { meta.bump('roadCrossings'); });
game.events.on('pause', () => { audio.setPaused(true); screens.show('pause'); updateTouchpad(); });
game.events.on('resume', () => { audio.setPaused(false); screens.hideAll(); updateTouchpad(); });

function finishRun(d, daily) {
  meta.recordGameEnd(d);
  if (daily) meta.bump('dailiesCompleted');
  const best = meta.bestScore(d.mode, d.date);
  const newBest = d.score > best;
  const qualifies = meta.qualifies(d.mode, d.score, d.date);
  pendingEntry = qualifies ? { mode: d.mode, score: d.score, level: d.level, date: d.date || todayKey() } : null;
  checkAchievements();
  meta.save();
  hud.setVisible(false);
  const data = { ...d, best: Math.max(best, d.score), newBest, qualifies };
  screens.lastData = data;
  screens.show(daily ? 'daily' : 'over', data);
  updateTouchpad();
}
game.events.on('gameover', (d) => { audio.play('gameover'); finishRun(d, false); });
game.events.on('dailyComplete', (d) => { audio.play('clear'); finishRun({ ...d, level: game.level, mode: 'daily' }, true); });

// ---- input events -------------------------------------------------------------------
input.events.on('gesture', () => audio.unlock());
input.events.on('dir', (dir) => game.hop(dir));
input.events.on('mute', () => {
  const muted = audio.toggleMute();
  screens.toast(muted ? '🔇' : '🔊');
});
input.events.on('pause', () => {
  if (game.paused) game.resume();
  else if (game.state === 'playing') game.pause();
  else if (screens.current && screens.current !== 'menu') screens.show('menu');
});
input.events.on('confirm', () => {
  if (game.state === 'playing' && !game.paused) game.hop('up');
  else if (game.paused) game.resume();
  else if (screens.current === 'menu') { audio.unlock(); game.start('classic'); }
});

document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause(); });

// ---- main loop ------------------------------------------------------------------------
const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function tick(dt) {
  if (game.state === 'menu') {
    attract.update(dt);
  } else if (game.state === 'over' || game.state === 'dailyComplete') {
    // freeze the final frame behind the result screen
  } else {
    if (game.state === 'playing' && !game.paused) {
      const held = input.heldDir();
      if (held && game.world.frog && !game.world.frog.hopping && !game.world.frog.dead) game.hop(held);
      meta.stats.playTime += dt;
      const ride = game.world.frog?.ride;
      if (ride && ride.type === 'turtles' && !game.world.frog.dead) meta.stats.turtleTime += dt;
      achAccum += dt;
      if (achAccum > 4) { achAccum = 0; checkAchievements(); }
    }
    game.update(dt);
  }
  fx.update(dt);
}

function render(tSec) {
  const world = game.state === 'menu' ? attract : game.world;
  if (world) renderer.draw(world, game, fx, tSec);
  if (game.world && ['playing', 'dying', 'scored', 'clear'].includes(game.state)) {
    hud.setTime(game.world.timeLeft / game.world.cfg.timeLimit);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 8) { tick(STEP); acc -= STEP; steps++; }
  if (steps === 8) acc = 0;
  render(now / 1000);
}

// ---- boot -------------------------------------------------------------------------------
applySettings();
showMenu();
requestAnimationFrame(frame);

// Periodic persistence of stats (play time etc.)
setInterval(() => meta.save(), 15000);
window.addEventListener('beforeunload', () => meta.save());

// Service worker (offline support)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/public/sw.js').catch(() => {});
  });
}
