import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Chip, Divider, Empty, H, Input, Screen, T } from '../../../components/ui';
import { REQ_BY_ID, REQUIREMENTS } from '../../../lib/defaults';
import { uid } from '../../../lib/run';
import { useStore } from '../../../lib/store';
import type { Campaign, ReqId } from '../../../lib/types';
import { confirm } from '../../../lib/dialog';

export default function CampaignEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const campaigns = useStore((s) => s.campaigns);
  const sets = useStore((s) => s.sets);
  const upsertCampaign = useStore((s) => s.upsertCampaign);
  const deleteCampaign = useStore((s) => s.deleteCampaign);
  const isNew = id === 'new';
  const [draft, setDraft] = useState<Campaign>(
    () => campaigns.find((c) => c.id === id) ?? { id: uid(), name: '', items: [] },
  );
  const [req, setReq] = useState<ReqId>('endo');
  const [tooth, setTooth] = useState('');
  const [surface, setSurface] = useState('');

  const add = () => {
    setDraft({ ...draft, items: [...draft.items, { reqId: req, tooth: tooth.trim(), surface: surface.trim() }] });
  };
  const addFromSet = (setId: string) => {
    const s = sets.find((x) => x.id === setId)!;
    setDraft({ ...draft, items: [...draft.items, { reqId: req, ...s.teeth[req] }] });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'New campaign' : draft.name }} />
      <Input value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} placeholder="Name, e.g. Endo x3" />

      <H>Projects in order</H>
      <Card>
        {draft.items.length === 0 && <Empty text="Add projects below." />}
        {draft.items.map((it, i) => (
          <View key={i}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <T style={{ flex: 1 }}>
                {i + 1}. {REQ_BY_ID[it.reqId].short} · {it.tooth || 'no tooth'} {it.surface}
              </T>
              <Btn title="Remove" kind="plain" onPress={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== i) })} />
            </View>
          </View>
        ))}
      </Card>

      <H>Add a project</H>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {REQUIREMENTS.map((r) => (
            <Chip key={r.id} label={r.short} selected={req === r.id} onPress={() => setReq(r.id)} />
          ))}
        </View>
        <T muted size={13}>
          Take the tooth from a set:
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {sets.map((s) => (
            <Chip key={s.id} label={`${s.name} (${s.teeth[req].tooth})`} onPress={() => addFromSet(s.id)} />
          ))}
        </View>
        <T muted size={13}>
          Or enter a tooth:
        </T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input style={{ flex: 1 }} value={tooth} onChangeText={setTooth} placeholder="Tooth" keyboardType="decimal-pad" />
          <Input style={{ flex: 1 }} value={surface} onChangeText={(t) => setSurface(t.toUpperCase())} placeholder="Surfaces" />
          <Btn title="Add" kind="secondary" onPress={add} />
        </View>
      </Card>

      <Btn
        title="Save campaign"
        icon="checkmark"
        big
        disabled={!draft.name.trim() || !draft.items.length}
        onPress={() => {
          upsertCampaign({ ...draft, name: draft.name.trim() });
          router.back();
        }}
      />
      {!isNew && (
        <Btn
          title="Delete this campaign"
          kind="plain"
          onPress={() =>
            confirm('Delete this campaign?', undefined, 'Delete', () => {
                  deleteCampaign(draft.id);
                  router.back();
                })
          }
        />
      )}
    </Screen>
  );
}
