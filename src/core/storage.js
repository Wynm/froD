// Safe localStorage wrapper with in-memory fallback (private mode / Node tests).
const KEY = 'frod:v1';
let memory = null;

function backend() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('__frod_test__', '1');
      localStorage.removeItem('__frod_test__');
      return localStorage;
    }
  } catch { /* fall through */ }
  return null;
}

export function defaultStore() {
  return {
    settings: {
      lang: null,            // resolved at boot from navigator
      sfx: 0.7,
      music: 0.4,
      musicOn: true,
      touch: 'auto',         // auto | on | off
      reduceMotion: false,
      crt: false,
      lastName: ''
    },
    scores: { classic: [], daily: [] },   // {name, score, level, date}
    achievements: {},                     // id -> ISO timestamp
    stats: {
      games: 0, hops: 0, homes: 0, flies: 0, clears: 0,
      bestScore: 0, bestLevel: 0, turtleTime: 0, roadCrossings: 0,
      dailiesCompleted: 0, flawlessLevels: 0, pickups: 0, escorts: 0, playTime: 0,
      deaths: { car: 0, water: 0, hedge: 0, time: 0, edge: 0, snake: 0, heron: 0 }
    }
  };
}

function merge(base, extra) {
  if (extra == null || typeof extra !== 'object') return base;
  for (const k of Object.keys(extra)) {
    const b = base[k], e = extra[k];
    if (b && e && typeof b === 'object' && typeof e === 'object' &&
        !Array.isArray(b) && !Array.isArray(e)) {
      merge(b, e);
    } else {
      base[k] = e;
    }
  }
  return base;
}

export function loadStore() {
  const def = defaultStore();
  const b = backend();
  try {
    const raw = b ? b.getItem(KEY) : memory;
    if (!raw) return def;
    return merge(def, JSON.parse(raw));
  } catch {
    return def;
  }
}

export function saveStore(store) {
  const raw = JSON.stringify(store);
  const b = backend();
  try {
    if (b) b.setItem(KEY, raw); else memory = raw;
  } catch { memory = raw; }
}

export function resetStore() {
  const b = backend();
  try { if (b) b.removeItem(KEY); } catch { /* ignore */ }
  memory = null;
  return defaultStore();
}
