import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { Btn, Card, Chip, Empty, H, Input, MinutesField, Screen, T, useTheme } from '../../components/ui';
import { REQ_BY_ID, REQUIREMENTS } from '../../lib/defaults';
import { addPhoto, deletePhoto, photoUri } from '../../lib/photos';
import { uid } from '../../lib/run';
import { fmtDate } from '../../lib/stats';
import { useStore } from '../../lib/store';
import type { Attempt, Grade, ReqId } from '../../lib/types';

const GRADES: { g: Grade; label: string }[] = [
  { g: 'C', label: 'Competent' },
  { g: 'MC', label: 'Min. competent' },
  { g: 'NC', label: 'Not competent' },
];

export default function AttemptScreen() {
  const c = useTheme();
  const { id, reqId } = useLocalSearchParams<{ id: string; reqId?: ReqId }>();
  const isNew = id === 'new';
  const existing = useStore((s) => s.attempts.find((a) => a.id === id));
  const settings = useStore((s) => s.settings);
  const sets = useStore((s) => s.sets);
  const allTags = useStore((s) => s.tags);
  const upsertAttempt = useStore((s) => s.upsertAttempt);
  const deleteAttempt = useStore((s) => s.deleteAttempt);
  const setTags = useStore((s) => s.setTags);

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
      tags: [],
      notes: '',
      photos: [],
    };
  });
  const [newTag, setNewTag] = useState('');

  // Existing attempts save on every change; a new one saves with the button.
  const commit = (fn: (d: Attempt) => Attempt) =>
    setDraft((d) => {
      if (!d) return d;
      const next = fn(d);
      if (!isNew) upsertAttempt(next);
      return next;
    });

  if (!draft) return <Empty text="This attempt no longer exists." />;
  const patch = (p: Partial<Attempt>) => commit((d) => ({ ...d, ...p }));
  const tags = allTags[draft.reqId] ?? [];
  const extra = draft.tags.filter((t) => !tags.includes(t));
  const toggle = (t: string) =>
    patch({ tags: draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t] });

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
                onPress={() => patch({ reqId: r.id, tags: [], targetSec: settings.targets[r.id] * 60 })}
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

      <H>Self-grade</H>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {GRADES.map(({ g, label }) => (
          <Chip
            key={g}
            label={label}
            selected={draft.grade === g}
            color={g === 'C' ? c.good : g === 'MC' ? c.warn : c.bad}
            onPress={() => patch({ grade: draft.grade === g ? null : g })}
          />
        ))}
      </View>

      <H>Mistakes</H>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {[...tags, ...extra].map((t) => (
          <Chip key={t} label={t} selected={draft.tags.includes(t)} onPress={() => toggle(t)} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input style={{ flex: 1 }} value={newTag} onChangeText={setNewTag} placeholder="New mistake, e.g. DL box too wide" />
        <Btn
          title="Add"
          kind="secondary"
          disabled={!newTag.trim()}
          onPress={() => {
            const t = newTag.trim();
            if (!tags.includes(t)) setTags(draft.reqId, [...tags, t]);
            if (!draft.tags.includes(t)) patch({ tags: [...draft.tags, t] });
            setNewTag('');
          }}
        />
      </View>
      <T muted size={12}>
        A new mistake is added to the list for {REQ_BY_ID[draft.reqId].short}, so you can select it again next time.
      </T>

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
