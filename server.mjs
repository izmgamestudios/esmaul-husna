// Esmaü'l-Hüsna server: serves the static UI and a small JSON API.
// Zero dependencies. Progress is stored in data/progress.json.
import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKilavuz, parseBadges } from './lib/parse.mjs';
import { computeStats, todayIso } from './lib/gamification.mjs';
import { validateSources } from './lib/sources.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(ROOT, 'data');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');
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
const sources = validateSources(JSON.parse(await readFile(path.join(DATA_DIR, 'sources.json'), 'utf8')));
const knownNames = new Set(names.map((n) => n.name));

/** Keep only known names and valid dates, so stale or tampered data is dropped. */
function sanitize(completed) {
  const out = {};
  if (completed && typeof completed === 'object') {
    for (const [name, date] of Object.entries(completed)) {
      if (knownNames.has(name) && /^\d{4}-\d{2}-\d{2}$/.test(date)) out[name] = date;
    }
  }
  return out;
}

async function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { completed: {} };
  try {
    const parsed = JSON.parse(await readFile(PROGRESS_FILE, 'utf8'));
    return { completed: sanitize(parsed.completed) };
  } catch {
    return { completed: {} };
  }
}

/** Write to a temp file, then rename, so a crash never leaves a half-written file. */
async function saveProgress(progress) {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${PROGRESS_FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(progress, null, 2), 'utf8');
  await rename(tmp, PROGRESS_FILE);
}

function snapshot(progress) {
  return {
    names,
    badges,
    sources,
    completed: progress.completed,
    stats: computeStats({
      names,
      badges,
      completed: progress.completed,
      today: todayIso(TZ),
    }),
  };
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
      const progress = await loadProgress();
      if (progress.completed[name]) {
        delete progress.completed[name];
      } else {
        progress.completed[name] = todayIso(TZ);
      }
      await saveProgress(progress);
      return sendJson(res, 200, snapshot(progress));
    }

    return sendJson(res, 404, { error: 'Bulunamadı' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Sunucu hatası' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Esmaü'l-Hüsna uygulaması: http://${HOST}:${PORT}`);
  console.log(`${names.length} isim, ${badges.length} rozet, ${sources.length} kaynak yüklendi.`);
});
