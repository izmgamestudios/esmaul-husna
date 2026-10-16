// Gamification rules: XP, streaks, levels, badges and weekly themes.
// Progress is a map of { [name]: 'YYYY-MM-DD' } recording the day each name was last completed.

import { dailyName, streakAtRisk, nextBadgeHint } from './daily.mjs';

export const XP_PER_NAME = 10;
export const STREAK_BONUS = 50;     // per full 7-day streak
export const WEEKLY_BONUS = 100;    // per week in which every name of the week's theme is completed
export const BADGE_THRESHOLD = 3;   // names needed from one category...
export const BADGE_WINDOW_DAYS = 7; // ...completed within this many days (inclusive)

export const LEVELS = [
  { level: 1, title: 'Talip', min: 0 },
  { level: 2, title: 'Salik', min: 501 },
  { level: 3, title: 'Arif', min: 1501 },
  { level: 4, title: 'Muhsin', min: 3001 },
  { level: 5, title: 'Sadık', min: 5001 },
];

const DAY_MS = 86400000;

/** Days since 1970-01-01 (UTC) for a YYYY-MM-DD string. */
export function dayNumber(iso) {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function isoFromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIso(tz = 'Europe/Istanbul', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function addDays(iso, delta) {
  return isoFromDayNumber(dayNumber(iso) + delta);
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

/** Monday-based week number. 1970-01-01 was a Thursday, hence the +3 offset. */
export function weekIndex(iso) {
  return Math.floor((dayNumber(iso) + 3) / 7);
}

/** Day number of the Monday that starts week `w`. */
export function weekStartDay(w) {
  return w * 7 - 3;
}

/**
 * A badge is earned when BADGE_THRESHOLD names of its category were completed
 * within any BADGE_WINDOW_DAYS-day span. earnedOn is the day the rule first held.
 */
export function badgeStatus(badge, completed) {
  const days = badge.names
    .filter((n) => completed[n])
    .map((n) => dayNumber(completed[n]))
    .sort((a, b) => a - b);

  let earnedDay = null;
  for (let i = 0; i + BADGE_THRESHOLD - 1 < days.length; i++) {
    const last = days[i + BADGE_THRESHOLD - 1];
    if (last - days[i] <= BADGE_WINDOW_DAYS - 1) {
      earnedDay = last;
      break;
    }
  }

  return {
    name: badge.name,
    category: badge.category,
    names: badge.names,
    count: days.length,
    total: badge.names.length,
    earned: earnedDay !== null,
    earnedOn: earnedDay === null ? null : isoFromDayNumber(earnedDay),
  };
}

/**
 * Weekly themes cycle through the rows of section 3.5. A week's bonus is awarded
 * when every name belonging to that week's theme badges was completed within that week.
 */
export function weeklyStatus({ themes, badges, completed, today }) {
  const empty = { theme: null, required: 0, done: 0, bonusEarned: false, bonusWeeks: 0, bonusXp: 0, bonusPerWeek: WEEKLY_BONUS };
  if (!themes.length) return empty;

  const todayWeek = weekIndex(today);
  const themeFor = (w) => themes[((w % themes.length) + themes.length) % themes.length];
  const requiredFor = (theme) => {
    const set = new Set();
    for (const b of badges) {
      if (theme.badges.includes(b.name)) for (const n of b.names) set.add(n);
    }
    return [...set];
  };
  const doneInWeek = (name, w) => {
    if (!completed[name]) return false;
    const day = dayNumber(completed[name]);
    const start = weekStartDay(w);
    return day >= start && day <= start + 6;
  };

  const days = Object.values(completed).map(dayNumber);
  const firstWeek = days.length ? weekIndex(isoFromDayNumber(Math.min(...days))) : todayWeek;

  let bonusWeeks = 0;
  for (let w = firstWeek; w <= todayWeek; w++) {
    const required = requiredFor(themeFor(w));
    if (required.length && required.every((n) => doneInWeek(n, w))) bonusWeeks += 1;
  }

  const current = themeFor(todayWeek);
  const required = requiredFor(current);
  const done = required.filter((n) => doneInWeek(n, todayWeek)).length;

  return {
    theme: { week: current.week, title: current.title, badges: current.badges },
    required: required.length,
    done,
    bonusEarned: required.length > 0 && done === required.length,
    bonusWeeks,
    bonusXp: bonusWeeks * WEEKLY_BONUS,
    bonusPerWeek: WEEKLY_BONUS,
  };
}

export function computeStats({ names, badges, themes = [], completed, today }) {
  const completedCount = Object.keys(completed).length;
  const streak = currentStreak(Object.values(completed), today);
  const streakBonus = Math.floor(streak / 7) * STREAK_BONUS;
  const weekly = weeklyStatus({ themes, badges, completed, today });
  const badgeList = badges.map((b) => badgeStatus(b, completed));
  const xp = completedCount * XP_PER_NAME + streakBonus + weekly.bonusXp;

  let idx = 0;
  LEVELS.forEach((l, i) => { if (xp >= l.min) idx = i; });
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;

  return {
    xp,
    streak,
    streakBonus,
    completedCount,
    totalNames: names.length,
    level: { level: current.level, title: current.title, min: current.min },
    nextLevel: next ? { level: next.level, title: next.title, min: next.min } : null,
    badges: badgeList,
    weekly,
    daily: {
      name: dailyName(names, completed, today),
      streakAtRisk: streakAtRisk(streak, completed, today),
      nextBadge: nextBadgeHint(badgeList, completed, today),
    },
  };
}
