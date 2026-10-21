import assert from 'node:assert/strict';
import { DEFAULT_SETS, DEFAULT_SETTINGS } from '../src/lib/defaults';
import * as R from '../src/lib/run';
import { overview, reqStats } from '../src/lib/stats';

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
console.log('all run/stat checks passed; forecast', ov.forecastSec / 60, 'min');
