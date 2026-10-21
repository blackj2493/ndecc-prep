import { Stack } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Btn, Card, Chip, Divider, H, Input, MinutesField, Screen, T } from '../../components/ui';
import { fmtMin } from '../../lib/stats';
import { useStore } from '../../lib/store';

/** Editable list of "minutes before" values. */
function MinuteList({ values, onChange }: { values: number[]; onChange: (v: number[]) => void }) {
  const [add, setAdd] = useState('');
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {values.map((v) => (
          <Chip key={v} label={`${v} min  ✕`} selected onPress={() => onChange(values.filter((x) => x !== v))} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Input style={{ flex: 1 }} value={add} onChangeText={setAdd} keyboardType="number-pad" placeholder="Minutes" />
        <Btn
          title="Add"
          kind="secondary"
          disabled={!parseInt(add, 10)}
          onPress={() => {
            const n = parseInt(add, 10);
            if (n > 0 && !values.includes(n)) onChange([...values, n].sort((a, b) => b - a));
            setAdd('');
          }}
        />
      </View>
    </View>
  );
}

export default function Exam() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const sessions = settings.sessions;
  const total = sessions.reduce((s, x) => s + x.minutes, 0);

  const patchSession = (i: number, p: Partial<(typeof sessions)[number]>) =>
    updateSettings({ sessions: sessions.map((s, j) => (j === i ? { ...s, ...p } : s)) });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Exam time and alerts' }} />
      <H>Sessions</H>
      <Card>
        {sessions.map((s, i) => (
          <View key={i}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
              <Input style={{ flex: 1 }} value={s.name} onChangeText={(t) => patchSession(i, { name: t })} />
              <MinutesField value={s.minutes} step={15} onChange={(n) => patchSession(i, { minutes: n })} />
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn
            style={{ flex: 1 }}
            title="Add session"
            kind="secondary"
            onPress={() => updateSettings({ sessions: [...sessions, { name: `Session ${sessions.length + 1}`, minutes: 120 }] })}
          />
          <Btn
            style={{ flex: 1 }}
            title="Remove last"
            kind="plain"
            disabled={sessions.length < 2}
            onPress={() => updateSettings({ sessions: sessions.slice(0, -1) })}
          />
        </View>
        <T muted size={13}>
          Total work time: {fmtMin(total * 60)}. A break comes between sessions.
        </T>
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T>Break (min)</T>
          <MinutesField value={settings.breakMinutes} onChange={(n) => updateSettings({ breakMinutes: n })} />
        </View>
      </Card>

      <H>Project alerts</H>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T>Halfway through the target</T>
          <Switch value={settings.halfwayAlert} onValueChange={(v) => updateSettings({ halfwayAlert: v })} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T>When the target time ends</T>
          <Switch value={settings.endAlert} onValueChange={(v) => updateSettings({ endAlert: v })} />
        </View>
        <T muted size={13}>
          Warnings before the target ends:
        </T>
        <MinuteList values={settings.projectWarnings} onChange={(v) => updateSettings({ projectWarnings: v })} />
      </Card>

      <H>Session alerts</H>
      <Card>
        <T muted size={13}>
          Warnings before a session ends (mock runs only):
        </T>
        <MinuteList values={settings.sessionWarnings} onChange={(v) => updateSettings({ sessionWarnings: v })} />
      </Card>
      <T muted size={12}>
        Turn off Silent mode on the iPhone. Otherwise the lock-screen alerts only vibrate. The chime inside the app
        plays in Silent mode too.
      </T>
    </Screen>
  );
}
