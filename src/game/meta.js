// Meta layer: stats, achievements, high scores. DOM-free (storage falls back
// to memory in Node), so it is unit-testable.
import { loadStore, saveStore } from '../core/storage.js';
import { todayKey } from '../core/rng.js';

export const ACHIEVEMENTS = [
  { id: 'hop_100', icon: '🐾', cond: s => s.hops >= 100, goal: s => [s.hops, 100] },
  { id: 'hop_1000', icon: '🦵', cond: s => s.hops >= 1000, goal: s => [s.hops, 1000] },
  { id: 'first_home', icon: '🏠', cond: s => s.homes >= 1, goal: s => [s.homes, 1] },
  { id: 'fly_5', icon: '🪰', cond: s => s.flies >= 5, goal: s => [s.flies, 5] },
  { id: 'clear_1', icon: '🎉', cond: s => s.clears >= 1, goal: s => [s.clears, 1] },
  { id: 'level_5', icon: '🖐️', cond: s => s.bestLevel >= 5, goal: s => [s.bestLevel, 5] },
  { id: 'level_10', icon: '🔟', cond: s => s.bestLevel >= 10, goal: s => [s.bestLevel, 10] },
  { id: 'score_10k', icon: '💯', cond: s => s.bestScore >= 10000, goal: s => [s.bestScore, 10000] },
  { id: 'score_25k', icon: '👑', cond: s => s.bestScore >= 25000, goal: s => [s.bestScore, 25000] },
  { id: 'turtle_30', icon: '🐢', cond: s => s.turtleTime >= 30, goal: s => [Math.floor(s.turtleTime), 30] },
  { id: 'daily_done', icon: '📅', cond: s => s.dailiesCompleted >= 1, goal: s => [s.dailiesCompleted, 1] },
  { id: 'flawless', icon: '✨', cond: s => s.flawlessLevels >= 1, goal: s => [s.flawlessLevels, 1] },
  { id: 'road_50', icon: '🛣️', cond: s => s.roadCrossings >= 50, goal: s => [s.roadCrossings, 50] },
  { id: 'pickup_10', icon: '🎁', cond: s => s.pickups >= 10, goal: s => [s.pickups, 10] }
];

export class Meta {
  constructor() { this.store = loadStore(); }
  save() { saveStore(this.store); }
  get settings() { return this.store.settings; }
  get stats() { return this.store.stats; }

  bump(key, n = 1) { this.stats[key] = (this.stats[key] || 0) + n; }

  recordDeath(cause) {
    if (this.stats.deaths[cause] !== undefined) this.stats.deaths[cause]++;
  }

  recordGameEnd({ score, level }) {
    this.bump('games');
    this.stats.bestScore = Math.max(this.stats.bestScore, score);
    this.stats.bestLevel = Math.max(this.stats.bestLevel, level);
    this.save();
  }

  // Returns ids of newly unlocked achievements.
  evaluate() {
    const unlocked = [];
    for (const a of ACHIEVEMENTS) {
      if (!this.store.achievements[a.id] && a.cond(this.stats)) {
        this.store.achievements[a.id] = new Date().toISOString();
        unlocked.push(a.id);
      }
    }
    if (unlocked.length) this.save();
    return unlocked;
  }

  qualifies(mode, score, date = todayKey()) {
    if (score <= 0) return false;
    const list = this.topScores(mode, date);
    return list.length < 10 || score > list[list.length - 1].score;
  }

  topScores(mode, date = todayKey()) {
    const all = this.store.scores[mode] || [];
    const list = mode === 'daily' ? all.filter(e => e.date === date) : all;
    return [...list].sort((a, b) => b.score - a.score).slice(0, 10);
  }

  bestScore(mode, date = todayKey()) {
    return this.topScores(mode, date)[0]?.score || 0;
  }

  addScoreEntry(mode, entry) {
    const list = this.store.scores[mode];
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    if (mode === 'classic') this.store.scores[mode] = list.slice(0, 10);
    else {
      // keep today's top 10 + last 30 days of history
      const cutoff = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const today = todayKey();
      const kept = [];
      const perDay = new Map();
      for (const e of list) {
        if (e.date < cutoff) continue;
        const n = perDay.get(e.date) || 0;
        if (e.date === today && n >= 10) continue;
        perDay.set(e.date, n + 1);
        kept.push(e);
      }
      this.store.scores[mode] = kept;
    }
    this.settings.lastName = entry.name;
    this.save();
  }

  clearScores() {
    this.store.scores = { classic: [], daily: [] };
    this.save();
  }
}
