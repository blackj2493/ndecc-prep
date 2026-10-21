import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, Chip, H, Input, Screen, T } from '../../components/ui';
import { DEFAULT_CRITERIA } from '../../lib/criteria';
import { REQUIREMENTS } from '../../lib/defaults';
import { uid } from '../../lib/run';
import { useStore } from '../../lib/store';
import type { Criterion, ReqId } from '../../lib/types';
import { confirm } from '../../lib/dialog';

type Key = ReqId | 'ic';

/** Removes a chip after a confirmation. */
const confirmRemove = (label: string, onYes: () => void) =>
  confirm(`Remove "${label}"?`, 'Attempts that already have it keep it.', 'Remove', onYes);

function CriterionCard({
  cr,
  onChange,
  onDelete,
}: {
  cr: Criterion;
  onChange: (cr: Criterion) => void;
  onDelete: () => void;
}) {
  const [add, setAdd] = useState('');
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T weight="600" style={{ flex: 1 }}>
          {cr.name}
        </T>
        <Btn title="Delete" kind="plain" onPress={() => confirmRemove(cr.name, onDelete)} />
      </View>
      {cr.hint ? (
        <T muted size={13}>
          {cr.hint}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {cr.details.map((d) => (
          <Chip
            key={d}
            label={d}
            onPress={() => confirmRemove(d, () => onChange({ ...cr, details: cr.details.filter((x) => x !== d) }))}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input style={{ flex: 1 }} value={add} onChangeText={setAdd} placeholder="New finding" />
        <Btn
          title="Add"
          kind="secondary"
          disabled={!add.trim()}
          onPress={() => {
            if (!cr.details.includes(add.trim())) onChange({ ...cr, details: [...cr.details, add.trim()] });
            setAdd('');
          }}
        />
      </View>
    </Card>
  );
}

export default function CriteriaSetup() {
  const criteria = useStore((s) => s.criteria);
  const icTags = useStore((s) => s.icTags);
  const setCriteria = useStore((s) => s.setCriteria);
  const setIcTags = useStore((s) => s.setIcTags);
  const [key, setKey] = useState<Key>('amalgam');
  const [newName, setNewName] = useState('');
  const [newIc, setNewIc] = useState('');

  const list = key === 'ic' ? [] : criteria[key];
  const save = (next: Criterion[]) => key !== 'ic' && setCriteria(key, next);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Checklist criteria' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {REQUIREMENTS.map((r) => (
          <Chip key={r.id} label={r.short} selected={key === r.id} onPress={() => setKey(r.id)} />
        ))}
        <Chip label="Infection control" selected={key === 'ic'} onPress={() => setKey('ic')} />
      </View>

      {key === 'ic' ? (
        <>
          <H>Infection control errors (tap to remove)</H>
          <Card>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {icTags.map((t) => (
                <Chip key={t} label={t} onPress={() => confirmRemove(t, () => setIcTags(icTags.filter((x) => x !== t)))} />
              ))}
            </View>
          </Card>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input style={{ flex: 1 }} value={newIc} onChangeText={setNewIc} placeholder="New error" />
            <Btn
              title="Add"
              kind="secondary"
              disabled={!newIc.trim()}
              onPress={() => {
                if (!icTags.includes(newIc.trim())) setIcTags([...icTags, newIc.trim()]);
                setNewIc('');
              }}
            />
          </View>
          <T muted size={12}>
            Start an item with “CRITICAL” to mark it as a critical error. One critical error fails the run.
          </T>
        </>
      ) : (
        <>
          <T muted size={13}>
            Each criterion is rated OK, MC or Fail on an attempt. The findings are the details you can select under it.
            Tap a finding to remove it.
          </T>
          {list.map((cr, i) => (
            <CriterionCard
              key={cr.id}
              cr={cr}
              onChange={(n) => save(list.map((x, j) => (j === i ? n : x)))}
              onDelete={() => save(list.filter((_, j) => j !== i))}
            />
          ))}
          <H>New criterion</H>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input style={{ flex: 1 }} value={newName} onChangeText={setNewName} placeholder="Name" />
            <Btn
              title="Add"
              kind="secondary"
              disabled={!newName.trim()}
              onPress={() => {
                save([...list, { id: uid(), name: newName.trim(), hint: '', details: [] }]);
                setNewName('');
              }}
            />
          </View>
          <Btn
            title="Reset this requirement to the NDEB defaults"
            kind="plain"
            onPress={() =>
              confirm('Reset the criteria?', 'Your added criteria and findings for this requirement are removed.', 'Reset', () => save(DEFAULT_CRITERIA[key]))
            }
          />
        </>
      )}
    </Screen>
  );
}
