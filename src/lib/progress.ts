import { median } from './stats';
import type { Attempt, Grade, PracticeSet, ReqId, RunRecord } from './types';

// Day-by-day progress and how often each set slot / tooth was done.
// All days are LOCAL calendar days, so a 9 pm project counts on that evening.

export const GRADE_SHORT: Record<Grade, string> = { C: 'OK', MC: 'MC', NC: 'FAIL' };

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};

/** Local midnight of a day key. */
export const keyDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Local midnight of the Monday of the week of `d`. */
export const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

/** "3.6" for "36" or " 3.6 ", so typed teeth match the teeth in the sets. */
export const normTooth = (t: string) => {
  const s = t.replace(/\s+/g, '');
  return /^\d\d$/.test(s) ? `${s[0]}.${s[1]}` : s;
};

export interface PeriodStats {
  projects: number;
  sec: number;
  graded: number;
  passed: number;
  timed: number;
  onTarget: number;
}

export function periodStats(list: Attempt[]): PeriodStats {
  const graded = list.filter((a) => a.grade);
  const timed = list.filter((a) => a.targetSec > 0);
  return {
    projects: list.length,
    sec: list.reduce((s, a) => s + a.durationSec, 0),
    graded: graded.length,
    passed: graded.filter((a) => a.grade !== 'NC').length,
    timed: timed.length,
    onTarget: timed.filter((a) => a.durationSec <= a.targetSec).length,
  };
}

export const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : null);

const inRange = (list: Attempt[], from: Date, to: Date) =>
  list.filter((a) => {
    const t = new Date(a.date).getTime();
    return t >= from.getTime() && t < to.getTime();
  });

/** This week (Monday to now) and the whole week before it. */
export function weekCompare(list: Attempt[], now = new Date()) {
  const start = weekStart(now);
  return {
    thisWeek: periodStats(inRange(list, start, addDays(start, 7))),
    lastWeek: periodStats(inRange(list, addDays(start, -7), start)),
  };
}

export interface CalendarDay {
  key: string;
  count: number;
  today: boolean;
  future: boolean;
}

/** `weeks` columns of Monday-to-Sunday days, oldest first, ending with this week. */
export function calendar(list: Attempt[], now = new Date(), weeks = 8): CalendarDay[] {
  const counts = new Map<string, number>();
  for (const a of list) counts.set(dayKey(a.date), (counts.get(dayKey(a.date)) ?? 0) + 1);
  const first = addDays(weekStart(now), -7 * (weeks - 1));
  const today = dayKey(now);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = addDays(first, i);
    const key = dayKey(d);
    return { key, count: counts.get(key) ?? 0, today: key === today, future: d.getTime() > now.getTime() && key !== today };
  });
}

/** Days in a row with practice, up to today (or up to yesterday when today is still empty). */
export function streak(list: Attempt[], now = new Date()) {
  const days = new Set(list.map((a) => dayKey(a.date)));
  let d = days.has(dayKey(now)) ? now : addDays(now, -1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export interface WeekPoint {
  start: string;
  projects: number;
  passPct: number | null;
  onTargetPct: number | null;
}

/** Pass rate and on-target rate per week, oldest first. */
export function weekly(list: Attempt[], now = new Date(), weeks = 8): WeekPoint[] {
  const first = addDays(weekStart(now), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(first, 7 * i);
    const s = periodStats(inRange(list, from, addDays(from, 7)));
    return { start: dayKey(from), projects: s.projects, passPct: pct(s.passed, s.graded), onTargetPct: pct(s.onTarget, s.timed) };
  });
}

export interface DayEntry {
  key: string;
  attempts: Attempt[];
  stats: PeriodStats;
  /** Titles of the mock exams on that day. */
  mocks: string[];
}

/** Practice days, newest first; the projects of a day in time order. */
export function dayLog(list: Attempt[], runs: RunRecord[] = []): DayEntry[] {
  const byDay = new Map<string, Attempt[]>();
  for (const a of list) {
    const k = dayKey(a.date);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  const runById = new Map(runs.map((r) => [r.id, r]));
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, as]) => {
      const sorted = [...as].sort((a, b) => a.date.localeCompare(b.date));
      const mocks = [
        ...new Set(sorted.map((a) => (a.runId ? runById.get(a.runId) : undefined)).filter((r) => r?.kind === 'mock').map((r) => r!.title)),
      ];
      return { key, attempts: sorted, stats: periodStats(sorted), mocks };
    });
}

/**
 * Seconds faster (negative) or slower (positive) than the median of the previous 5 attempts
 * of the same requirement. Null when there is no earlier attempt.
 */
export function vsUsual(list: Attempt[], a: Attempt): number | null {
  const before = list
    .filter((x) => x.reqId === a.reqId && x.id !== a.id && x.date < a.date)
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, 5)
    .map((x) => x.durationSec);
  const m = median(before);
  return m == null ? null : a.durationSec - m;
}

/** Findings of a group of attempts, most frequent first. */
export function findings(list: Attempt[]) {
  const m = new Map<string, number>();
  for (const a of list) for (const t of a.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

export interface SlotStats {
  reqId: ReqId;
  tooth: string;
  surface: string;
  count: number;
  last?: Attempt;
}

export interface SetStats {
  set: PracticeSet;
  slots: SlotStats[];
  total: number;
  done: number;
}

/** For each set: how many times each project slot was done with that set. */
export function setCoverage(sets: PracticeSet[], list: Attempt[], order: ReqId[]): SetStats[] {
  return sets.map((set) => {
    const mine = list.filter((a) => a.setId === set.id);
    const slots = order.map((reqId) => {
      const as = mine.filter((a) => a.reqId === reqId).sort((a, b) => a.date.localeCompare(b.date));
      const spec = set.teeth[reqId];
      return { reqId, tooth: spec?.tooth ?? '', surface: spec?.surface ?? '', count: as.length, last: as[as.length - 1] };
    });
    return { set, slots, total: mine.length, done: slots.filter((s) => s.count > 0).length };
  });
}

/** Attempts that belong to no set that still exists. */
export const noSetCount = (sets: PracticeSet[], list: Attempt[]) => {
  const ids = new Set(sets.map((s) => s.id));
  return list.filter((a) => !a.setId || !ids.has(a.setId)).length;
};

export interface ToothCount {
  tooth: string;
  count: number;
  /** Names of the sets that use this tooth for this requirement. */
  sets: string[];
}

/**
 * For one requirement: every tooth you did, plus every tooth your sets use for it (count 0 if
 * not done yet). Most done first.
 */
export function teethFor(reqId: ReqId, sets: PracticeSet[], list: Attempt[]): ToothCount[] {
  const map = new Map<string, ToothCount>();
  const get = (tooth: string) => {
    const k = normTooth(tooth);
    if (!map.has(k)) map.set(k, { tooth: k, count: 0, sets: [] });
    return map.get(k)!;
  };
  for (const s of sets) {
    const t = s.teeth[reqId]?.tooth;
    if (t) {
      const e = get(t);
      if (!e.sets.includes(s.name)) e.sets.push(s.name);
    }
  }
  for (const a of list) if (a.reqId === reqId && a.tooth.trim()) get(a.tooth).count++;
  return [...map.values()].sort((a, b) => b.count - a.count || a.tooth.localeCompare(b.tooth));
}
