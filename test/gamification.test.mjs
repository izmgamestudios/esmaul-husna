import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, currentStreak, computeStats, todayIso } from '../lib/gamification.mjs';

const TODAY = '2026-10-16';

test('addDays crosses month boundaries', () => {
  assert.equal(addDays('2026-10-01', -1), '2026-09-30');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});

test('todayIso formats a date in the given zone', () => {
  // 2026-10-15 22:30 UTC is already 2026-10-16 01:30 in Istanbul (UTC+3).
  assert.equal(todayIso('Europe/Istanbul', new Date('2026-10-15T22:30:00Z')), '2026-10-16');
});

test('streak counts back from today and survives an unfinished today', () => {
  assert.equal(currentStreak([TODAY, '2026-10-15', '2026-10-14'], TODAY), 3);
  assert.equal(currentStreak(['2026-10-15', '2026-10-14'], TODAY), 2);
  assert.equal(currentStreak(['2026-10-13'], TODAY), 0);
});

test('XP is 10 per name plus 50 per full 7-day streak', () => {
  const names = Array.from({ length: 7 }, (_, i) => ({ name: `n${i}` }));
  const completed = Object.fromEntries(names.map((n, i) => [n.name, addDays(TODAY, -i)]));
  const stats = computeStats({ names, badges: [], completed, today: TODAY });
  assert.equal(stats.streak, 7);
  assert.equal(stats.streakBonus, 50);
  assert.equal(stats.xp, 70 + 50);
});

test('levels follow the XP thresholds', () => {
  const names = Array.from({ length: 60 }, (_, i) => ({ name: `n${i}` }));
  const completed = Object.fromEntries(names.map((n) => [n.name, TODAY]));
  const stats = computeStats({ names, badges: [], completed, today: TODAY });
  assert.equal(stats.xp, 600);
  assert.equal(stats.level.title, 'Salik');
  assert.equal(stats.nextLevel.title, 'Arif');
});

test('badge is earned at three completed members', () => {
  const badges = [{ name: 'Test', category: 'Kategori', names: ['a', 'b', 'c', 'd'] }];
  const two = computeStats({ names: [], badges, completed: { a: TODAY, b: TODAY }, today: TODAY });
  const three = computeStats({ names: [], badges, completed: { a: TODAY, b: TODAY, c: TODAY }, today: TODAY });
  assert.equal(two.badges[0].earned, false);
  assert.equal(three.badges[0].earned, true);
});
