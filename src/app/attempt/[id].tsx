import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { Checklist } from '../../components/Checklist';
import { Btn, Card, Chip, Empty, H, Input, MinutesField, Screen, T } from '../../components/ui';
import { overallGrade } from '../../lib/criteria';
import { REQ_BY_ID, REQUIREMENTS } from '../../lib/defaults';
import { addPhoto, deletePhoto, photoUri } from '../../lib/photos';
import { uid } from '../../lib/run';
import { fmtDate } from '../../lib/stats';
import { useStore } from '../../lib/store';
import type { Attempt, ReqId } from '../../lib/types';

export default function AttemptScreen() {
  const { id, reqId } = useLocalSearchParams<{ id: string; reqId?: ReqId }>();
  const isNew = id === 'new';
  const existing = useStore((s) => s.attempts.find((a) => a.id === id));
  const settings = useStore((s) => s.settings);
  const sets = useStore((s) => s.sets);
  const allCriteria = useStore((s) => s.criteria);
  const upsertAttempt = useStore((s) => s.upsertAttempt);
  const deleteAttempt = useStore((s) => s.deleteAttempt);
  const setCriteria = useStore((s) => s.setCriteria);

  const [draft, setDraft] = useState<Attempt | undefined>(() => {
    if (existing) return existing;
    if (!isNew) return undefined;
    const r = reqId ?? 'amalgam';
    return {
      id: uid(),
      reqId: r,
      tooth: '',
      surface: '',
      date: new Date().toISOString(),
      durationSec: settings.targets[r] * 60,
      targetSec: settings.targets[r] * 60,
      repeats: 0,
      grade: null,
      ratings: {},
      tags: [],
      notes: '',
      photos: [],
    };
  });

  // Existing attempts save on every change; a new one saves with the button.
  // The ref holds the newest draft, so a change after an await (a photo) does not undo an
  // earlier change. The store write stays outside the state updater: React forbids
  // updating another component's state during render.
  const latest = useRef(draft);
  const commit = (fn: (d: Attempt) => Attempt) => {
    if (!latest.current) return;
    const next = fn(latest.current);
    latest.current = next;
    setDraft(next);
    if (!isNew) upsertAttempt(next);
  };

  if (!draft) return <Empty text="This attempt no longer exists." />;
  const patch = (p: Partial<Attempt>) => commit((d) => ({ ...d, ...p }));
  const criteria = allCriteria[draft.reqId] ?? [];
  const addDetail = (criterionId: string, detail: string) =>
    setCriteria(
      draft.reqId,
      criteria.map((cr) =>
        cr.id === criterionId && !cr.details.includes(detail) ? { ...cr, details: [...cr.details, detail] } : cr,
      ),
    );
  // Findings from before the checklist, or from a renamed criterion.
  const names = criteria.map((cr) => `${cr.name}: `);
  const legacy = draft.tags.filter((t) => !names.some((n) => t.startsWith(n)));

  const photo = async (src: 'camera' | 'library') => {
    const name = await addPhoto(src);
    if (name) commit((d) => ({ ...d, photos: [...d.photos, name] }));
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Log a project' : REQ_BY_ID[draft.reqId].short }} />

      {isNew && (
        <>
          <H>Requirement</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {REQUIREMENTS.map((r) => (
              <Chip
                key={r.id}
                label={r.short}
                selected={draft.reqId === r.id}
                onPress={() => patch({ reqId: r.id, tags: [], ratings: {}, grade: null, targetSec: settings.targets[r.id] * 60 })}
              />
            ))}
          </View>
          <H>Set (optional)</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {sets.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                selected={draft.setId === s.id}
                onPress={() =>
                  draft.setId === s.id
                    ? patch({ setId: undefined })
                    : patch({ setId: s.id, tooth: s.teeth[draft.reqId].tooth, surface: s.teeth[draft.reqId].surface })
                }
              />
            ))}
          </View>
        </>
      )}

      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T muted size={13}>
              Tooth
            </T>
            <Input value={draft.tooth} onChangeText={(t) => patch({ tooth: t })} keyboardType="decimal-pad" placeholder="3.6" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T muted size={13}>
              Surfaces
            </T>
            <Input value={draft.surface} onChangeText={(t) => patch({ surface: t.toUpperCase() })} placeholder="ML" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T>Time (min)</T>
          <MinutesField
            step={1}
            value={Math.round(draft.durationSec / 60)}
            onChange={(n) => patch({ durationSec: n * 60 })}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T>Target (min)</T>
          <MinutesField value={Math.round(draft.targetSec / 60)} onChange={(n) => patch({ targetSec: n * 60 })} />
        </View>
        <T muted size={13}>
          {fmtDate(draft.date)}
          {draft.repeats ? ` · restarted ${draft.repeats}×` : ''}
        </T>
      </Card>

      <H>NDEB checklist</H>
      <Card>
        <Checklist
          criteria={criteria}
          ratings={draft.ratings}
          tags={draft.tags}
          onChange={(ratings, tags) => patch({ ratings, tags, grade: overallGrade(ratings) })}
          onAddDetail={addDetail}
        />
      </Card>
      {legacy.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {legacy.map((t) => (
            <Chip key={t} label={`${t}  ✕`} onPress={() => patch({ tags: draft.tags.filter((x) => x !== t) })} />
          ))}
        </View>
      )}

      <H>Notes</H>
      <Input
        multiline
        value={draft.notes}
        onChangeText={(t) => patch({ notes: t })}
        placeholder="What went wrong, why, and what to do differently"
      />

      <H>Photos</H>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {draft.photos.map((p) => (
          <Pressable
            key={p}
            onLongPress={() =>
              Alert.alert('Delete this photo?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deletePhoto(p);
                    patch({ photos: draft.photos.filter((x) => x !== p) });
                  },
                },
              ])
            }
          >
            <Image source={{ uri: photoUri(p) }} style={{ width: 104, height: 104, borderRadius: 8 }} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn style={{ flex: 1 }} title="Camera" icon="camera" kind="secondary" onPress={() => photo('camera')} />
        <Btn style={{ flex: 1 }} title="Library" icon="photo" kind="secondary" onPress={() => photo('library')} />
      </View>
      {draft.photos.length > 0 && (
        <T muted size={12}>
          Press and hold a photo to delete it.
        </T>
      )}

      {isNew ? (
        <Btn
          title="Save"
          icon="checkmark"
          big
          onPress={() => {
            upsertAttempt(draft);
            router.back();
          }}
        />
      ) : (
        <Btn
          title="Delete this attempt"
          kind="plain"
          onPress={() =>
            Alert.alert('Delete this attempt?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  draft.photos.forEach(deletePhoto);
                  deleteAttempt(draft.id);
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
