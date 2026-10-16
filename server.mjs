// Esmaü'l-Hüsna server: serves the static UI and a small JSON API.
// Zero dependencies. Progress is stored in data/progress.json.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKilavuz, parseBadges, parseThemes } from './lib/parse.mjs';
import { computeStats, todayIso } from './lib/gamification.mjs';
import { validateSources } from './lib/sources.mjs';
import { createStoreFromEnv } from './lib/store.mjs';
import { freezeStatus } from './lib/freeze.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const TZ = 'Europe/Istanbul';
const MAX_BODY = 1024;

const STATIC_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/theme.js': ['theme.js', 'text/javascript; charset=utf-8'],
  '/logo.png': ['logo.png', 'image/png'],
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

const md = await readFile(path.join(DATA_DIR, 'kilavuz.md'), 'utf8');
const names = parseKilavuz(md);
const badges = parseBadges(md);
const themes = parseThemes(md);
const sources = validateSources(JSON.parse(await readFile(path.join(DATA_DIR, 'sources.json'), 'utf8')));
const knownNames = new Set(names.map((n) => n.name));

const store = await createStoreFromEnv(process.env, DATA_DIR);

/** Keep only known names and valid dates, so stale or tampered data is dropped. */
function sanitize(raw) {
  const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const completed = {};
  if (raw?.completed && typeof raw.completed === 'object') {
    for (const [name, date] of Object.entries(raw.completed)) {
      if (knownNames.has(name) && isDate(date)) completed[name] = date;
    }
  }
  const freezes = Array.isArray(raw?.freezes) ? [...new Set(raw.freezes.filter(isDate))].sort() : [];
  return { completed, freezes };
}

const loadProgress = async () => sanitize(await store.loadProgress());

/** One writer at a time: Drive read-modify-write must not interleave. */
let queue = Promise.resolve();
function exclusive(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function snapshot(progress) {
  const stats = computeStats({
    names, badges, themes,
    completed: progress.completed,
    freezes: progress.freezes,
    today: todayIso(TZ),
  });
  return { names, badges, sources, completed: progress.completed, stats };
}

/** Persist progress, then best-effort log + report (a failed log never loses the user's action). */
async function persist(progress, event) {
  await store.saveProgress(progress);
  const snap = snapshot(progress);
  const today = todayIso(TZ);
  store.appendActivity({ timestamp: new Date().toISOString(), date: today, ...event })
    .then(() => store.saveReport({ updatedAt: new Date().toISOString(), xp: snap.stats.xp, streak: snap.stats.streak, level: snap.stats.level.title, completedCount: snap.stats.completedCount, weekly: snap.stats.daily.summary }))
    .catch((err) => console.error('Rapor yazılamadı:', err.message));
  return snap;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const err = new Error('Payload too large');
      err.status = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && STATIC_FILES[url.pathname]) {
      const [file, type] = STATIC_FILES[url.pathname];
      const body = await readFile(path.join(ROOT, 'public', file));
      return send(res, 200, body, { 'Content-Type': type });
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      return sendJson(res, 200, snapshot(await loadProgress()));
    }

    if (req.method === 'POST' && url.pathname === '/api/toggle') {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.startsWith('application/json')) {
        return sendJson(res, 415, { error: 'JSON bekleniyor' });
      }
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (err) {
        const tooLarge = err.status === 413;
        return sendJson(res, tooLarge ? 413 : 400, {
          error: tooLarge ? 'Gövde çok büyük' : 'Geçersiz JSON',
        });
      }
      const name = body && body.name;
      if (typeof name !== 'string' || !knownNames.has(name)) {
        return sendJson(res, 400, { error: 'Bilinmeyen isim' });
      }
      const snap = await exclusive(async () => {
        const progress = await loadProgress();
        let action = 'complete';
        if (progress.completed[name]) {
          delete progress.completed[name];
          action = 'undo';
        } else {
          progress.completed[name] = todayIso(TZ);
        }
        return persist(progress, { name, action });
      });
      return sendJson(res, 200, snap);
    }

    if (req.method === 'POST' && url.pathname === '/api/freeze') {
      const result = await exclusive(async () => {
        const progress = await loadProgress();
        const today = todayIso(TZ);
        const status = freezeStatus(new Set(Object.values(progress.completed)), progress.freezes, today);
        if (!status.canUse) return null;
        progress.freezes.push(status.target);
        return persist(progress, { name: status.target, action: 'freeze' });
      });
      if (!result) return sendJson(res, 409, { error: 'Seri koruyucu şu an kullanılamaz' });
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: 'Bulunamadı' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Sunucu hatası' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Esmaü'l-Hüsna uygulaması: http://${HOST}:${PORT}`);
  console.log(`Depolama: ${store.kind}`);
  console.log(`${names.length} isim, ${badges.length} rozet, ${sources.length} kaynak yüklendi.`);
});
