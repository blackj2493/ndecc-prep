import type { ActiveRun, Attempt, ReqId, RunItem, RunRecord, Settings } from './types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export interface PlanItem {
  reqId: ReqId;
  tooth: string;
  surface: string;
  targetMin: number;
}

export function createRun(
  kind: ActiveRun['kind'],
  title: string,
  plan: PlanItem[],
  settings: Settings,
  setId?: string,
): ActiveRun {
  return {
    id: uid(),
    kind,
    title,
    setId,
    items: plan.map((p, i) => ({
      key: `${i}-${p.reqId}`,
      reqId: p.reqId,
      tooth: p.tooth,
      surface: p.surface,
      targetSec: Math.round(p.targetMin * 60),
      status: 'pending',
      activeMs: 0,
      repeats: 0,
    })),
    currentKey: null,
    phase: 'ready',
    segStart: null,
    // A single project or a custom campaign runs as one open session.
    sessions:
      kind === 'mock'
        ? settings.sessions
        : [{ name: 'Session', minutes: Math.max(1, plan.reduce((s, p) => s + p.targetMin, 0)) }],
    breakMinutes: settings.breakMinutes,
    sessionIndex: 0,
    sessionMs: 0,
    examMs: 0,
    breakStartedAt: null,
    startedAt: null,
    firedAlerts: [],
    alertCfg: {
      projectWarnings: settings.projectWarnings,
      halfwayAlert: settings.halfwayAlert,
      endAlert: settings.endAlert,
      sessionWarnings: kind === 'mock' ? settings.sessionWarnings : [],
    },
  };
}

const running = (run: ActiveRun, now: number) =>
  run.phase === 'running' && run.segStart != null ? now - run.segStart : 0;

export const currentItem = (run: ActiveRun) => run.items.find((i) => i.key === run.currentKey);

export const itemElapsedMs = (run: ActiveRun, item: RunItem, now: number) =>
  item.activeMs + (item.key === run.currentKey ? running(run, now) : 0);

export const sessionElapsedMs = (run: ActiveRun, now: number) => run.sessionMs + running(run, now);
export const examElapsedMs = (run: ActiveRun, now: number) => run.examMs + running(run, now);
export const sessionLengthMs = (run: ActiveRun) =>
  (run.sessions[Math.min(run.sessionIndex, run.sessions.length - 1)]?.minutes ?? 0) * 60000;

/** Moves the time of the open segment into the accumulators. */
function fold(run: ActiveRun, now: number): ActiveRun {
  const d = running(run, now);
  if (!d) return { ...run, segStart: null };
  return {
    ...run,
    segStart: null,
    sessionMs: run.sessionMs + d,
    examMs: run.examMs + d,
    items: run.items.map((i) => (i.key === run.currentKey ? { ...i, activeMs: i.activeMs + d } : i)),
  };
}

/** Makes the next pending item active, or finishes the run. */
function advance(run: ActiveRun, now: number): ActiveRun {
  const next = run.items.find((i) => i.status === 'pending');
  if (!next) return { ...run, currentKey: null, phase: 'finished', segStart: null };
  return {
    ...run,
    currentKey: next.key,
    phase: 'running',
    segStart: now,
    items: run.items.map((i) =>
      i.key === next.key
        ? { ...i, status: 'active', startedAt: i.startedAt ?? now, examOffsetMs: i.examOffsetMs ?? run.examMs }
        : i,
    ),
  };
}

export function startRun(run: ActiveRun, now: number): ActiveRun {
  return advance({ ...run, startedAt: now }, now);
}

export function pauseRun(run: ActiveRun, now: number): ActiveRun {
  if (run.phase !== 'running') return run;
  return { ...fold(run, now), phase: 'paused' };
}

export function resumeRun(run: ActiveRun, now: number): ActiveRun {
  if (run.phase !== 'paused') return run;
  return { ...run, phase: 'running', segStart: now };
}

function closeCurrent(run: ActiveRun, now: number, status: 'done' | 'skipped'): ActiveRun {
  const folded = fold(run, now);
  const items = folded.items.map((i) => (i.key === run.currentKey ? { ...i, status } : i));
  const wasPaused = run.phase === 'paused';
  const next = advance({ ...folded, items }, now);
  // Finishing a project while paused keeps the clock stopped.
  return wasPaused && next.phase === 'running' ? { ...next, phase: 'paused', segStart: null } : next;
}

export const completeCurrent = (run: ActiveRun, now: number) => closeCurrent(run, now, 'done');
export const skipCurrent = (run: ActiveRun, now: number) => closeCurrent(run, now, 'skipped');

/** Puts the current project at the end of the queue. Its time so far is kept. */
export function doLater(run: ActiveRun, now: number): ActiveRun {
  const pending = run.items.filter((i) => i.status === 'pending');
  if (!pending.length) return run;
  const folded = fold(run, now);
  const cur = folded.items.find((i) => i.key === run.currentKey)!;
  const rest = folded.items.filter((i) => i.key !== run.currentKey);
  const items = [...rest, { ...cur, status: 'pending' as const }];
  const next = advance({ ...folded, items }, now);
  return run.phase === 'paused' ? { ...next, phase: 'paused', segStart: null } : next;
}

export function markRestart(run: ActiveRun): ActiveRun {
  return {
    ...run,
    items: run.items.map((i) => (i.key === run.currentKey ? { ...i, repeats: i.repeats + 1 } : i)),
  };
}

export function startBreak(run: ActiveRun, now: number): ActiveRun {
  if (run.phase !== 'running' && run.phase !== 'paused') return run;
  return { ...fold(run, now), phase: 'break', breakStartedAt: now };
}

export function endBreak(run: ActiveRun, now: number): ActiveRun {
  if (run.phase !== 'break') return run;
  return {
    ...run,
    phase: 'running',
    segStart: now,
    breakStartedAt: null,
    sessionIndex: Math.min(run.sessionIndex + 1, run.sessions.length - 1),
    sessionMs: 0,
  };
}

export function finishRun(run: ActiveRun, now: number): ActiveRun {
  return { ...fold(run, now), phase: 'finished' };
}

export interface RunAlert {
  id: string;
  at: number;
  title: string;
  body: string;
  final: boolean;
}

const plural = (n: number) => `${n} min`;

/** Every alert for the current state, with its absolute time. Past alerts are included. */
export function computeAlerts(run: ActiveRun, now: number): RunAlert[] {
  const out: RunAlert[] = [];
  const cfg = run.alertCfg;
  if (run.phase === 'running') {
    const item = currentItem(run);
    if (item) {
      const e = itemElapsedMs(run, item, now);
      const target = item.targetSec * 1000;
      const label = `${item.tooth} ${item.surface}`.trim();
      const add = (id: string, t: number, title: string, final = false) =>
        t > 0 &&
        out.push({ id: `${item.key}:${id}`, at: now + (t - e), title, body: label, final });
      const half = item.targetSec / 2;
      const halfText = half >= 120 ? plural(Math.round(half / 60)) : `${Math.round(half)} s`;
      if (cfg.halfwayAlert) add('half', target / 2, `Halfway: ${halfText} left`);
      for (const w of cfg.projectWarnings) add(`w${w}`, target - w * 60000, `${plural(w)} left on this project`);
      if (cfg.endAlert) add('end', target, 'Target time is up', true);
    }
    const len = sessionLengthMs(run);
    const se = sessionElapsedMs(run, now);
    const last = run.sessionIndex >= run.sessions.length - 1;
    const name = run.sessions[run.sessionIndex]?.name ?? 'Session';
    for (const w of cfg.sessionWarnings)
      if (len - w * 60000 > 0)
        out.push({
          id: `s${run.sessionIndex}:w${w}`,
          at: now + (len - w * 60000 - se),
          title: `${plural(w)} left in the ${name.toLowerCase()} session`,
          body: last ? 'The exam ends after this session.' : 'The break comes after this session.',
          final: false,
        });
    if (len > 0)
      out.push({
        id: `s${run.sessionIndex}:end`,
        at: now + (len - se),
        title: last ? 'Exam time is over' : `${name} session is over`,
        body: last ? 'Stop work now.' : 'Start the break.',
        final: true,
      });
  }
  if (run.phase === 'break' && run.breakStartedAt) {
    const end = run.breakStartedAt + run.breakMinutes * 60000;
    if (run.breakMinutes > 5)
      out.push({ id: `b${run.sessionIndex}:w5`, at: end - 5 * 60000, title: '5 min of break left', body: '', final: false });
    out.push({ id: `b${run.sessionIndex}:end`, at: end, title: 'Break is over', body: 'Go back to the clinic.', final: true });
  }
  return out;
}

export function runToRecords(
  run: ActiveRun,
  endedAt: number,
): { record: RunRecord; attempts: Attempt[] } {
  const attempts: Attempt[] = run.items
    .filter((i) => i.status === 'done')
    .map((i, idx) => ({
      id: uid(),
      runId: run.id,
      reqId: i.reqId,
      setId: run.setId,
      tooth: i.tooth,
      surface: i.surface,
      date: new Date(i.startedAt ?? endedAt).toISOString(),
      durationSec: Math.round(i.activeMs / 1000),
      targetSec: i.targetSec,
      examOffsetSec: run.kind === 'mock' && i.examOffsetMs != null ? Math.round(i.examOffsetMs / 1000) : undefined,
      position: idx + 1,
      repeats: i.repeats,
      grade: null,
      ratings: {},
      tags: [],
      notes: '',
      photos: [],
    }));
  return {
    attempts,
    record: {
      id: run.id,
      kind: run.kind,
      title: run.title,
      setId: run.setId,
      startedAt: new Date(run.startedAt ?? endedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      activeSec: Math.round(run.examMs / 1000),
      attemptIds: attempts.map((a) => a.id),
      icErrors: [],
      notes: '',
    },
  };
}
