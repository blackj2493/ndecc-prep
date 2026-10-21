import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Btn, Card, Chip, H, Input, Screen, T } from '../../components/ui';
import { REQUIREMENTS } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import type { ReqId } from '../../lib/types';

type Key = ReqId | 'ic';

export default function Tags() {
  const tags = useStore((s) => s.tags);
  const icTags = useStore((s) => s.icTags);
  const setTags = useStore((s) => s.setTags);
  const setIcTags = useStore((s) => s.setIcTags);
  const [key, setKey] = useState<Key>('amalgam');
  const [add, setAdd] = useState('');
  const list = key === 'ic' ? icTags : tags[key];
  const save = (v: string[]) => (key === 'ic' ? setIcTags(v) : setTags(key, v));

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Mistake lists' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {REQUIREMENTS.map((r) => (
          <Chip key={r.id} label={r.short} selected={key === r.id} onPress={() => setKey(r.id)} />
        ))}
        <Chip label="Infection control" selected={key === 'ic'} onPress={() => setKey('ic')} />
      </View>
      <H>Tap a mistake to remove it</H>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {list.map((t) => (
            <Chip
              key={t}
              label={t}
              onPress={() =>
                Alert.alert(`Remove "${t}"?`, 'Attempts that already have it keep it.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => save(list.filter((x) => x !== t)) },
                ])
              }
            />
          ))}
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input style={{ flex: 1 }} value={add} onChangeText={setAdd} placeholder="New mistake" />
        <Btn
          title="Add"
          kind="secondary"
          disabled={!add.trim()}
          onPress={() => {
            if (!list.includes(add.trim())) save([...list, add.trim()]);
            setAdd('');
          }}
        />
      </View>
      {key === 'ic' && (
        <T muted size={12}>
          Start an item with “CRITICAL” to mark it as a critical error. One critical error fails the run.
        </T>
      )}
    </Screen>
  );
}
