import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '../../components/Icon';
import {
  GradeChip,
  PracticeCalendar,
  REQ_CHIP,
  Segmented,
  Tile,
  useShades,
  WeekChart,
} from '../../components/progress';
import { Btn, Card, Divider, Empty, H, Screen, T, useTheme } from '../../components/ui';
import { REQ_BY_ID } from '../../lib/defaults';
import {
  calendar,
  dayKey,
  dayLog,
  GRADE_SHORT,
  keyDate,
  noSetCount,
  pct,
  setCoverage,
  streak,
  teethFor,
  weekCompare,
  weekly,
  type DayEntry,
  type SetStats,
} from '../../lib/progress';
import { fmtDate, fmtMin } from '../../lib/stats';
import { useStore } from '../../lib/store';

type View_ = 'days' | 'sets';

export default function Progress() {
  const [view, setView] = useState<View_>('days');
  const attempts = useStore((s) => s.attempts);
  return (
    <Screen>
      <Segmented
        options={[
          { key: 'days', label: 'Days' },
          { key: 'sets', label: 'Sets & teeth' },
        ]}
        value={view}
        onChange={setView}
      />
      {attempts.length === 0 ? (
        <Card>
          <Empty text="Your progress appears here after your first project." />
        </Card>
      ) : view === 'days' ? (
        <Days />
      ) : (
        <SetsAndTeeth />
      )}
    </Screen>
  );
}

/** "Thu Nov 5" for a day key. */
export const dayTitle = (key: string) =>
  keyDate(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function Days() {
  const attempts = useStore((s) => s.attempts);
  const runs = useStore((s) => s.runs);
  const [shown, setShown] = useState(10);
  const now = new Date();
  const { thisWeek: tw, lastWeek: lw } = weekCompare(attempts, now);
  const twPass = pct(tw.passed, tw.graded);
  const lwPass = pct(lw.passed, lw.graded);
  const twOn = pct(tw.onTarget, tw.timed);
  const lwOn = pct(lw.onTarget, lw.timed);
  const days = dayLog(attempts, runs);
  const cal = calendar(attempts, now, 8);
  const first = cal[0].key;
  const practiceDays = days.filter((d) => d.key >= first && d.key <= dayKey(now)).length;
  const run = streak(attempts, now);
  const toneOf = (a: number | null, b: number | null) => (a == null || b == null || a === b ? undefined : a > b ? 'good' : 'warn');
  const fmtPct = (n: number | null) => (n == null ? '–' : `${n}%`);

  return (
    <>
      <H>This week vs last week</H>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Tile label="Projects" value={String(tw.projects)} sub={`last week ${lw.projects}`} />
        <Tile label="Practice time" value={fmtMin(tw.sec)} sub={`last week ${fmtMin(lw.sec)}`} />
        <Tile
          label="Pass rate (OK + MC)"
          value={fmtPct(twPass)}
          sub={`last week ${fmtPct(lwPass)}`}
          tone={toneOf(twPass, lwPass)}
        />
        <Tile label="On target time" value={fmtPct(twOn)} sub={`last week ${fmtPct(lwOn)}`} tone={toneOf(twOn, lwOn)} />
      </View>
      <T muted size={12}>
        A week starts on Monday. The pass rate counts graded projects only.
      </T>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T weight="600">Practice calendar</T>
          <T muted size={13}>
            last 8 weeks
          </T>
        </View>
        <PracticeCalendar days={cal} onDay={(k) => router.push(`/day/${k}`)} />
        <T size={13}>
          {run > 0 ? `${run}-day streak · ` : ''}
          {practiceDays} practice {practiceDays === 1 ? 'day' : 'days'} in 8 weeks. Tap a day to open it.
        </T>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T weight="600">Week by week</T>
          <T muted size={13}>
            all requirements
          </T>
        </View>
        <WeekChart weeks={weekly(attempts, now, 8)} />
      </Card>

      <H>Day by day</H>
      <Card style={{ paddingVertical: 4 }}>
        {days.slice(0, shown).map((d, i) => (
          <View key={d.key}>
            {i > 0 && <Divider />}
            <DayRow d={d} today={d.key === dayKey(now)} />
          </View>
        ))}
        {days.length > shown && (
          <Btn title="Show older days" kind="plain" onPress={() => setShown((n) => n + 10)} />
        )}
      </Card>
      <T muted size={12}>
        Each chip = one project and its grade. Tap a day to see its projects.
      </T>
    </>
  );
}

function DayRow({ d, today }: { d: DayEntry; today: boolean }) {
  const c = useTheme();
  const parts = [
    today ? 'today' : '',
    d.mocks.length ? 'Mock exam' : '',
    `${d.stats.projects} ${d.stats.projects === 1 ? 'project' : 'projects'}`,
    fmtMin(d.stats.sec),
  ].filter(Boolean);
  return (
    <Pressable
      onPress={() => router.push(`/day/${d.key}`)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <T weight="600">{dayTitle(d.key)}</T>
          <T muted size={13}>
            {parts.join(' · ')}
          </T>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {d.attempts.map((a) => (
            <GradeChip
              key={a.id}
              grade={a.grade}
              label={`${REQ_CHIP[a.reqId]}${a.tooth ? ' ' + a.tooth : ''} · ${a.grade ? GRADE_SHORT[a.grade] : '–'}`}
            />
          ))}
        </View>
      </View>
      <Icon name="chevron.right" color={c.muted} size={14} />
    </Pressable>
  );
}

function SetsAndTeeth() {
  const [sub, setSub] = useState<'set' | 'req'>('set');
  return (
    <>
      <Segmented
        options={[
          { key: 'set', label: 'By set' },
          { key: 'req', label: 'By type of project' },
        ]}
        value={sub}
        onChange={setSub}
      />
      {sub === 'set' ? <BySet /> : <ByRequirement />}
    </>
  );
}

function BySet() {
  const c = useTheme();
  const sets = useStore((s) => s.sets);
  const attempts = useStore((s) => s.attempts);
  const order = useStore((s) => s.settings.sequence);
  const cov = setCoverage(sets, attempts, order);
  const [open, setOpen] = useState<Record<string, boolean>>(() => (cov[0] ? { [cov[0].set.id]: true } : {}));
  const shades = useShades();
  const none = noSetCount(sets, attempts);
  if (!sets.length) return <Empty text="You have no practice sets. Add them in Setup." />;
  return (
    <>
      <T muted size={13}>
        Each row = one project slot of the set. The number = how many times you did that slot with this set.
      </T>
      {cov.map((s) => (
        <SetCard
          key={s.set.id}
          s={s}
          open={!!open[s.set.id]}
          onToggle={() => setOpen((o) => ({ ...o, [s.set.id]: !o[s.set.id] }))}
        />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <T muted size={12}>
          Bar = one block per slot:
        </T>
        <View style={{ width: 14, height: 8, borderRadius: 2, borderWidth: 1, borderStyle: 'dashed', borderColor: c.warn }} />
        <T muted size={12}>
          not done
        </T>
        <View style={{ width: 14, height: 8, borderRadius: 2, backgroundColor: shades[1] }} />
        <T muted size={12}>
          1–2×
        </T>
        <View style={{ width: 14, height: 8, borderRadius: 2, backgroundColor: shades[3] }} />
        <T muted size={12}>
          3× or more
        </T>
      </View>
      {none > 0 && (
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T>Projects with no set</T>
          <T weight="600">{none}</T>
        </Card>
      )}
    </>
  );
}

function SetCard({ s, open, onToggle }: { s: SetStats; open: boolean; onToggle: () => void }) {
  const c = useTheme();
  const shades = useShades();
  const n = s.slots.length;
  const status = s.done === n ? `all ${n} done` : `${s.done} of ${n} done`;
  return (
    <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={onToggle}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({ padding: 14, gap: 8, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <T size={17} weight="700">
            {s.set.name}
          </T>
          <T muted size={13} style={{ flex: 1 }}>
            {s.total ? `${s.total} ${s.total === 1 ? 'project' : 'projects'}` : 'not started'}
          </T>
          <T size={13} weight="600" style={{ color: s.done === n ? c.good : c.warn }}>
            {status}
          </T>
          <Icon name={open ? 'chevron.up' : 'chevron.down'} color={c.muted} size={14} />
        </View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {s.slots.map((b) => (
            <View
              key={b.reqId}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 2,
                backgroundColor: b.count === 0 ? 'transparent' : b.count <= 2 ? shades[1] : shades[3],
                borderWidth: b.count === 0 ? 1 : 0,
                borderStyle: 'dashed',
                borderColor: c.warn,
              }}
            />
          ))}
        </View>
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
          {s.slots.map((b) => (
            <View key={b.reqId}>
              <Divider />
              <Pressable
                disabled={!b.last}
                onPress={() => b.last && router.push(`/attempt/${b.last.id}`)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <T weight="600" size={15}>
                    {REQ_BY_ID[b.reqId].short}
                  </T>
                  <T muted size={13}>
                    {`Tooth ${b.tooth || '–'}${b.surface ? ' ' + b.surface : ''} · ${b.last ? 'last ' + fmtDate(b.last.date) : 'not done yet'}`}
                  </T>
                </View>
                {b.last && <GradeChip grade={b.last.grade} />}
                <T
                  size={15}
                  weight="700"
                  style={{ width: 34, textAlign: 'right', fontVariant: ['tabular-nums'], color: b.count ? c.text : c.warn }}
                >
                  {b.count ? `${b.count}×` : '0'}
                </T>
              </Pressable>
            </View>
          ))}
          <T muted size={12} style={{ paddingVertical: 8 }}>
            Tap a slot to open its last attempt.
          </T>
        </View>
      )}
    </Card>
  );
}

/** "set 1, 3" for ["Set 1", "Set 3"]; other names in full; "no set" when empty. */
const setNames = (names: string[]) =>
  !names.length
    ? 'no set'
    : names.every((n) => /^Set \d+$/.test(n))
      ? 'set ' + names.map((n) => n.slice(4)).join(', ')
      : names.join(', ');

function ByRequirement() {
  const c = useTheme();
  const sets = useStore((s) => s.sets);
  const attempts = useStore((s) => s.attempts);
  const order = useStore((s) => s.settings.sequence);
  return (
    <>
      <T muted size={13}>
        Every tooth you did for each type of project. Dashed = a tooth in your sets that you did not do yet.
      </T>
      {order.map((reqId) => {
        const teeth = teethFor(reqId, sets, attempts);
        const total = attempts.filter((a) => a.reqId === reqId).length;
        return (
          <Pressable key={reqId} onPress={() => router.push(`/requirement/${reqId}`)}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <T weight="600">{REQ_BY_ID[reqId].short}</T>
                <T muted size={14}>
                  {total} done
                </T>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {teeth.length === 0 && (
                  <T muted size={13}>
                    No teeth yet.
                  </T>
                )}
                {teeth.map((t) => (
                  <View
                    key={t.tooth}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'baseline',
                      gap: 3,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: t.count ? c.chip : 'transparent',
                      borderWidth: t.count ? 0 : 1,
                      borderStyle: 'dashed',
                      borderColor: c.warn,
                    }}
                  >
                    <T size={13} weight="700" style={{ color: t.count ? c.text : c.warn }}>
                      {t.tooth}
                    </T>
                    <T size={13} style={{ color: t.count ? c.text : c.warn }}>
                      ×{t.count}
                    </T>
                    <T muted size={11}>
                      {` · ${setNames(t.sets)}`}
                    </T>
                  </View>
                ))}
              </View>
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}
