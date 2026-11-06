import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { GradeChip, Tile } from '../../components/progress';
import { Card, Divider, Empty, H, Screen, T, useTheme } from '../../components/ui';
import { REQ_BY_ID } from '../../lib/defaults';
import { dayKey, findings, keyDate, periodStats, vsUsual } from '../../lib/progress';
import { fmtMin } from '../../lib/stats';
import { useStore } from '../../lib/store';
import type { Attempt } from '../../lib/types';

export default function DayScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const all = useStore((s) => s.attempts);
  const sets = useStore((s) => s.sets);
  const runs = useStore((s) => s.runs);
  const list = all.filter((a) => dayKey(a.date) === key).sort((a, b) => a.date.localeCompare(b.date));
  const title = keyDate(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const st = periodStats(list);
  const found = findings(list);
  const compare = list
    .map((a) => ({ a, d: vsUsual(all, a) }))
    .filter((x): x is { a: Attempt; d: number } => x.d != null);
  const mocks = [...new Set(list.map((a) => runs.find((r) => r.id === a.runId)).filter((r) => r?.kind === 'mock').map((r) => r!.title))];

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      {list.length === 0 ? (
        <Card>
          <Empty text="No projects on this day." />
        </Card>
      ) : (
        <>
          {mocks.length > 0 && <T muted>Mock exam: {mocks.join(', ')}</T>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Tile label="Projects" value={String(st.projects)} />
            <Tile label="Practice time" value={fmtMin(st.sec)} />
            <Tile label="Passed" value={st.graded ? `${st.passed} of ${st.graded}` : '–'} sub={st.graded < st.projects ? `${st.projects - st.graded} not graded` : undefined} />
            <Tile label="On target time" value={st.timed ? `${st.onTarget} of ${st.timed}` : '–'} />
          </View>

          <H>Projects that day</H>
          <Card style={{ paddingVertical: 4 }}>
            {list.map((a, i) => (
              <View key={a.id}>
                {i > 0 && <Divider />}
                <ProjectRow a={a} setName={sets.find((s) => s.id === a.setId)?.name} />
              </View>
            ))}
          </Card>
          <T muted size={12}>
            The black tick on each bar = your target time. A bar past the tick = over target. Tap a project to open it.
          </T>

          {compare.length > 0 && (
            <>
              <H>Compared with your usual</H>
              <Card style={{ paddingVertical: 4 }}>
                {compare.map(({ a, d }, i) => (
                  <View key={a.id}>
                    {i > 0 && <Divider />}
                    <CompareRow a={a} diff={d} />
                  </View>
                ))}
              </Card>
              <T muted size={12}>
                “Usual” = the median time of your previous 5 attempts of that requirement.
              </T>
            </>
          )}

          {found.length > 0 && (
            <>
              <H>Findings that day</H>
              <Card>
                {found.map((f) => (
                  <T key={f.tag} size={15}>
                    {f.tag} — <T size={15} weight="700">{`${f.count}×`}</T>
                  </T>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

function ProjectRow({ a, setName }: { a: Attempt; setName?: string }) {
  const c = useTheme();
  const over = a.targetSec > 0 && a.durationSec > a.targetSec;
  // The target sits at 75 % of the bar, so up to a third over target still fits.
  const fill = a.targetSec > 0 ? Math.min(a.durationSec / a.targetSec, 4 / 3) * 75 : 0;
  const time = new Date(a.date).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const photos = a.photos.length ? `${a.photos.length} ${a.photos.length === 1 ? 'photo' : 'photos'}` : '';
  return (
    <Pressable
      onPress={() => router.push(`/attempt/${a.id}`)}
      style={({ pressed }) => ({ gap: 8, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T weight="600" style={{ flex: 1 }}>
          {`${REQ_BY_ID[a.reqId].short}${a.tooth ? ' · ' + a.tooth : ''}${a.surface ? ' ' + a.surface : ''}`}
        </T>
        <GradeChip grade={a.grade} />
      </View>
      {a.targetSec > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c.border }}>
            <View style={{ width: `${fill}%`, height: 8, borderRadius: 4, backgroundColor: over ? c.warn : c.accent }} />
            <View style={{ position: 'absolute', left: '75%', top: -3, width: 2, height: 14, backgroundColor: c.text }} />
          </View>
          <T size={13} style={{ width: 112, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
            {`${Math.round(a.durationSec / 60)} of ${Math.round(a.targetSec / 60)} min`}
          </T>
        </View>
      )}
      <T muted size={13}>
        {[time, setName, photos, a.tags[0]].filter(Boolean).join(' · ')}
      </T>
    </Pressable>
  );
}

function CompareRow({ a, diff }: { a: Attempt; diff: number }) {
  const c = useTheme();
  const m = Math.round(Math.abs(diff) / 60);
  const text = m < 1 ? 'same' : `${m} min ${diff < 0 ? 'faster' : 'slower'}`;
  const color = m < 1 ? c.muted : diff < 0 ? c.good : c.bad;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, gap: 8 }}>
      <T size={15} style={{ flex: 1 }}>
        {`${REQ_BY_ID[a.reqId].short}${a.tooth ? ' · ' + a.tooth : ''}`}
      </T>
      <T size={15} weight="600" style={{ color }}>
        {text}
      </T>
    </View>
  );
}
