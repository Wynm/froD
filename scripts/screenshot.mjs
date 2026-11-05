// Renders real gameplay frames to PNG using the software canvas — no browser.
// The autopilot plays for a few seconds so each shot is an organic moment.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, scaleUp } from './lib/canvas2d.mjs';
import { encodePNG } from './lib/png.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs');
mkdirSync(OUT, { recursive: true });

// Minimal document so sprites.js can bake offscreen canvases.
globalThis.document = { createElement: (tag) => (tag === 'canvas' ? new Canvas(16, 16) : {}) };

const { generateLevel } = await import('../src/game/level.js');
const { World } = await import('../src/game/world.js');
const { decide } = await import('../src/game/autopilot.js');
const { mulberry32 } = await import('../src/core/rng.js');
const { Renderer } = await import('../src/render/renderer.js');
const { FX } = await import('../src/core/particles.js');

const DT = 1 / 60;
function capture(level, seed, seconds, file) {
  const world = new World(generateLevel(level, seed), mulberry32(seed));
  const canvas = new Canvas(208, 208);
  const renderer = new Renderer(canvas);
  renderer.setTheme(world.cfg.theme);
  const fx = new FX();
  let t = 0;
  for (let s = 0; s < seconds; s += DT) {
    const dir = decide(world);
    if (dir) world.hop(dir);
    world.update(DT);
    if (world.frog.dead && world.frog.deathT > 1.1) world.respawn();
    else if (world.frog.scored) world.respawn();
    t += DT;
  }
  // a celebratory sparkle near the frog for visual interest
  fx.sparkle(world.frog.x * 16 + 8, world.frog.y * 16 + 8);
  fx.update(0.05);
  renderer.draw(world, {}, fx, t);
  const big = scaleUp(canvas, 3);
  writeFileSync(join(OUT, file), encodePNG(big.width, big.height, big.data));
  console.log('wrote', file, `(${world.cfg.theme}, level ${level})`);
}

capture(1, 42, 7.3, 'screenshot-day.png');
capture(2, 7, 6.1, 'screenshot-dusk.png');
capture(3, 99, 8.2, 'screenshot-night.png');


// Composed wildlife showcase: real renderer + real entities, arranged so the
// three new actors are all visible in one documentation frame.
function captureWildlife() {
  const world = new World(generateLevel(4, 7), mulberry32(7));
  const canvas = new Canvas(208, 208);
  const renderer = new Renderer(canvas);
  renderer.setTheme(world.cfg.theme);
  const fx = new FX();
  for (let t = 0; t < 4; t += DT) {
    const dir = decide(world); if (dir) world.hop(dir);
    world.update(DT);
    if (world.frog.dead || world.frog.scored) world.respawn();
  }
  const visibleLog = (y) => world.lanes[y].items.find(i => i.type === 'log' && i.len >= 3 && i.x > 0 && i.x + i.len < 13);
  const habitats = [2, 4].map(y => ({ y, log: visibleLog(y) })).filter(h => h.log);
  world.wildlife.snakes = habitats.map((h, i) => ({
    laneY: h.y, log: h.log, offset: h.log.len * 0.5,
    x: h.log.x + h.log.len * 0.5, dir: i ? -1 : 1, mode: 'patrol', phase: i
  }));
  const ladyHabitat = [5, 1, 3].map(y => ({ y, log: visibleLog(y) })).find(h => h.log && !habitats.some(s => s.y === h.y));
  if (ladyHabitat) world.wildlife.lady = { laneY: ladyHabitat.y, log: ladyHabitat.log, offset: ladyHabitat.log.len * 0.5, x: ladyHabitat.log.x + ladyHabitat.log.len * 0.5, ttl: 10 };
  world.frog.x = 6; world.frog.y = 6; world.frog.ride = null; world.frog.hopping = null;
  world.wildlife.heron = { x: 6, y: 6, t: 0.8, phase: 'warning' };
  fx.sparkle(6 * 16 + 8, 6 * 16 + 8); fx.update(0.05);
  renderer.draw(world, {}, fx, 4.2);
  const big = scaleUp(canvas, 3);
  writeFileSync(join(OUT, 'screenshot-wildlife.png'), encodePNG(big.width, big.height, big.data));
  console.log('wrote screenshot-wildlife.png (wildlife showcase)');
}
captureWildlife();
