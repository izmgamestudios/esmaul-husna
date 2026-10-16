import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyName, streakAtRisk, nextBadgeHint } from '../lib/daily.mjs';
import { computeStats } from '../lib/gamification.mjs';

const TODAY = '2026-10-16';
const names = ['A', 'B', 'C', 'D'].map((name) => ({ name }));

test('daily name is stable across the day, even after completing it', () => {
  const before = dailyName(names, {}, TODAY);
  const after = dailyName(names, { [before.name]: TODAY }, TODAY);
  assert.equal(after.name, before.name);
  assert.equal(before.done, false);
  assert.equal(after.done, true);
});

test('daily name skips names completed on earlier days and falls back when all are done', () => {
  const some = dailyName(names, { A: '2026-10-01', B: '2026-10-01', C: '2026-10-01' }, TODAY);
  assert.equal(some.name, 'D');
  const all = dailyName(names, { A: '2026-10-01', B: '2026-10-01', C: '2026-10-01', D: '2026-10-01' }, TODAY);
  assert.ok(names.some((n) => n.name === all.name));
  assert.equal(dailyName([], {}, TODAY), null);
});

test('streak is at risk only with an active streak and no activity today', () => {
  assert.equal(streakAtRisk(2, { A: '2026-10-15' }, TODAY), true);
  assert.equal(streakAtRisk(3, { A: TODAY }, TODAY), false);
  assert.equal(streakAtRisk(0, {}, TODAY), false);
});

test('next badge hint picks the badge closest to the threshold', () => {
  const badges = [
    { name: 'X', category: 'x', names: ['A', 'B', 'C'], earned: false },
    { name: 'Y', category: 'y', names: ['D', 'E', 'F'], earned: false },
    { name: 'Z', category: 'z', names: ['G'], earned: true },
  ];
  const hint = nextBadgeHint(badges, { D: TODAY, E: '2026-10-14', A: '2026-10-01' }, TODAY);
  assert.deepEqual(hint, { name: 'Y', category: 'y', remaining: 1 });
});

test('computeStats exposes the daily block', () => {
  const stats = computeStats({ names, badges: [], completed: {}, today: TODAY });
  assert.ok(stats.daily.name);
  assert.equal(stats.daily.streakAtRisk, false);
  assert.equal(stats.daily.nextBadge, null);
});
