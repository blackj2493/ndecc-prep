import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Btn, Card, Divider, Empty, H, Row, Screen, Stat, T, useTheme } from '../../components/ui';
import { REQ_BY_ID } from '../../lib/defaults';
import { copyForClaude } from '../../lib/export';
import { fmtMin, overview } from '../../lib/stats';
import { pickData, useStore } from '../../lib/store';

export default function Insights() {
  const c = useTheme();
  const attempts = useStore((s) => s.attempts);
  const settings = useStore((s) => s.settings);
  const runs = useStore((s) => s.runs);
  const ov = overview(attempts, settings);
  const spare = ov.examSec - ov.forecastSec;
  const mocks = runs.filter((r) => r.kind === 'mock');
  const icAvg = mocks.length ? mocks.reduce((s, r) => s + r.icErrors.length, 0) / mocks.length : null;
  const allTags = new Map<string, number>();
  for (const a of attempts) for (const t of a.tags) allTags.set(`${REQ_BY_ID[a.reqId].short}: ${t}`, (allTags.get(`${REQ_BY_ID[a.reqId].short}: ${t}`) ?? 0) + 1);
  const topMistakes = [...allTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const ratio = (r: number | null) => (r == null ? '–' : `${Math.round(r * 100)}%`);

  if (!attempts.length)
    return (
      <Screen>
        <Empty text="Insights appear after you log your first projects." />
      </Screen>
    );

  return (
    <Screen>
      <H>Exam readiness</H>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
          <Stat label="Forecast for a full set" value={fmtMin(ov.forecastSec)} />
          <Stat
            label={`Spare of ${fmtMin(ov.examSec)}`}
            value={(spare < 0 ? '−' : '') + fmtMin(Math.abs(spare))}
            tone={spare < 0 ? 'bad' : spare < 3600 ? 'warn' : 'good'}
          />
          <Stat label="Mock runs" value={String(mocks.length)} />
          <Stat label="Infection control errors per mock" value={icAvg == null ? '–' : icAvg.toFixed(1)} tone={icAvg != null && icAvg >= 2 ? 'bad' : undefined} />
        </View>
        <T muted size={12}>
          The forecast adds the median of your last 5 attempts for each requirement.
          {ov.missing.length
            ? ` No data yet for ${ov.missing.map((m) => REQ_BY_ID[m].short).join(', ')}; the forecast uses the target for them.`
            : ''}
        </T>
      </Card>

      <H>Slowest against target</H>
      <Card>
        {ov.weakest.map((w, i) => (
          <View key={w.reqId}>
            {i > 0 && <Divider />}
            <Row
              title={REQ_BY_ID[w.reqId].short}
              subtitle={`Recent median ${fmtMin(ov.per.find((p) => p.reqId === w.reqId)?.recentMedianSec)} · target ${settings.targets[w.reqId]} min`}
              right={
                <T weight="600" style={{ color: w.overrunPct > 0 ? c.bad : c.good }}>
                  {w.overrunPct > 0 ? '+' : ''}
                  {Math.round(w.overrunPct)}%
                </T>
              }
              onPress={() => router.push(`/requirement/${w.reqId}`)}
            />
          </View>
        ))}
      </Card>

      <H>Fatigue</H>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
          <Stat label="Time used vs target, first half of mock" value={ratio(ov.fatigue.early)} />
          <Stat
            label="Time used vs target, second half"
            value={ratio(ov.fatigue.late)}
            tone={
              ov.fatigue.early != null && ov.fatigue.late != null && ov.fatigue.late > ov.fatigue.early * 1.1
                ? 'bad'
                : undefined
            }
          />
        </View>
        <T muted size={12}>
          100% = exactly on target. If the second half is clearly higher, you slow down late in the day.
        </T>
      </Card>

      <H>Most frequent mistakes</H>
      <Card>
        {topMistakes.length === 0 && <Empty text="No mistakes logged yet." />}
        {topMistakes.map(([t, n], i) => (
          <View key={t}>
            {i > 0 && <Divider />}
            <Row title={t} right={<T weight="600">{n}×</T>} />
          </View>
        ))}
      </Card>

      <H>AI analysis</H>
      <Card>
        <T size={14}>
          Copy your full log with an analysis prompt. Then paste it into a new chat in the Claude app. Your Max plan
          covers it.
        </T>
        <Btn
          title="Copy for Claude"
          icon="doc.on.doc"
          onPress={async () => {
            await copyForClaude(pickData(useStore.getState()));
            Alert.alert('Copied', 'Open the Claude app and paste it into a new chat.');
          }}
        />
      </Card>
    </Screen>
  );
}
