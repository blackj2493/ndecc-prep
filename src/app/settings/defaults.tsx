import { Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { Card, Divider, MinutesField, Screen, T, useTheme } from '../../components/ui';
import { REQ_BY_ID } from '../../lib/defaults';
import { fmtMin } from '../../lib/stats';
import { useStore } from '../../lib/store';

export default function Defaults() {
  const c = useTheme();
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const seq = settings.sequence;
  const total = seq.reduce((s, id) => s + settings.targets[id], 0);

  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= seq.length) return;
    const n = [...seq];
    [n[i], n[j]] = [n[j], n[i]];
    updateSettings({ sequence: n });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sequence and targets' }} />
      <T muted size={14}>
        Every new mock uses this order and these targets. A set can override a target, and you can change both
        before each run. Total: {fmtMin(total * 60)}.
      </T>
      <Card>
        {seq.map((id, i) => (
          <View key={id}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
              <View style={{ gap: 6 }}>
                <Pressable onPress={() => move(i, -1)} hitSlop={8}>
                  <SymbolView name="chevron.up" tintColor={i ? c.accent : c.border} size={18} />
                </Pressable>
                <Pressable onPress={() => move(i, 1)} hitSlop={8}>
                  <SymbolView name="chevron.down" tintColor={i < seq.length - 1 ? c.accent : c.border} size={18} />
                </Pressable>
              </View>
              <T style={{ flex: 1 }} weight="500">
                {i + 1}. {REQ_BY_ID[id].short}
              </T>
              <MinutesField
                value={settings.targets[id]}
                onChange={(n) => updateSettings({ targets: { ...settings.targets, [id]: n } })}
              />
            </View>
          </View>
        ))}
      </Card>
      <T muted size={12}>
        Targets are in minutes. The first targets come from the times on your paper sheets.
      </T>
    </Screen>
  );
}
