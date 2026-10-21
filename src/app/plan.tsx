import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Btn, Card, Divider, H, Input, MinutesField, Screen, T, useTheme } from '../components/ui';
import { REQ_BY_ID } from '../lib/defaults';
import { createRun, type PlanItem } from '../lib/run';
import { fmtMin } from '../lib/stats';
import { targetFor, useStore } from '../lib/store';
import type { ReqId } from '../lib/types';

interface Row extends PlanItem {
  include: boolean;
}

export default function Plan() {
  const c = useTheme();
  const { setId, campaignId, reqId } = useLocalSearchParams<{ setId?: string; campaignId?: string; reqId?: ReqId }>();
  const settings = useStore((s) => s.settings);
  const sets = useStore((s) => s.sets);
  const campaigns = useStore((s) => s.campaigns);
  const activeRun = useStore((s) => s.activeRun);
  const setActiveRun = useStore((s) => s.setActiveRun);

  const set = sets.find((s) => s.id === setId);
  const campaign = campaigns.find((x) => x.id === campaignId);
  const kind = set ? 'mock' : campaign ? 'campaign' : 'single';
  const title = set ? `${set.name} mock` : campaign ? campaign.name : reqId ? REQ_BY_ID[reqId].short : '';

  const [rows, setRows] = useState<Row[]>(() => {
    if (set)
      return settings.sequence.map((id) => ({
        reqId: id,
        tooth: set.teeth[id].tooth,
        surface: set.teeth[id].surface,
        targetMin: targetFor(settings, set, id),
        include: true,
      }));
    if (campaign)
      return campaign.items.map((it) => ({
        ...it,
        targetMin: it.targetMin ?? settings.targets[it.reqId],
        include: true,
      }));
    if (reqId) return [{ reqId, tooth: '', surface: '', targetMin: settings.targets[reqId], include: true }];
    return [];
  });

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const included = rows.filter((r) => r.include);
  const totalMin = included.reduce((s, r) => s + r.targetMin, 0);
  const examMin = settings.sessions.reduce((s, x) => s + x.minutes, 0);

  const start = () => {
    const go = () => {
      setActiveRun(createRun(kind, title, included, settings, set?.id));
      router.replace('/run');
    };
    if (activeRun && activeRun.phase !== 'finished')
      Alert.alert('Replace the current run?', `"${activeRun.title}" is not finished. Its times are lost.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: go },
      ]);
    else go();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Card>
        <T>
          Planned: <T weight="700">{fmtMin(totalMin * 60)}</T>
          {kind === 'mock' ? ` of ${fmtMin(examMin * 60)} exam time` : ''}
        </T>
        {kind === 'mock' && totalMin > examMin && (
          <T style={{ color: c.bad }}>Your targets are longer than the exam time.</T>
        )}
        <T muted size={13}>
          Change the order with the arrows. Turn a project off to leave it out of this run. Target changes here
          apply to this run only.
        </T>
      </Card>

      <H>Sequence</H>
      <Card>
        {rows.map((r, i) => (
          <View key={`${r.reqId}-${i}`}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: r.include ? 1 : 0.4 }}>
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => move(i, -1)} hitSlop={8}>
                  <SymbolView name="chevron.up" tintColor={i ? c.accent : c.border} size={18} />
                </Pressable>
                <Pressable onPress={() => move(i, 1)} hitSlop={8}>
                  <SymbolView name="chevron.down" tintColor={i < rows.length - 1 ? c.accent : c.border} size={18} />
                </Pressable>
              </View>
              <Pressable style={{ flex: 1 }} onPress={() => update(i, { include: !r.include })}>
                <T weight="600">
                  {i + 1}. {REQ_BY_ID[r.reqId].short}
                </T>
                <T muted size={14}>
                  {r.tooth ? `Tooth ${r.tooth} ${r.surface}` : 'Tooth not set'}
                  {r.include ? '' : ' · off'}
                </T>
              </Pressable>
              <MinutesField value={r.targetMin} onChange={(n) => update(i, { targetMin: n })} />
            </View>
            {kind === 'single' && (
              <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 8 }}>
                <Input
                  style={{ flex: 1 }}
                  value={r.tooth}
                  onChangeText={(t) => update(i, { tooth: t })}
                  placeholder="Tooth, e.g. 3.6"
                  keyboardType="decimal-pad"
                />
                <Input
                  style={{ flex: 1 }}
                  value={r.surface}
                  onChangeText={(t) => update(i, { surface: t.toUpperCase() })}
                  placeholder="Surfaces, e.g. MO"
                />
              </View>
            )}
          </View>
        ))}
      </Card>

      <Btn title="Open the timer" icon="play.fill" big disabled={!included.length} onPress={start} />
      <T muted size={13} style={{ textAlign: 'center' }}>
        The clock starts only when you press Start on the next screen.
      </T>
    </Screen>
  );
}
