// Vanilla JS client. All text is set with textContent, so no HTML injection is possible.
const state = { names: [], badges: [], completed: {}, stats: null, letter: 'Tümü' };

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
  );
}

function renderBadges() {
  document.getElementById('badges').replaceChildren(...state.stats.badges.map((b) =>
    el('div', { class: b.earned ? 'badge earned' : 'badge' },
      el('div', { class: 'title' }, b.earned ? `🏅 ${b.name}` : b.name),
      el('div', { class: 'meta' }, `${b.category} · ${b.count}/${b.total}`),
    )));
}

function renderLetters() {
  const letters = ['Tümü', ...new Set(state.names.map((n) => n.letter))];
  document.getElementById('letters').replaceChildren(...letters.map((l) => {
    const btn = el('button', { type: 'button', 'aria-pressed': String(l === state.letter), 'data-letter': l }, l);
    return btn;
  }));
}

function renderNames() {
  const visible = state.letter === 'Tümü' ? state.names : state.names.filter((n) => n.letter === state.letter);
  document.getElementById('names').replaceChildren(...visible.map((n) => {
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

function render() {
  renderStats();
  renderBadges();
  renderLetters();
  renderNames();
}

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

document.getElementById('names').addEventListener('click', (event) => {
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

load();
