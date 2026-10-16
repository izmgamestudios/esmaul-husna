// Weekly summary (Monday-Sunday): how many names, on how many days, and the change vs. last week.
import { dayNumber, isoFromDayNumber, weekIndex, weekStartDay, XP_PER_NAME } from './gamification.mjs';

function weekBucket(completed, w) {
  const start = weekStartDay(w);
  const perDay = {};
  for (const date of Object.values(completed)) {
    const d = dayNumber(date);
    if (d >= start && d <= start + 6) perDay[date] = (perDay[date] || 0) + 1;
  }
  const count = Object.values(perDay).reduce((a, b) => a + b, 0);
  const best = Object.entries(perDay).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { count, activeDays: Object.keys(perDay).length, best: best ? { date: best[0], count: best[1] } : null };
}

export function weeklySummary(completed, today) {
  const w = weekIndex(today);
  const cur = weekBucket(completed, w);
  const prev = weekBucket(completed, w - 1);
  return {
    weekStart: isoFromDayNumber(weekStartDay(w)),
    count: cur.count,
    activeDays: cur.activeDays,
    xp: cur.count * XP_PER_NAME,
    bestDay: cur.best,
    prevCount: prev.count,
    delta: cur.count - prev.count,
  };
}
