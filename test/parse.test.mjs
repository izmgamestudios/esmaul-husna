import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseKilavuz, parseBadges } from '../lib/parse.mjs';

const md = await readFile(new URL('../data/kilavuz.md', import.meta.url), 'utf8');

test('parses names with unique keys and Arabic text', () => {
  const names = parseKilavuz(md);
  assert.ok(names.length >= 98, `got ${names.length}`);
  assert.equal(new Set(names.map((n) => n.name)).size, names.length);
  for (const n of names) {
    assert.ok(n.arabic.length > 0, n.name);
    assert.ok(n.letter, n.name);
  }
});

test('parses seven badges with names', () => {
  const badges = parseBadges(md);
  assert.equal(badges.length, 7);
  for (const b of badges) assert.ok(b.names.length >= 7, b.name);
});

test('every badge member exists in the name list', () => {
  const names = new Set(parseKilavuz(md).map((n) => n.name));
  for (const b of parseBadges(md)) {
    for (const member of b.names) assert.ok(names.has(member), `${b.name}: ${member}`);
  }
});
