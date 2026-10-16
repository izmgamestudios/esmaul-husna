// Gamification rules: XP, streaks, levels and badges.
// Progress is a map of { [name]: 'YYYY-MM-DD' } recording the day each name was completed.

export const XP_PER_NAME = 10;
export const STREAK_BONUS = 50;   // awarded per full 7-day streak
export const BADGE_THRESHOLD = 3; // completed names needed to earn a badge (MVP rule)

export const LEVELS = [
  { level: 1, title: 'Talip', min: 0 },
  { level: 2, title: 'Salik', min: 501 },
  { level: 3, title: 'Arif', min: 1501 },
  { level: 4, title: 'Muhsin', min: 3001 },
  { level: 5, title: 'Sadık', min: 5001 },
];

/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIso(tz = 'Europe/Istanbul', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function addDays(iso, delta) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive active days ending today. If today has no activity yet,
 * the streak still counts from yesterday so the user is not punished mid-day.
 */
export function currentStreak(dates, today) {
  const set = new Set(dates);
  let day = set.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (set.has(day)) {
    count += 1;
    day = addDays(day, -1);
  }
  return count;
}

export function computeStats({ names, badges, completed, today }) {
  const completedCount = Object.keys(completed).length;
  const streak = currentStreak(Object.values(completed), today);
  const streakBonus = Math.floor(streak / 7) * STREAK_BONUS;
  const xp = completedCount * XP_PER_NAME + streakBonus;

  let idx = 0;
  LEVELS.forEach((l, i) => { if (xp >= l.min) idx = i; });
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;

  const badgeStatus = badges.map((b) => {
    const count = b.names.filter((n) => completed[n]).length;
    return {
      name: b.name,
      category: b.category,
      count,
      total: b.names.length,
      earned: count >= BADGE_THRESHOLD,
    };
  });

  return {
    xp,
    streak,
    streakBonus,
    completedCount,
    totalNames: names.length,
    level: { level: current.level, title: current.title, min: current.min },
    nextLevel: next ? { level: next.level, title: next.title, min: next.min } : null,
    badges: badgeStatus,
  };
}
