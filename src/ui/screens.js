// All overlay screens: menu, how-to, scores, achievements, stats, settings,
// pause, game over, daily complete. Built with plain DOM + i18n.
import { t, getLang, setLang, applyDOM } from '../core/i18n.js';
import { ACHIEVEMENTS } from '../game/meta.js';
import { todayKey } from '../core/rng.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class Screens {
  constructor(root, meta, actions, frogURL) {
    this.root = root;
    this.meta = meta;
    this.actions = actions;
    this.frogURL = frogURL;
    this.current = null;
    this.scoresTab = 'classic';
    this.pending = null; // pending leaderboard entry
  }

  hideAll() {
    this.root.innerHTML = '';
    this.current = null;
  }

  show(name, data = {}) {
    this.root.innerHTML = '';
    this.current = name;
    const screen = el('div', 'screen');
    const panel = el('div', 'panel');
    screen.appendChild(panel);
    this['build_' + name]?.(panel, data);
    this.root.appendChild(screen);
    return screen;
  }

  toast(text, { gold = false, ms = 2200 } = {}) {
    const holder = document.getElementById('toasts');
    const toast = el('div', 'toast' + (gold ? ' gold' : ''), text);
    holder.appendChild(toast);
    setTimeout(() => toast.classList.add('out'), ms - 300);
    setTimeout(() => toast.remove(), ms);
    while (holder.children.length > 3) holder.firstChild.remove();
  }

  banner(text, sub, ms = 2200) {
    const stage = document.getElementById('stage');
    const b = el('div', 'banner');
    b.appendChild(el('div', null, text));
    if (sub) b.appendChild(el('div', 'sub', sub));
    stage.appendChild(b);
    setTimeout(() => b.remove(), ms);
  }

  backBtn(panel) {
    const b = el('button', 'btn secondary', t('common.back'));
    b.onclick = () => { this.actions.ui(); this.show('menu'); };
    panel.appendChild(b);
  }

  title(panel, key) { panel.appendChild(el('h2', 'screen-title', t(key))); }

  // ---- menu -----------------------------------------------------------------
  build_menu(panel) {
    const logo = el('div', 'logo');
    const img = document.createElement('img');
    img.src = this.frogURL; img.alt = 'froD';
    logo.appendChild(img);
    logo.appendChild(el('h1', null, 'froD'));
    panel.appendChild(logo);
    panel.appendChild(el('p', 'tagline', t('app.tagline')));

    const dailyDone = this.meta.topScores('daily', todayKey()).length > 0;
    const mk = (key, cls, fn) => {
      const b = el('button', 'btn ' + cls, t(key));
      b.onclick = () => { this.actions.ui(); fn(); };
      panel.appendChild(b);
      return b;
    };
    mk('menu.play', 'primary', () => this.actions.play('classic'));
    mk(dailyDone ? 'menu.dailyDone' : 'menu.daily', '', () => this.show('dailyIntro'));
    mk('menu.howto', 'secondary', () => this.show('howto'));
    mk('menu.scores', 'secondary', () => this.show('scores'));
    mk('menu.achievements', 'secondary', () => this.show('achievements'));
    const row = el('div', 'btn-row');
    const stats = el('button', 'btn secondary small', t('menu.stats'));
    stats.onclick = () => { this.actions.ui(); this.show('stats'); };
    const settings = el('button', 'btn secondary small', t('menu.settings'));
    settings.onclick = () => { this.actions.ui(); this.show('settings'); };
    row.appendChild(stats); row.appendChild(settings);
    panel.appendChild(row);
    panel.appendChild(el('p', 'footer-note', t('menu.footer')));
  }

  build_dailyIntro(panel) {
    this.title(panel, 'menu.daily');
    panel.appendChild(el('p', 'tagline', t('daily.desc')));
    panel.appendChild(el('p', 'tagline', todayKey()));
    const go = el('button', 'btn primary', t('menu.play'));
    go.onclick = () => { this.actions.ui(); this.actions.play('daily'); };
    panel.appendChild(go);
    this.backBtn(panel);
  }

  // ---- pause ------------------------------------------------------------------
  build_pause(panel) {
    this.title(panel, 'pause.title');
    const mk = (key, cls, fn) => {
      const b = el('button', 'btn ' + cls, t(key));
      b.onclick = () => { this.actions.ui(); fn(); };
      panel.appendChild(b);
    };
    mk('pause.resume', 'primary', () => this.actions.resume());
    mk('pause.restart', '', () => this.actions.restart());
    mk('pause.quit', 'secondary', () => this.actions.quit());
  }

  // ---- game over / daily complete ------------------------------------------------
  build_over(panel, d) { this.buildResult(panel, d, false); }
  build_daily(panel, d) { this.buildResult(panel, d, true); }

  buildResult(panel, d, daily) {
    this.title(panel, daily ? 'over.dailyTitle' : 'over.title');
    if (!daily && d.cause) panel.appendChild(el('p', 'cause', t('over.cause.' + d.cause)));
    const big = el('div', 'result-big');
    big.appendChild(el('div', 'label', t('over.score')));
    big.appendChild(el('div', 'score', d.score.toLocaleString('en-US')));
    panel.appendChild(big);
    const sub = el('div', 'result-sub');
    sub.appendChild(el('span', null, `${t('over.level')}: ${d.level}`));
    sub.appendChild(el('span', null, `${t('over.best')}: ${d.best.toLocaleString('en-US')}`));
    panel.appendChild(sub);
    if (d.newBest) panel.appendChild(el('p', 'newbest', t('over.newBest')));

    if (d.qualifies) {
      panel.appendChild(el('p', 'tagline', t('over.enterName')));
      const row = el('div', 'name-entry');
      const input = document.createElement('input');
      input.type = 'text'; input.maxLength = 14;
      input.value = this.meta.settings.lastName || t('common.player');
      const save = el('button', 'btn primary', t('common.save'));
      const doSave = () => {
        const name = (input.value.trim() || t('common.player')).slice(0, 14);
        this.actions.saveName(name);
        input.disabled = true; save.disabled = true;
        save.textContent = t('over.saved');
      };
      save.onclick = doSave;
      input.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); e.stopPropagation(); });
      row.appendChild(input); row.appendChild(save);
      panel.appendChild(row);
    }

    const mk = (key, cls, fn) => {
      const b = el('button', 'btn ' + cls, t(key));
      b.onclick = () => { this.actions.ui(); fn(b); };
      panel.appendChild(b);
      return b;
    };
    mk('over.retry', 'primary', () => this.actions.play(d.mode));
    if (daily || d.mode === 'daily') {
      mk('over.share', 'secondary', (btn) => this.actions.share(d, btn));
    }
    mk('over.menu', 'secondary', () => this.actions.quit());
  }

  // ---- how to ---------------------------------------------------------------------
  build_howto(panel) {
    this.title(panel, 'howto.title');
    const box = el('div', 'howto');
    for (const k of ['howto.goal', 'howto.road', 'howto.river', 'howto.bonus', 'howto.time', 'howto.controls', 'howto.extra']) {
      box.appendChild(el('p', null, t(k)));
    }
    panel.appendChild(box);
    this.backBtn(panel);
  }

  // ---- scores ------------------------------------------------------------------------
  build_scores(panel) {
    this.title(panel, 'scores.title');
    const tabs = el('div', 'tabs');
    for (const mode of ['classic', 'daily']) {
      const tab = el('div', 'tab' + (this.scoresTab === mode ? ' active' : ''), t('scores.' + mode));
      tab.onclick = () => { this.scoresTab = mode; this.show('scores'); };
      tabs.appendChild(tab);
    }
    panel.appendChild(tabs);
    const list = this.meta.topScores(this.scoresTab, todayKey());
    if (!list.length) {
      panel.appendChild(el('p', 'empty', t('scores.empty')));
    } else {
      const table = el('table', 'scores');
      const thead = el('thead');
      const hr = el('tr');
      for (const k of ['scores.rank', 'scores.name', 'scores.score', 'scores.level']) hr.appendChild(el('th', null, t(k)));
      thead.appendChild(hr); table.appendChild(thead);
      const tbody = el('tbody');
      list.forEach((e, i) => {
        const tr = el('tr');
        if (i === 0) tr.className = 'me';
        tr.appendChild(el('td', null, String(i + 1)));
        tr.appendChild(el('td', null, e.name));
        tr.appendChild(el('td', null, e.score.toLocaleString('en-US')));
        tr.appendChild(el('td', null, String(e.level)));
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      panel.appendChild(table);
    }
    const clear = el('button', 'btn danger small', t('scores.clear'));
    clear.onclick = () => {
      if (confirm(t('scores.clearConfirm'))) { this.actions.clearScores(); this.show('scores'); }
    };
    panel.appendChild(clear);
    this.backBtn(panel);
  }

  // ---- achievements --------------------------------------------------------------------
  build_achievements(panel) {
    this.title(panel, 'ach.title');
    const list = el('div', 'ach-list');
    const s = this.meta.stats;
    for (const a of ACHIEVEMENTS) {
      const unlocked = !!this.meta.store.achievements[a.id];
      const [cur, goal] = a.goal(s);
      const row = el('div', 'ach' + (unlocked ? '' : ' locked'));
      row.appendChild(el('div', 'icon', a.icon));
      const body = el('div', 'body');
      body.appendChild(el('div', 'name', t('ach.' + a.id)));
      body.appendChild(el('div', 'desc', t('achd.' + a.id)));
      if (!unlocked) {
        const bar = el('div', 'bar');
        const fill = el('div');
        fill.style.width = Math.min(100, (cur / goal) * 100) + '%';
        bar.appendChild(fill);
        body.appendChild(bar);
      }
      row.appendChild(body);
      row.appendChild(el('div', 'check', unlocked ? '✓' : `${Math.min(cur, goal)}/${goal}`));
      list.appendChild(row);
    }
    panel.appendChild(list);
    this.backBtn(panel);
  }

  // ---- stats ------------------------------------------------------------------------------
  build_stats(panel) {
    this.title(panel, 'stats.title');
    const s = this.meta.stats;
    const grid = el('div', 'stats-grid');
    const items = [
      ['stats.games', s.games], ['stats.hops', s.hops],
      ['stats.homes', s.homes], ['stats.flies', s.flies],
      ['stats.clears', s.clears], ['stats.bestScore', s.bestScore],
      ['stats.bestLevel', s.bestLevel], ['stats.roadCrossings', s.roadCrossings],
      ['stats.turtleTime', Math.floor(s.turtleTime)], ['stats.playTime', Math.floor(s.playTime / 60)]
    ];
    for (const [k, v] of items) {
      const cell = el('div', 'stat');
      cell.appendChild(el('div', 'v', Number(v).toLocaleString('en-US')));
      cell.appendChild(el('div', 'k', t(k)));
      grid.appendChild(cell);
    }
    panel.appendChild(grid);
    panel.appendChild(el('h2', 'screen-title', t('stats.deaths')));
    for (const cause of ['car', 'water', 'hedge', 'time', 'edge']) {
      const row = el('div', 'death-row');
      row.appendChild(el('span', null, t('over.cause.' + cause)));
      row.appendChild(el('span', null, String(s.deaths[cause] || 0)));
      panel.appendChild(row);
    }
    this.backBtn(panel);
  }

  // ---- settings ------------------------------------------------------------------------------
  build_settings(panel) {
    this.title(panel, 'settings.title');
    const st = this.meta.settings;

    const langWrap = el('div', 'setting');
    langWrap.appendChild(el('label', null, t('settings.language')));
    const langSel = document.createElement('select');
    for (const [val, label] of [['ar', 'العربية'], ['en', 'English']]) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if (getLang() === val) opt.selected = true;
      langSel.appendChild(opt);
    }
    langSel.onchange = () => this.actions.setLang(langSel.value);
    langWrap.appendChild(langSel);
    panel.appendChild(langWrap);

    const slider = (key, val, onChange) => {
      const wrap = el('div', 'setting');
      const label = el('label');
      label.appendChild(el('span', null, t(key)));
      const valSpan = el('span', 'val', Math.round(val * 100) + '%');
      label.appendChild(valSpan);
      wrap.appendChild(label);
      const input = document.createElement('input');
      input.type = 'range'; input.min = 0; input.max = 100; input.value = Math.round(val * 100);
      input.oninput = () => { valSpan.textContent = input.value + '%'; onChange(input.value / 100); };
      wrap.appendChild(input);
      panel.appendChild(wrap);
    };
    slider('settings.sfx', st.sfx, v => this.actions.settings({ sfx: v }));
    slider('settings.music', st.music, v => this.actions.settings({ music: v }));

    const toggle = (key, val, onChange) => {
      const wrap = el('div', 'setting');
      const label = el('label', 'toggle');
      const input = document.createElement('input');
      input.type = 'checkbox'; input.checked = val;
      input.onchange = () => onChange(input.checked);
      label.appendChild(input);
      label.appendChild(el('span', null, t(key)));
      wrap.appendChild(label);
      panel.appendChild(wrap);
    };
    toggle('settings.musicOn', st.musicOn, v => this.actions.settings({ musicOn: v }));
    toggle('settings.reduceMotion', st.reduceMotion, v => this.actions.settings({ reduceMotion: v }));
    toggle('settings.crt', st.crt, v => this.actions.settings({ crt: v }));

    const touchWrap = el('div', 'setting');
    touchWrap.appendChild(el('label', null, t('settings.touch')));
    const touchSel = document.createElement('select');
    for (const val of ['auto', 'on', 'off']) {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = t('settings.touch.' + val);
      if (st.touch === val) opt.selected = true;
      touchSel.appendChild(opt);
    }
    touchSel.onchange = () => this.actions.settings({ touch: touchSel.value });
    touchWrap.appendChild(touchSel);
    panel.appendChild(touchWrap);

    const reset = el('button', 'btn danger small', t('settings.reset'));
    reset.onclick = () => {
      if (confirm(t('settings.resetConfirm'))) {
        this.actions.resetData();
        this.toast(t('settings.resetDone'));
        this.show('settings');
      }
    };
    panel.appendChild(reset);
    panel.appendChild(el('p', 'footer-note version', t('version') + ' 1.0.0'));
    this.backBtn(panel);
  }
}
