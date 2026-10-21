import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { useTheme } from '../components/ui';
import { initAlerts } from '../lib/alerts';
import { useStore } from '../lib/store';

export default function RootLayout() {
  const c = useTheme();
  const base = useColorScheme() === 'dark' ? DarkTheme : DefaultTheme;
  // Navigation chrome (tab bar, headers) takes its colours from this theme.
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.card, text: c.text, border: c.border },
  };
  const [ready, setReady] = useState(() => useStore.persist.hasHydrated());

  useEffect(() => {
    initAlerts().catch(() => {});
    return useStore.persist.onFinishHydration(() => setReady(true));
  }, []);

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
