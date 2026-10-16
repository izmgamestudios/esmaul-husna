// Streak freeze: one per calendar month, covers yesterday when it would break an existing streak.
import { addDays } from './gamification.mjs';

export const FREEZES_PER_MONTH = 1;

const month = (iso) => iso.slice(0, 7);

/**
 * @param activeDays Set of YYYY-MM-DD with real activity   @param freezes array of frozen days
 * canUse is true when yesterday is empty, the day before it was active/frozen (a streak exists to protect)
 * and no freeze was spent in yesterday's month yet.
 */
export function freezeStatus(activeDays, freezes, today) {
  const target = addDays(today, -1);
  const covered = (d) => activeDays.has(d) || freezes.includes(d);
  const usedThisMonth = freezes.filter((d) => month(d) === month(target)).length;
  const available = Math.max(FREEZES_PER_MONTH - usedThisMonth, 0);
  const canUse = available > 0 && !covered(target) && covered(addDays(target, -1));
  return { target, available, canUse };
}
