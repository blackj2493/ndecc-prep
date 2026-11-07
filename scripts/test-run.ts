import assert from 'node:assert/strict';
import { DEFAULT_SETS, DEFAULT_SETTINGS } from '../src/lib/defaults';
import * as R from '../src/lib/run';
import { DEFAULT_CRITERIA, overallGrade, withUndercut } from '../src/lib/criteria';
import { criteriaStats, overview, reqStats } from '../src/lib/stats';
import * as P from '../src/lib/progress';
import type { Attempt } from '../src/lib/types';

const M = 60000;
const set = DEFAULT_SETS[0];
const plan = DEFAULT_SETTINGS.sequence.map((id) => ({ reqId: id, ...set.teeth[id], targetMin: DEFAULT_SETTINGS.targets[id] }));
let run = R.createRun('mock', 'Set 1 mock', plan, DEFAULT_SETTINGS, set.id);
let t = 1_000_000;
run = R.startRun(run, t);
assert.equal(R.currentItem(run)!.reqId, 'amalgam');

// Alerts for the first project: halfway (20), 10 left (30), 2 left (38), end (40) + session 30/10/end.
const al = R.computeAlerts(run, t).filter((a) => !a.id.startsWith('s'));
assert.deepEqual(al.map((a) => (a.at - t) / M).sort((a, b) => a - b), [20, 30, 38, 40]);

// Pause 5 min after 10 min: the project time stops.
run = R.pauseRun(run, t + 10 * M);
run = R.resumeRun(run, t + 15 * M);
assert.equal(R.itemElapsedMs(run, R.currentItem(run)!, t + 20 * M), 15 * M);
// After the pause the halfway alert moves 5 min later.
assert.equal(R.computeAlerts(run, t + 20 * M).find((a) => a.id.endsWith(':half'))!.at, t + 25 * M);

run = R.completeCurrent(run, t + 50 * M); // amalgam took 45 min
assert.equal(run.items[0].activeMs, 45 * M);
assert.equal(R.currentItem(run)!.reqId, 'class2');
assert.equal(R.currentItem(run)!.examOffsetMs, 45 * M);

// Do later moves class2 to the end, keeps its 10 min.
run = R.doLater(run, t + 60 * M);
assert.equal(R.currentItem(run)!.reqId, 'class4');
assert.equal(run.items[run.items.length - 1].reqId, 'class2');
assert.equal(run.items[run.items.length - 1].activeMs, 10 * M);

// Break: session clock stops, then a new session starts at zero.
run = R.startBreak(run, t + 70 * M);
assert.equal(run.phase, 'break');
assert.ok(R.computeAlerts(run, t + 70 * M).some((a) => a.title === 'Break is over' && a.at === t + 100 * M));
run = R.endBreak(run, t + 100 * M);
assert.equal(run.sessionIndex, 1);
assert.equal(R.sessionElapsedMs(run, t + 110 * M), 10 * M);
assert.equal(R.itemElapsedMs(run, R.currentItem(run)!, t + 110 * M), 20 * M);

// Finish everything.
let n = t + 110 * M;
while (run.phase !== 'finished') { n += 30 * M; run = R.completeCurrent(run, n); }
const { record, attempts } = R.runToRecords(run, n);
assert.equal(attempts.length, 7);
assert.equal(attempts.find((a) => a.reqId === 'class2')!.durationSec, 40 * 60);
assert.equal(record.activeSec, Math.round(run.examMs / 1000));

const st = reqStats(attempts, 'amalgam');
assert.equal(st.medianSec, 45 * 60);
const ov = overview(attempts, DEFAULT_SETTINGS);
assert.equal(ov.examSec, 480 * 60);
// Checklist: the grade is the worst rating.
assert.equal(overallGrade({}), null);
assert.equal(overallGrade({ margin: 'C', contact: 'C' }), 'C');
assert.equal(overallGrade({ margin: 'C', contact: 'MC' }), 'MC');
assert.equal(overallGrade({ margin: 'NC', contact: 'MC' }), 'NC');
for (const [req, list] of Object.entries(DEFAULT_CRITERIA)) {
  const ids = list.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, `duplicate criterion id in ${req}`);
  assert.ok(ids.includes('critical') && ids.includes('damage'), `${req} lacks critical/damage`);
}
const rated = attempts.map((a, i) => (a.reqId === 'mod' ? { ...a, ratings: { depth: 'NC' as const, width: 'C' as const } } : a));
const cs = criteriaStats(rated, 'mod', DEFAULT_CRITERIA.mod);
assert.equal(cs.find((x) => x.id === 'depth')!.nc, 1);
assert.equal(cs.find((x) => x.id === 'width')!.c, 1);
assert.equal(cs.find((x) => x.id === 'boxSeat')!.rated, 0);

// Progress: days, weeks, sets and teeth.
{
  const mk = (id: string, date: Date, extra: Partial<Attempt> = {}): Attempt => ({
    id, reqId: 'amalgam', tooth: '2.7', surface: '', date: date.toISOString(), durationSec: 30 * 60, targetSec: 40 * 60,
    repeats: 0, grade: 'C', ratings: {}, tags: [], notes: '', photos: [], ...extra,
  });
  const now = new Date(2026, 10, 5, 15, 0); // Thu Nov 5 2026, 3 pm local
  const at = (d: number, h = 10) => new Date(2026, 10, d, h, 0);
  const list = [
    mk('a', at(2), { setId: 'set1' }),
    mk('b', at(3, 21), { setId: 'set1', grade: 'NC', durationSec: 50 * 60 }), // late evening stays on Nov 3
    mk('c', at(4), { setId: 'set2', reqId: 'endo', tooth: '36', grade: 'MC' }),
    mk('d', at(5), { tooth: '27', grade: null }), // no set; typed "27"
    mk('e', new Date(2026, 9, 28, 9), { setId: 'set1', grade: 'NC' }), // last week (Wed Oct 28)
  ];
  assert.equal(P.dayKey(at(3, 21)), '2026-11-03');
  assert.equal(P.dayKey(P.weekStart(now)), '2026-11-02');
  const wc = P.weekCompare(list, now);
  assert.equal(wc.thisWeek.projects, 4);
  assert.equal(wc.thisWeek.graded, 3);
  assert.equal(wc.thisWeek.passed, 2);
  assert.equal(wc.thisWeek.onTarget, 3);
  assert.equal(wc.lastWeek.projects, 1);
  const cal = P.calendar(list, now, 8);
  assert.equal(cal.length, 56);
  assert.equal(cal[0].key, '2026-09-14');
  assert.equal(cal.find((d) => d.today)!.key, '2026-11-05');
  assert.equal(cal.filter((d) => d.future).length, 3);
  assert.equal(cal.find((d) => d.key === '2026-11-03')!.count, 1);
  assert.equal(P.streak(list, now), 4);
  assert.equal(P.streak(list, new Date(2026, 10, 6, 8)), 4); // nothing yet today: count from yesterday
  const wk = P.weekly(list, now, 8);
  assert.equal(wk[7].passPct, 67);
  assert.equal(wk[6].passPct, 0);
  assert.equal(wk[0].passPct, null);
  const log = P.dayLog(list);
  assert.deepEqual(log.map((d) => d.key), ['2026-11-05', '2026-11-04', '2026-11-03', '2026-11-02', '2026-10-28']);
  assert.equal(P.vsUsual(list, list[1]), 50 * 60 - 30 * 60); // previous amalgams: 30, 30 min
  assert.equal(P.vsUsual(list, list[4]), null);
  const cov = P.setCoverage(DEFAULT_SETS, list, DEFAULT_SETTINGS.sequence);
  const s1 = cov.find((c) => c.set.id === 'set1')!;
  assert.equal(s1.total, 3);
  assert.equal(s1.done, 1);
  assert.equal(s1.slots.find((x) => x.reqId === 'amalgam')!.count, 3);
  assert.equal(s1.slots.find((x) => x.reqId === 'amalgam')!.last!.id, 'b');
  assert.equal(P.noSetCount(DEFAULT_SETS, list), 1);
  const teeth = P.teethFor('amalgam', DEFAULT_SETS, list);
  const t27 = teeth.find((t) => t.tooth === '2.7')!;
  assert.equal(t27.count, 4); // 3 as "2.7" + 1 typed as "27"
  assert.deepEqual(t27.sets, ['Set 1', 'Set 2']);
  assert.ok(teeth.some((t) => t.tooth === '4.5' && t.count === 0)); // in Set 3, not done
  assert.equal(P.teethFor('endo', DEFAULT_SETS, list).find((t) => t.tooth === '3.6')!.count, 1);
}
// Undercut criterion: in the defaults, and added once to an old saved checklist after "Path of draw".
{
  const ids = (l: { id: string }[]) => l.map((x) => x.id);
  assert.equal(ids(DEFAULT_CRITERIA.crownPrep).filter((i) => i === 'undercut').length, 1);
  const old = { ...DEFAULT_CRITERIA, crownPrep: DEFAULT_CRITERIA.crownPrep.filter((x) => x.id !== 'undercut').map((x) => (x.id === 'taper' ? { ...x, details: [...x.details, 'Mine'] } : x)) };
  const up = withUndercut(old);
  assert.deepEqual(ids(up.crownPrep).slice(0, 3), ['taper', 'path', 'undercut']);
  assert.ok(up.crownPrep[0].details.includes('Mine'));
  assert.equal(up.mod, old.mod);
  assert.equal(withUndercut(up), up);
}

console.log('all run/stat/checklist/progress checks passed; forecast', ov.forecastSec / 60, 'min');
