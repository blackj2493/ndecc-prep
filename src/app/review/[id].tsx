import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';
import { Btn, Card, Chip, Divider, Empty, H, Input, Row, Screen, T, useTheme } from '../../components/ui';
import { REQ_BY_ID } from '../../lib/defaults';
import { deletePhoto } from '../../lib/photos';
import { fmtDate, fmtMin } from '../../lib/stats';
import { useStore } from '../../lib/store';

const GRADE_LABEL = { C: 'Competent', MC: 'Min. competent', NC: 'Not competent' } as const;

export default function Review() {
  const c = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const run = useStore((s) => s.runs.find((r) => r.id === id));
  const attempts = useStore((s) => s.attempts);
  const icTags = useStore((s) => s.icTags);
  const updateRun = useStore((s) => s.updateRun);
  const deleteRun = useStore((s) => s.deleteRun);

  if (!run) return <Empty text="This run no longer exists." />;
  const list = run.attemptIds.map((a) => attempts.find((x) => x.id === a)).filter((a) => !!a);
  const ungraded = list.filter((a) => !a.grade).length;
  const critical = run.icErrors.some((e) => e.startsWith('CRITICAL'));
  const icFail = critical || run.icErrors.length >= 3;
  const toggleIc = (t: string) =>
    updateRun(run.id, {
      icErrors: run.icErrors.includes(t) ? run.icErrors.filter((x) => x !== t) : [...run.icErrors, t],
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: run.title }} />
      <T muted>
        {fmtDate(run.startedAt)} · {list.length} projects · {fmtMin(run.activeSec)} of work
      </T>
      {ungraded > 0 && (
        <Card style={{ backgroundColor: c.chip }}>
          <T>
            Rate the checklist for each project while you still remember the details. {ungraded} project
            {ungraded > 1 ? 's are' : ' is'} not graded yet.
          </T>
        </Card>
      )}

      <H>Projects</H>
      <Card>
        {list.length === 0 && <Empty text="No project was finished in this run." />}
        {list.map((a, i) => (
          <View key={a.id}>
            {i > 0 && <Divider />}
            <Row
              title={`${REQ_BY_ID[a.reqId].short} · ${a.tooth} ${a.surface}`}
              subtitle={[
                `${fmtMin(a.durationSec)} / target ${fmtMin(a.targetSec)}`,
                a.grade ? GRADE_LABEL[a.grade] : 'Not graded',
                a.tags.length ? `${a.tags.length} findings` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
              right={
                <T style={{ color: a.durationSec > a.targetSec ? c.bad : c.good }} weight="600">
                  {a.durationSec > a.targetSec ? '+' : '−'}
                  {fmtMin(Math.abs(a.durationSec - a.targetSec))}
                </T>
              }
              onPress={() => router.push(`/attempt/${a.id}`)}
            />
          </View>
        ))}
      </Card>

      {run.kind === 'mock' && (
        <>
          <H>Infection control and safety</H>
          <Card>
            <T style={{ color: icFail ? c.bad : run.icErrors.length ? c.warn : c.good }} weight="600">
              {run.icErrors.length} errors · {icFail ? 'FAIL (3+ errors or a critical error)' : 'pass (2 allowed per session)'}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {icTags.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  selected={run.icErrors.includes(t)}
                  color={t.startsWith('CRITICAL') ? c.bad : undefined}
                  onPress={() => toggleIc(t)}
                />
              ))}
            </View>
          </Card>
        </>
      )}

      <H>Notes on the whole run</H>
      <Input
        multiline
        value={run.notes}
        onChangeText={(t) => updateRun(run.id, { notes: t })}
        placeholder="Time management, fatigue, setup, what to change next time"
      />

      <Btn
        title="Delete this run"
        kind="plain"
        onPress={() =>
          Alert.alert('Delete this run?', 'Its projects are deleted from the journal too.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                list.forEach((a) => a.photos.forEach(deletePhoto));
                deleteRun(run.id);
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}
