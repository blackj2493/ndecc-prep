import { Tabs } from 'expo-router';
import { Icon, type IconName } from '../../components/Icon';
import type { ColorValue } from 'react-native';
import { useTheme } from '../../components/ui';

function TabIcon({ name, color }: { name: IconName; color: ColorValue }) {
  return <Icon name={name} color={color} size={24} />;
}

export default function TabLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.border },
        headerStyle: { backgroundColor: c.bg },
        headerTitleStyle: { color: c.text },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Practice', tabBarIcon: ({ color }) => <TabIcon name="timer" color={color} /> }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: 'Journal', tabBarIcon: ({ color }) => <TabIcon name="book.closed" color={color} /> }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => <TabIcon name="chart.line.uptrend.xyaxis" color={color} />,
        }}
      />
      <Tabs.Screen
        name="setup"
        options={{ title: 'Setup', tabBarIcon: ({ color }) => <TabIcon name="gearshape" color={color} /> }}
      />
    </Tabs>
  );
}
