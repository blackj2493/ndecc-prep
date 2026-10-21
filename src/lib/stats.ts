import { REQUIREMENTS } from './defaults';
import type { Attempt, Criterion, ReqId, Settings } from './types';

export function fmtClock(ms: number, showHours = true) {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const body = h > 0 || showHours ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  return (neg ? '-' : '') + body;
}

export function fmtMin(sec: number | null | undefined) {
  if (sec == null || !isFinite(sec)) return '–';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const byDate = (a: Attempt, b: Attempt) => a.date.localeCompare(b.date);

export interface ReqStats {
  reqId: ReqId;
  count: number;
  medianSec: number | null;
  recentMedianSec: number | null;
  bestSec: number | null;
  /** Interquartile range of the last 10 attempts, in seconds. Smaller = more consistent. */
  spreadSec: number | null;
  onTargetPct: number | null;
  graded: number;
  passPct: number | null;
  repeats: number;
  /** Recent median minus the median of the five attempts before them. Negative = faster. */
  trendSec: number | null;
  topTags: { tag: string; count: number; recent: number }[];
}

export function reqStats(attempts: Attempt[], reqId: ReqId): ReqStats {
  const list = attempts.filter((a) => a.reqId === reqId).sort(byDate);
  const d = list.map((a) => a.durationSec);
  const recent = d.slice(-5);
  const prior = d.slice(-10, -5);
  const last10 = [...d.slice(-10)].sort((a, b) => a - b);
  const q = (p: number) => last10[Math.min(last10.length - 1, Math.floor(p * (last10.length - 1)))];
  const graded = list.filter((a) => a.grade);
  const tagCount = new Map<string, { count: number; recent: number }>();
  const recentIds = new Set(list.slice(-5).map((a) => a.id));
  for (const a of list)
    for (const t of a.tags) {
      const c = tagCount.get(t) ?? { count: 0, recent: 0 };
      c.count++;
      if (recentIds.has(a.id)) c.recent++;
      tagCount.set(t, c);
    }
  const rm = median(recent);
  const pm = median(prior);
  return {
    reqId,
    count: list.length,
    medianSec: median(d),
    recentMedianSec: rm,
    bestSec: d.length ? Math.min(...d) : null,
    spreadSec: last10.length >= 4 ? q(0.75) - q(0.25) : null,
    onTargetPct: list.length
      ? (100 * list.filter((a) => a.durationSec <= a.targetSec).length) / list.length
      : null,
    graded: graded.length,
    passPct: graded.length ? (100 * graded.filter((a) => a.grade !== 'NC').length) / graded.length : null,
    repeats: list.filter((a) => a.repeats > 0).length,
    trendSec: rm != null && pm != null ? rm - pm : null,
    topTags: [...tagCount.entries()]
      .map(([tag, c]) => ({ tag, ...c }))
      .sort((a, b) => b.count - a.count),
  };
}

export interface Overview {
  per: ReqStats[];
  /** Sum of recent medians, with the target for requirements that have no data. */
  forecastSec: number;
  examSec: number;
  missing: ReqId[];
  /** Mean ratio of duration to target for projects started in the first and second half of a mock. */
  fatigue: { early: number | null; late: number | null };
  weakest: { reqId: ReqId; overrunPct: number }[];
}

export function overview(attempts: Attempt[], settings: Settings): Overview {
  const per = REQUIREMENTS.map((r) => reqStats(attempts, r.id));
  const examSec = settings.sessions.reduce((s, x) => s + x.minutes * 60, 0);
  const missing = per.filter((p) => p.recentMedianSec == null).map((p) => p.reqId);
  const forecastSec = per.reduce(
    (s, p) => s + (p.recentMedianSec ?? settings.targets[p.reqId] * 60),
    0,
  );
  const timed = attempts.filter((a) => a.examOffsetSec != null && a.targetSec > 0);
  const ratio = (xs: Attempt[]) =>
    xs.length ? xs.reduce((s, a) => s + a.durationSec / a.targetSec, 0) / xs.length : null;
  const half = examSec / 2;
  const weakest = per
    .filter((p) => p.recentMedianSec != null)
    .map((p) => ({
      reqId: p.reqId,
      overrunPct: (100 * (p.recentMedianSec! - settings.targets[p.reqId] * 60)) / (settings.targets[p.reqId] * 60),
    }))
    .sort((a, b) => b.overrunPct - a.overrunPct);
  return {
    per,
    forecastSec,
    examSec,
    missing,
    fatigue: {
      early: ratio(timed.filter((a) => a.examOffsetSec! < half)),
      late: ratio(timed.filter((a) => a.examOffsetSec! >= half)),
    },
    weakest,
  };
}

export interface CriterionStats {
  id: string;
  name: string;
  rated: number;
  c: number;
  mc: number;
  nc: number;
  /** Fails in the last 5 rated attempts. */
  recentNc: number;
}

/** How often each checklist criterion was OK, minimally competent or failed. */
export function criteriaStats(attempts: Attempt[], reqId: ReqId, criteria: Criterion[]): CriterionStats[] {
  const list = attempts.filter((a) => a.reqId === reqId && Object.keys(a.ratings ?? {}).length).sort(byDate);
  const recent = list.slice(-5);
  return criteria.map((cr) => {
    const r = list.map((a) => a.ratings[cr.id]).filter(Boolean);
    return {
      id: cr.id,
      name: cr.name,
      rated: r.length,
      c: r.filter((g) => g === 'C').length,
      mc: r.filter((g) => g === 'MC').length,
      nc: r.filter((g) => g === 'NC').length,
      recentNc: recent.filter((a) => a.ratings[cr.id] === 'NC').length,
    };
  });
}
