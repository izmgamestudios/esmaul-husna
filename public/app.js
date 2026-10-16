// Vanilla JS client. All text is written with textContent, so no HTML injection is possible.
const state = { names: [], badges: [], sources: [], completed: {}, stats: null, letter: 'Tümü' };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function showError(message) {
  const box = document.getElementById('error');
  box.textContent = message;
  box.hidden = !message;
}

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'İstek başarısız');
  return data;
}

/* ---------- Theme ---------- */

function currentTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function renderThemeButton() {
  const btn = document.getElementById('theme-toggle');
  const next = currentTheme() === 'dark' ? 'Açık' : 'Koyu';
  btn.textContent = `${next} temaya geç`;
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch { /* storage blocked: keep in-memory only */ }
  renderThemeButton();
}

/* ---------- Sidebar (mobile) ---------- */

function setMenu(open) {
  document.getElementById('sidebar').classList.toggle('open', open);
  document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
}

/* ---------- Rendering ---------- */

function renderWeekly(w) {
  if (!w.theme) return el('p', { class: 'subtitle' }, '');
  const status = w.bonusEarned
    ? `Bu hafta bonus kazanıldı (+${w.bonusPerWeek} XP)`
    : `Haftalık bonus: temanın tüm isimlerini bu hafta tamamla (+${w.bonusPerWeek} XP)`;
  const weekBar = el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(w.required), 'aria-valuenow': String(w.done) },
    el('span', { style: `width:${w.required ? Math.round((w.done / w.required) * 100) : 0}%` }));
  return el('div', { class: 'stat weekly' },
    el('div', { class: 'label' }, `Bu haftanın teması (${w.theme.week}. hafta)`),
    el('div', { class: 'value' }, `${w.theme.title}: ${w.done} / ${w.required}`),
    weekBar,
    el('div', { class: 'meta' }, status),
  );
}

function renderStats() {
  const s = state.stats;
  const next = s.nextLevel
    ? `Sonraki seviye: ${s.nextLevel.title} (${s.nextLevel.min} XP)`
    : 'En yüksek seviyedesin';
  const percent = s.totalNames ? Math.round((s.completedCount / s.totalNames) * 100) : 0;
  const bar = el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(percent) },
    el('span', { style: `width:${percent}%` }));
  document.getElementById('stats').replaceChildren(
    el('div', { class: 'stats' },
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Seviye'), el('div', { class: 'value' }, `${s.level.title} (${s.level.level})`)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'XP'), el('div', { class: 'value' }, String(s.xp))),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Seri'), el('div', { class: 'value' }, `${s.streak} gün`)),
      el('div', { class: 'stat' }, el('div', { class: 'label' }, 'Tamamlanan'), el('div', { class: 'value' }, `${s.completedCount} / ${s.totalNames}`), bar),
    ),
    el('p', { class: 'subtitle' }, next),
    renderWeekly(s.weekly),
  );
}

function renderBadges() {
  document.getElementById('badge-grid').replaceChildren(...state.stats.badges.map((b) =>
    el('div', { class: b.earned ? 'badge earned' : 'badge' },
      el('div', { class: 'title' }, b.earned ? `🏅 ${b.name}` : b.name),
      el('div', { class: 'meta' }, `${b.category} · ${b.count}/${b.total}`),
      b.earnedOn ? el('div', { class: 'meta' }, `Kazanıldı: ${b.earnedOn}`) : null,
    )));
}

function renderLetters() {
  const letters = ['Tümü', ...new Set(state.names.map((n) => n.letter))];
  document.getElementById('letters').replaceChildren(...letters.map((l) =>
    el('button', { type: 'button', 'aria-pressed': String(l === state.letter), 'data-letter': l }, l)));
}

function renderNames() {
  const visible = state.letter === 'Tümü' ? state.names : state.names.filter((n) => n.letter === state.letter);
  document.getElementById('name-list').replaceChildren(...visible.map((n) => {
    const done = Boolean(state.completed[n.name]);
    return el('li', { class: done ? 'name done' : 'name' },
      el('button', {
        type: 'button',
        class: 'check',
        'aria-pressed': String(done),
        'aria-label': `${n.name} tamamlandı`,
        'data-name': n.name,
      }, done ? '✓' : ''),
      el('div', {},
        el('div', { class: 'title' }, n.name),
        el('div', { class: 'arabic', lang: 'ar' }, n.arabic),
        el('div', { class: 'meaning' }, n.meaning),
        el('div', { class: 'task' }, `Görev: ${n.task}`),
      ),
    );
  }));
}

function renderSources() {
  const groups = new Map();
  for (const s of state.sources) {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category).push(s);
  }
  const nodes = [];
  for (const [category, items] of groups) {
    nodes.push(el('h3', {}, category));
    nodes.push(el('ul', { class: 'sources' }, ...items.map((s) =>
      el('li', {},
        el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title),
        el('div', { class: 'meaning' }, s.note),
      ))));
  }
  document.getElementById('source-list').replaceChildren(...nodes);
}

function render() {
  renderStats();
  renderBadges();
  renderLetters();
  renderNames();
  renderSources();
  renderThemeButton();
}

/* ---------- Data ---------- */

async function load() {
  try {
    Object.assign(state, await api('/api/state'));
    render();
  } catch (err) {
    showError(`Veriler yüklenemedi: ${err.message}`);
  }
}

async function toggle(name) {
  try {
    Object.assign(state, await api('/api/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }));
    showError('');
    render();
  } catch (err) {
    showError(`Kaydedilemedi: ${err.message}`);
  }
}

/* ---------- Events ---------- */

document.getElementById('name-list').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-name]');
  if (btn) toggle(btn.dataset.name);
});

document.getElementById('letters').addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-letter]');
  if (!btn) return;
  state.letter = btn.dataset.letter;
  renderLetters();
  renderNames();
});

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('menu-toggle').addEventListener('click', () => {
  setMenu(!document.getElementById('sidebar').classList.contains('open'));
});
document.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', () => setMenu(false)));

load();
