import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freezeStatus } from '../lib/freeze.mjs';
import { weeklySummary } from '../lib/summary.mjs';
import { computeStats } from '../lib/gamification.mjs';

const TODAY = '2026-10-16'; // Friday

test('freeze is usable only when yesterday is empty and protects a real streak', () => {
  const active = new Set(['2026-10-14', '2026-10-13']);
  assert.deepEqual(freezeStatus(active, [], TODAY), { target: '2026-10-15', available: 1, canUse: true });
  assert.equal(freezeStatus(new Set(['2026-10-15']), [], TODAY).canUse, false); // yesterday active
  assert.equal(freezeStatus(new Set(['2026-10-10']), [], TODAY).canUse, false); // no streak to protect
});

test('only one freeze per calendar month', () => {
  const active = new Set(['2026-10-14']);
  assert.equal(freezeStatus(active, ['2026-10-03'], TODAY).canUse, false);
  assert.equal(freezeStatus(active, ['2026-09-20'], TODAY).canUse, true);
});

test('a frozen day keeps the streak alive', () => {
  const completed = { A: '2026-10-14', B: '2026-10-13', C: TODAY };
  const without = computeStats({ names: [], badges: [], completed, today: TODAY });
  const withFreeze = computeStats({ names: [], badges: [], completed, freezes: ['2026-10-15'], today: TODAY });
  assert.equal(without.streak, 1);
  assert.equal(withFreeze.streak, 4);
});

test('weekly summary compares with the previous Monday-Sunday week', () => {
  const completed = { A: '2026-10-12', B: '2026-10-12', C: '2026-10-15', D: '2026-10-06', E: '2026-10-18' };
  const s = weeklySummary(completed, TODAY);
  assert.equal(s.weekStart, '2026-10-12');
  assert.equal(s.count, 4);
  assert.equal(s.activeDays, 3);
  assert.equal(s.xp, 40);
  assert.deepEqual(s.bestDay, { date: '2026-10-12', count: 2 });
  assert.equal(s.prevCount, 1);
  assert.equal(s.delta, 3);
});
