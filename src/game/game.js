// Game orchestrator: modes, score, lives, level flow, state machine.
// Pure logic. UI/audio/FX subscribe to `events`.
import {
  START_LIVES, MAX_LIVES, EXTRA_LIFE_EVERY, DAILY_LEVELS,
  DEATH_TIME, SCORED_TIME, CLEAR_TIME, SCORE
} from './constants.js';
import { generateLevel } from './level.js';
import { World } from './world.js';
import { Emitter } from '../core/events.js';
import { hashSeed, todayKey } from '../core/rng.js';

export class Game {
  constructor() {
    this.events = new Emitter();
    this.state = 'menu';       // menu | playing | dying | scored | clear | over | dailyComplete
    this.paused = false;
    this.mode = 'classic';
    this.world = null;
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.seed = 1;
    this.stateT = 0;
    this.nextExtra = EXTRA_LIFE_EVERY;
    this.deathsThisLevel = 0;
    this.lastCause = null;
    this.dailyDate = todayKey();
    this.combo = 0;          // consecutive homes without a death
  }

  start(mode = 'classic') {
    this.mode = mode;
    this.dailyDate = todayKey();
    this.seed = mode === 'daily'
      ? hashSeed('frod-daily-' + this.dailyDate)
      : (Math.random() * 0x7fffffff) >>> 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.nextExtra = EXTRA_LIFE_EVERY;
    this.deathsThisLevel = 0;
    this.combo = 0;
    this.paused = false;
    this.loadLevel();
    this.setState('playing');
    this.events.emit('start', { mode, seed: this.seed });
    this.events.emit('score', { score: 0 });
    this.events.emit('lives', { lives: this.lives });
  }

  loadLevel() {
    this.world = new World(generateLevel(this.level, this.seed));
    this.world.events.on('*', (data, name) => this.onWorld(name, data));
    this.events.emit('level', { level: this.level, theme: this.world.cfg.theme, mode: this.mode });
  }

  setState(s) { this.state = s; this.stateT = 0; this.events.emit('state', { state: s }); }

  toMenu() {
    this.paused = false;
    this.setState('menu');
  }

  pause() {
    if (this.state !== 'playing' || this.paused) return;
    this.paused = true;
    this.events.emit('pause', {});
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.events.emit('resume', {});
  }

  hop(dir) {
    if (this.state !== 'playing' || this.paused) return false;
    return this.world.hop(dir);
  }

  addScore(n) {
    if (n <= 0) return;
    this.score += n;
    while (this.score >= this.nextExtra) {
      this.nextExtra += EXTRA_LIFE_EVERY;
      if (this.lives < MAX_LIVES) {
        this.lives++;
        this.events.emit('lives', { lives: this.lives });
        this.events.emit('extraLife', {});
      }
    }
    this.events.emit('score', { score: this.score });
  }

  onWorld(name, data) {
    switch (name) {
      case 'death':
        this.deathsThisLevel++;
        this.lastCause = data.cause;
        if (this.combo > 0) { this.combo = 0; this.events.emit('combo', { mult: 1, combo: 0 }); }
        this.lives--;
        this.events.emit('lives', { lives: this.lives });
        this.events.emit('death', data);
        this.setState('dying');
        break;
      case 'home': {
        this.combo++;
        const mult = Math.min(5, this.combo);   // 1st home ×1, 2nd ×2, … capped ×5
        const base = SCORE.HOME + Math.ceil(data.timeLeft) * SCORE.TIME_BONUS + (data.fly ? SCORE.FLY : 0);
        const bonus = base * mult;
        this.addScore(bonus);
        this.events.emit('home', { ...data, bonus, mult });
        if (mult >= 2) this.events.emit('combo', { mult, combo: this.combo });
        if (this.world.baysFilled >= this.world.bays.length) {
          this.addScore(SCORE.CLEAR);
          this.events.emit('clear', { level: this.level, flawless: this.deathsThisLevel === 0 });
          this.setState('clear');
        } else {
          this.setState('scored');
        }
        break;
      }
      case 'progress':
        this.addScore(data.rows * SCORE.HOP);
        this.events.emit('progress', data);
        break;
      case 'pickup':
        this.addScore(SCORE.PICKUP);
        this.events.emit('pickup', data);
        break;
      default:
        this.events.emit(name, data);
    }
  }

  update(dt) {
    if (this.paused || !this.world) return;
    if (this.state === 'menu' || this.state === 'over' || this.state === 'dailyComplete') return;
    this.stateT += dt;
    this.world.update(dt);

    if (this.state === 'dying' && this.stateT >= DEATH_TIME) {
      if (this.lives <= 0) {
        this.setState('over');
        this.events.emit('gameover', {
          score: this.score, level: this.level, mode: this.mode,
          cause: this.lastCause, date: this.dailyDate
        });
      } else {
        this.world.respawn();
        this.setState('playing');
      }
    } else if (this.state === 'scored' && this.stateT >= SCORED_TIME) {
      this.world.respawn();
      this.setState('playing');
    } else if (this.state === 'clear' && this.stateT >= CLEAR_TIME) {
      if (this.mode === 'daily' && this.level >= DAILY_LEVELS) {
        this.setState('dailyComplete');
        this.events.emit('dailyComplete', { score: this.score, date: this.dailyDate });
      } else {
        this.level++;
        this.deathsThisLevel = 0;
        this.loadLevel();
        this.setState('playing');
      }
    }
  }
}
