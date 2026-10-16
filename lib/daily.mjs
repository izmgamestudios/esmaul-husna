// Retention helpers: the daily name, streak-risk flag and the next-badge hint.
import { dayNumber, addDays, BADGE_THRESHOLD, BADGE_WINDOW_DAYS } from './gamification.mjs';

/**
 * Deterministic "name of the day". The pool is every name not completed before today,
 * so the pick stays stable while the user completes it during the day.
 * When everything was completed on earlier days, it falls back to the full list.
 */
export function dailyName(names, completed, today) {
  if (!names.length) return null;
  const pool = names.filter((n) => !completed[n.name] || completed[n.name] === today);
  const list = pool.length ? pool : names;
  const picked = list[dayNumber(today) % list.length];
  return { name: picked.name, done: completed[picked.name] === today };
}

/** True when a streak exists but nothing was completed today yet (it breaks at midnight). */
export function streakAtRisk(streak, completed, today) {
  return streak > 0 && !Object.values(completed).includes(today);
}

/**
 * Closest unearned badge. Progress counts names completed in the last
 * BADGE_WINDOW_DAYS days (today included); `remaining` is what is missing to reach the threshold.
 */
export function nextBadgeHint(badges, completed, today) {
  const since = dayNumber(addDays(today, -(BADGE_WINDOW_DAYS - 1)));
  let best = null;
  for (const b of badges) {
    if (b.earned) continue;
    const recent = b.names ? b.names.filter((n) => completed[n] && dayNumber(completed[n]) >= since).length : 0;
    const remaining = Math.max(BADGE_THRESHOLD - recent, 0);
    if (!best || remaining < best.remaining) best = { name: b.name, category: b.category, remaining };
  }
  return best;
}
