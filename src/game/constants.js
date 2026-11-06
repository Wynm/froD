// Shared constants for the froD world. Pure module — safe for Node tests.
export const COLS = 13;
export const ROWS = 13;
export const CELL = 16;              // art pixels per cell
export const W = COLS * CELL;        // 208
export const H = ROWS * CELL;        // 208

export const GOAL_ROW = 0;
export const RIVER_ROWS = [1, 2, 3, 4, 5];
export const MEDIAN_ROW = 6;
export const ROAD_ROWS = [7, 8, 9, 10, 11];
export const START_ROW = 12;
export const BAYS_X = [0, 3, 6, 9, 12];

export const HOP_TIME = 0.13;        // seconds per hop
export const FROG_HALF = 0.34;       // collision half-width in cells
export const SUPPORT_TOL = 0.18;     // platform edge tolerance in cells
export const DEATH_TIME = 1.15;      // death animation length
export const SCORED_TIME = 0.7;      // pause after reaching home
export const CLEAR_TIME = 2.4;       // level-clear celebration
export const RESPAWN_INVULN = 1.2;

export const START_LIVES = 3;
export const MAX_LIVES = 6;
export const EXTRA_LIFE_EVERY = 10000;
export const DAILY_LEVELS = 5;

export const SCORE = {
  HOP: 10,          // per new forward row
  HOME: 100,
  TIME_BONUS: 5,    // per second remaining
  FLY: 200,
  CLEAR: 1000,
  PICKUP: 50,
  ESCORT: 200       // delivering a companion safely home
};

export const THEMES = ['day', 'dusk', 'night', 'dawn'];

export const DIRS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 }
};

export function rowKind(y) {
  if (y === GOAL_ROW) return 'goal';
  if (y === MEDIAN_ROW || y === START_ROW) return 'safe';
  if (y >= 1 && y <= 5) return 'river';
  return 'road';
}

export function timeLimitFor(level) {
  return Math.max(35, 60 - (level - 1) * 2);
}
