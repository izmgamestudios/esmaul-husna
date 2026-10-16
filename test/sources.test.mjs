import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSources } from '../lib/sources.mjs';

const raw = JSON.parse(await readFile(new URL('../data/sources.json', import.meta.url), 'utf8'));

test('bundled sources pass validation', () => {
  const list = validateSources(raw);
  assert.ok(list.length >= 5);
  for (const s of list) assert.equal(new URL(s.url).protocol, 'https:');
});

test('rejects non-https and javascript: links', () => {
  assert.throws(() => validateSources([{ category: 'a', title: 'b', note: 'c', url: 'http://x.org' }]), /yalnızca https/);
  assert.throws(() => validateSources([{ category: 'a', title: 'b', note: 'c', url: 'javascript:alert(1)' }]), /yalnızca https|geçersiz/);
});

test('rejects entries with missing fields', () => {
  assert.throws(() => validateSources([{ category: 'a', url: 'https://x.org', note: 'c' }]), /zorunlu/);
});
