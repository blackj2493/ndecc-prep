import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { CriteriaBars, TagBars, TimeChart } from '../../components/charts';
import { Btn, Card, Divider, Empty, H, Input, Row, Screen, Stat, T } from '../../components/ui';
import { copyForClaude } from '../../lib/export';
import { REQ_BY_ID } from '../../lib/defaults';
import { criteriaStats, fmtDate, fmtMin, median, reqStats } from '../../lib/stats';
import { pickData, useStore } from '../../lib/store';
import type { ReqId } from '../../lib/types';
import { notify } from '../../lib/dialog';
import { Photo } from '../../components/Photo';
import { AnnotatedPhoto, hasNote, pinsOf } from '../../components/PhotoMarks';
import { PhotoViewer } from '../../components/PhotoViewer';

const pct = (n: number | null) => (n == null ? '–' : `${Math.round(n)}%`);

export default function RequirementScreen() {
  const { id } = useLocalSearchParams<{ id: ReqId }>();
  const req = REQ_BY_ID[id];
  const all = useStore((s) => s.attempts);
  const target = useStore((s) => s.settings.targets[id]);
  const notes = useStore((s) => s.reqNotes[id] ?? '');
  const setReqNotes = useStore((s) => s.setReqNotes);
  const criteria = useStore((s) => s.criteria[id]);
  const upsertAttempt = useStore((s) => s.upsertAttempt);
  const [viewing, setViewing] = useState<{ attemptId: string; index: number } | null>(null);
  const attempts = all.filter((a) => a.reqId === id).sort((a, b) => b.date.localeCompare(a.date));
  const feedback = attempts.flatMap((a) =>
    a.photos.map((p, index) => ({ a, p, index, n: a.photoNotes?.[p] })).filter((x) => hasNote(x.n)),
  );
  const viewed = viewing && all.find((a) => a.id === viewing.attemptId);
  const s = reqStats(all, id);

  const teeth = [...new Set(attempts.map((a) => a.tooth).filter(Boolean))].map((tooth) => {
    const list = attempts.filter((a) => a.tooth === tooth);
    return { tooth, n: list.length, med: median(list.map((a) => a.durationSec)) };
  });

  const trend =
    s.trendSec == null ? '–' : `${s.trendSec <= 0 ? '−' : '+'}${fmtMin(Math.abs(s.trendSec))}`;

  return (
    <Screen>
      <Stack.Screen options={{ title: req.short }} />
      <T muted>{req.name}</T>

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
          <Stat label="Attempts" value={String(s.count)} />
          <Stat
            label={`Recent median (target ${target} min)`}
            value={fmtMin(s.recentMedianSec)}
            tone={s.recentMedianSec == null ? undefined : s.recentMedianSec > target * 60 ? 'bad' : 'good'}
          />
          <Stat label="Best" value={fmtMin(s.bestSec)} />
          <Stat label="Trend vs 5 before" value={trend} tone={s.trendSec == null ? undefined : s.trendSec <= 0 ? 'good' : 'bad'} />
          <Stat label="On target" value={pct(s.onTargetPct)} />
          <Stat label={`Pass rate (${s.graded} graded)`} value={pct(s.passPct)} />
          <Stat label="Spread of last 10 (IQR)" value={fmtMin(s.spreadSec)} />
          <Stat label="Restarted" value={String(s.repeats)} tone={s.repeats ? 'warn' : undefined} />
        </View>
      </Card>

      <H>Time per attempt</H>
      <Card>
        <TimeChart attempts={attempts} targetMin={target} />
      </Card>

      <H>Checklist results</H>
      <Card>
        <CriteriaBars stats={criteriaStats(all, id, criteria)} />
      </Card>

      <H>Most frequent findings</H>
      <Card>
        <TagBars tags={s.topTags} />
      </Card>

      <H>My technique notes</H>
      <Input
        multiline
        value={notes}
        onChangeText={(t) => setReqNotes(id, t)}
        placeholder="Your method and reminders, e.g. 'Use the GG drill to open the orifice'"
      />

      {teeth.length > 1 && (
        <>
          <H>By tooth</H>
          <Card>
            {teeth.map((t, i) => (
              <View key={t.tooth}>
                {i > 0 && <Divider />}
                <Row title={`Tooth ${t.tooth}`} subtitle={`${t.n} attempts`} right={<T>{fmtMin(t.med)}</T>} />
              </View>
            ))}
          </Card>
        </>
      )}

      {feedback.length > 0 && (
        <>
          <H>Photo feedback</H>
          <Card>
            {feedback.map(({ a, p, index, n }, i) => (
              <View key={p}>
                {i > 0 && <Divider />}
                <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 8 }}>
                  <Pressable onPress={() => setViewing({ attemptId: a.id, index })}>
                    <AnnotatedPhoto name={p} note={n} size={96} />
                  </Pressable>
                  <Pressable style={{ flex: 1, gap: 2 }} onPress={() => router.push(`/attempt/${a.id}`)}>
                    <T weight="500">{`${fmtDate(a.date)} · ${a.tooth} ${a.surface}`}</T>
                    {n!.caption.trim() !== '' && <T size={14}>{n!.caption.trim()}</T>}
                    {pinsOf(n).map((m, k) =>
                      m.text?.trim() ? (
                        <T key={m.id} muted size={13}>{`${k + 1}. ${m.text.trim()}`}</T>
                      ) : null,
                    )}
                  </Pressable>
                </View>
              </View>
            ))}
          </Card>
          <T muted size={12}>Tap a photo to enlarge it. Tap the text to open the attempt.</T>
        </>
      )}
      {viewed && viewed.photos.length > 0 && (
        <PhotoViewer
          names={viewed.photos}
          start={viewing!.index}
          notes={viewed.photoNotes}
          onChange={(name, fn) => {
            const a = useStore.getState().attempts.find((x) => x.id === viewed.id);
            if (!a) return;
            upsertAttempt({ ...a, photoNotes: { ...a.photoNotes, [name]: fn(a.photoNotes?.[name] ?? { caption: '', marks: [] }) } });
          }}
          onClose={() => setViewing(null)}
        />
      )}

      <H>Journal</H>
      <Card>
        {attempts.length === 0 && <Empty text="No attempts yet." />}
        {attempts.map((a, i) => (
          <View key={a.id}>
            {i > 0 && <Divider />}
            <Row
              title={`${fmtDate(a.date)} · ${a.tooth} ${a.surface} · ${fmtMin(a.durationSec)}`}
              subtitle={[a.tags.join(', '), a.notes].filter(Boolean).join(' — ') || 'No notes'}
              right={
                a.photos[0] ? (
                  <Photo name={a.photos[0]} style={{ width: 40, height: 40, borderRadius: 6 }} />
                ) : undefined
              }
              onPress={() => router.push(`/attempt/${a.id}`)}
            />
          </View>
        ))}
      </Card>

      <Btn
        title="Log an attempt"
        kind="secondary"
        icon="plus"
        onPress={() => router.push({ pathname: '/attempt/[id]', params: { id: 'new', reqId: id } })}
      />
      <Btn
        title="Copy for Claude"
        kind="plain"
        icon="doc.on.doc"
        onPress={async () => {
          await copyForClaude(pickData(useStore.getState()), id);
          notify('Copied', 'Open the Claude app and paste it into a new chat.');
        }}
      />
    </Screen>
  );
}
