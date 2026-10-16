import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDriveClient } from '../lib/drive.mjs';
import { createDriveStore, createFileStore, activityLine } from '../lib/store.mjs';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const FOLDER = 'folderId1234567890';

/** In-memory fake of the Drive endpoints the client uses. */
function fakeDrive() {
  const files = new Map(); // id -> { name, text }
  let seq = 0;
  const calls = [];
  const json = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
  const fetchImpl = async (url, opt = {}) => {
    url = String(url);
    calls.push(`${opt.method || 'GET'} ${url.split('?')[0]}`);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      assert.match(String(opt.body), /assertion=[\w-]+\.[\w-]+\.[\w-]+/);
      return json({ access_token: 'tok', expires_in: 3600 });
    }
    assert.equal(opt.headers.Authorization, 'Bearer tok');
    if (url.includes('/upload/') && opt.method === 'POST') {
      const meta = JSON.parse(opt.body.split('\r\n\r\n')[1].split('\r\n')[0]);
      assert.deepEqual(meta.parents, [FOLDER]);
      const text = opt.body.split('\r\n\r\n')[2].split('\r\n--')[0];
      const id = `id${++seq}`;
      files.set(id, { name: meta.name, text });
      return json({ id });
    }
    if (url.includes('/upload/') && opt.method === 'PATCH') {
      files.get(url.split('/files/')[1].split('?')[0]).text = opt.body;
      return json({});
    }
    if (url.includes('alt=media')) {
      return { ok: true, status: 200, text: async () => files.get(url.split('/files/')[1].split('?')[0]).text };
    }
    const q = new URL(url).searchParams.get('q');
    const name = q.match(/name = '(.*?)' and/)[1];
    const hit = [...files].find(([, f]) => f.name === name);
    return json({ files: hit ? [{ id: hit[0] }] : [] });
  };
  return { fetchImpl, files, calls };
}

test('drive store round-trips progress and appends activity rows', async () => {
  const fake = fakeDrive();
  const client = createDriveClient({ credentials: { client_email: 'sa@x.iam', private_key: privateKey }, folderId: FOLDER, fetchImpl: fake.fetchImpl });
  const store = createDriveStore(client);

  assert.equal(await store.loadProgress(), null);
  await store.saveProgress({ completed: { 'El-Adl': '2026-10-16' }, freezes: [] });
  await store.saveProgress({ completed: {}, freezes: ['2026-10-15'] });
  assert.deepEqual(await store.loadProgress(), { completed: {}, freezes: ['2026-10-15'] });

  await store.appendActivity({ timestamp: 't1', date: '2026-10-16', name: 'El-Adl', action: 'complete' });
  await store.appendActivity({ timestamp: 't2', date: '2026-10-16', name: 'Er-Rahman, X', action: 'undo' });
  const csv = [...fake.files.values()].find((f) => f.name === 'activity.csv').text;
  assert.equal(csv, 'timestamp,date,name,action\nt1,2026-10-16,El-Adl,complete\nt2,2026-10-16,"Er-Rahman, X",undo\n');
  assert.equal(fake.calls.filter((c) => c.includes('oauth2')).length, 1, 'token is cached');
});

test('drive store refuses to reset progress when the file is corrupt', async () => {
  const fake = fakeDrive();
  const client = createDriveClient({ credentials: { client_email: 'sa@x.iam', private_key: privateKey }, folderId: FOLDER, fetchImpl: fake.fetchImpl });
  await client.writeText('progress.json', '{broken');
  await assert.rejects(createDriveStore(client).loadProgress());
});

test('drive client rejects bad configuration', () => {
  assert.throws(() => createDriveClient({ credentials: {}, folderId: FOLDER }));
  assert.throws(() => createDriveClient({ credentials: { client_email: 'a', private_key: 'b' }, folderId: "x'y" }));
});

test('file store persists progress and activity locally', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'eh-'));
  const store = createFileStore(dir);
  assert.equal(await store.loadProgress(), null);
  await store.saveProgress({ completed: { A: '2026-10-16' }, freezes: [] });
  assert.deepEqual(await store.loadProgress(), { completed: { A: '2026-10-16' }, freezes: [] });
  await store.appendActivity({ timestamp: 't', date: 'd', name: 'A', action: 'complete' });
  await store.appendActivity({ timestamp: 't', date: 'd', name: 'A', action: 'undo' });
  assert.equal(await readFile(path.join(dir, 'activity.csv'), 'utf8'), `timestamp,date,name,action\n${activityLine({ timestamp: 't', date: 'd', name: 'A', action: 'complete' })}${activityLine({ timestamp: 't', date: 'd', name: 'A', action: 'undo' })}`);
});
