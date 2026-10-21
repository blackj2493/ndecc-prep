import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, View, useColorScheme } from 'react-native';
import { useTheme } from '../components/ui';
import { initAlerts } from '../lib/alerts';
import { startAutoBackup } from '../lib/cloud';
import { requestPersistentStorage } from '../lib/kv';
import { useStore } from '../lib/store';

export default function RootLayout() {
  const c = useTheme();
  const base = useColorScheme() === 'dark' ? DarkTheme : DefaultTheme;
  // Navigation chrome (tab bar, headers) takes its colours from this theme.
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.card, text: c.text, border: c.border },
  };
  // Nothing renders until the saved data has loaded. A screen built on the empty defaults
  // could save them over the real data. useSyncExternalStore also covers the case where
  // loading finishes before this component subscribes.
  const ready = useSyncExternalStore(
    (cb) => useStore.persist.onFinishHydration(cb),
    () => useStore.persist.hasHydrated(),
  );

  useEffect(() => {
    initAlerts().catch(() => {});
    requestPersistentStorage().catch(() => {});
    if (Platform.OS === 'web' && 'serviceWorker' in navigator && location.hostname !== 'localhost')
      navigator.serviceWorker.register('/ndecc-prep/sw.js', { scope: '/ndecc-prep/' }).catch(() => {});
  }, []);

  // The backup must start only after the saved data has loaded, or it would see an empty app.
  useEffect(() => (ready ? startAutoBackup() : undefined), [ready]);

  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator />
      </View>
    );

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTintColor: c.accent,
          headerStyle: { backgroundColor: c.bg },
          headerTitleStyle: { color: c.text },
          contentStyle: { backgroundColor: c.bg },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="run"
          options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="plan" options={{ title: 'Plan the run' }} />
        <Stack.Screen name="review/[id]" options={{ title: 'Run review' }} />
        <Stack.Screen name="attempt/[id]" options={{ title: 'Attempt' }} />
        <Stack.Screen name="requirement/[id]" options={{ title: '' }} />
      </Stack>
    </ThemeProvider>
  );
}
