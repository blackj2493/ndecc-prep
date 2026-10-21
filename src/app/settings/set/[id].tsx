import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Btn, Card, Divider, H, Input, MinutesField, Screen, T } from '../../../components/ui';
import { DEFAULT_SEQUENCE, REQ_BY_ID } from '../../../lib/defaults';
import { uid } from '../../../lib/run';
import { useStore } from '../../../lib/store';
import type { PracticeSet, ReqId, ToothSpec } from '../../../lib/types';

export default function SetEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sets = useStore((s) => s.sets);
  const targets = useStore((s) => s.settings.targets);
  const upsertSet = useStore((s) => s.upsertSet);
  const deleteSet = useStore((s) => s.deleteSet);
  const isNew = id === 'new';

  const [draft, setLocal] = useState<PracticeSet>(
    () =>
      sets.find((s) => s.id === id) ?? {
        id: uid(),
        name: `Set ${sets.length + 1}`,
        teeth: Object.fromEntries(DEFAULT_SEQUENCE.map((r) => [r, { tooth: '', surface: '' }])) as Record<ReqId, ToothSpec>,
        targets: {},
      },
  );
  // An existing set saves on every change; a new one saves with the button.
  const setDraft = (next: PracticeSet) => {
    setLocal(next);
    if (!isNew) upsertSet(next);
  };

  const patchTooth = (r: ReqId, p: Partial<ToothSpec>) => {
    const teeth = { ...draft.teeth, [r]: { ...draft.teeth[r], ...p } };
    // The provisional crown is made on the crown preparation, so they share a tooth.
    if (r === 'crownPrep' && p.tooth != null) teeth.provisional = { ...teeth.provisional, tooth: p.tooth };
    setDraft({ ...draft, teeth });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: draft.name || 'Set' }} />
      <Input value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} placeholder="Set name" />
      <H>Teeth and targets</H>
      <Card>
        {DEFAULT_SEQUENCE.map((r, i) => {
          const own = draft.targets[r];
          return (
            <View key={r} style={{ gap: 6, paddingVertical: 6 }}>
              {i > 0 && <Divider />}
              <T weight="600">{REQ_BY_ID[r].short}</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Input
                  style={{ flex: 1 }}
                  value={draft.teeth[r].tooth}
                  onChangeText={(t) => patchTooth(r, { tooth: t })}
                  placeholder="Tooth"
                  keyboardType="decimal-pad"
                />
                <Input
                  style={{ flex: 1 }}
                  value={draft.teeth[r].surface}
                  onChangeText={(t) => patchTooth(r, { surface: t.toUpperCase() })}
                  placeholder="Surfaces"
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <T muted size={14}>
                  {own == null ? `Target: default (${targets[r]} min)` : 'Target for this set (min)'}
                </T>
                {own == null ? (
                  <Btn title="Override" kind="plain" onPress={() => setDraft({ ...draft, targets: { ...draft.targets, [r]: targets[r] } })} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MinutesField value={own} onChange={(n) => setDraft({ ...draft, targets: { ...draft.targets, [r]: n } })} />
                    <Btn
                      title="Reset"
                      kind="plain"
                      onPress={() => {
                        const { [r]: _, ...rest } = draft.targets;
                        setDraft({ ...draft, targets: rest });
                      }}
                    />
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </Card>
      {isNew ? (
        <Btn
          title="Save set"
          icon="checkmark"
          big
          onPress={() => {
            upsertSet(draft);
            router.back();
          }}
        />
      ) : (
        <Btn
          title="Delete this set"
          kind="plain"
          onPress={() =>
            Alert.alert('Delete this set?', 'Logged attempts stay in the journal.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  deleteSet(draft.id);
                  router.back();
                },
              },
            ])
          }
        />
      )}
    </Screen>
  );
}
