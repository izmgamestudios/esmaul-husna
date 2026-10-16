import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, currentStreak, computeStats, todayIso, badgeStatus, weeklyStatus, weekIndex } from '../lib/gamification.mjs';

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

test('badge needs three names inside a 7-day window, not just any three', () => {
  const badge = { name: 'T', category: 'C', names: ['a', 'b', 'c'] };
  const inWindow = badgeStatus(badge, { a: '2026-10-10', b: '2026-10-13', c: '2026-10-16' });
  const spread = badgeStatus(badge, { a: '2026-10-01', b: '2026-10-09', c: '2026-10-16' });
  assert.equal(inWindow.earned, true);
  assert.equal(inWindow.earnedOn, '2026-10-16');
  assert.equal(spread.earned, false);
});

test('weekly bonus is awarded when all names of the theme are done in that week', () => {
  const badges = [{ name: 'T', category: 'C', names: ['a', 'b'] }];
  const themes = [{ week: 1, title: 'x', badges: ['T'] }, { week: 2, title: 'y', badges: ['T'] }];
  const done = weeklyStatus({ themes, badges, completed: { a: '2026-10-12', b: '2026-10-13' }, today: TODAY });
  const partial = weeklyStatus({ themes, badges, completed: { a: '2026-10-12' }, today: TODAY });
  assert.equal(done.bonusEarned, true);
  assert.equal(done.bonusWeeks, 1);
  assert.equal(done.bonusXp, 100);
  assert.equal(partial.bonusEarned, false);
  assert.equal(partial.bonusXp, 0);
});

test('weekIndex groups Monday to Sunday together', () => {
  assert.equal(weekIndex('2026-10-12'), weekIndex('2026-10-18'));
  assert.notEqual(weekIndex('2026-10-11'), weekIndex('2026-10-12'));
});
