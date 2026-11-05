// HUD: score / best / level / lives / time bar.
import { t } from '../core/i18n.js';

export class HUD {
  constructor(frogURL) {
    this.root = document.getElementById('hud');
    this.score = document.getElementById('hud-score');
    this.best = document.getElementById('hud-best');
    this.level = document.getElementById('hud-level');
    this.lives = document.getElementById('hud-lives');
    this.timefill = document.getElementById('timefill');
    this.frogURL = frogURL;
  }
  setVisible(v) {
    this.root.classList.toggle('hidden', !v);
    this.root.setAttribute('aria-hidden', String(!v));
  }
  setScore(n) { this.score.textContent = n.toLocaleString('en-US'); }
  setBest(n) { this.best.textContent = n.toLocaleString('en-US'); }
  setLevel(n) { this.level.textContent = n; }
  setLives(n) {
    this.lives.innerHTML = '';
    for (let i = 0; i < Math.max(0, n); i++) {
      const img = document.createElement('img');
      img.src = this.frogURL;
      img.alt = 'life';
      this.lives.appendChild(img);
    }
  }
  setTime(frac) {
    const f = Math.max(0, Math.min(1, frac));
    this.timefill.style.width = (f * 100) + '%';
    this.timefill.classList.toggle('warn', f <= 0.5 && f > 0.25);
    this.timefill.classList.toggle('danger', f <= 0.25);
  }
}
