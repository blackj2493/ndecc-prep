import { router } from 'expo-router';
import { View } from 'react-native';
import { Btn, Card, Divider, H, Row, Screen } from '../../components/ui';
import { fmtMin } from '../../lib/stats';
import { useStore } from '../../lib/store';

export default function Setup() {
  const sets = useStore((s) => s.sets);
  const campaigns = useStore((s) => s.campaigns);
  const settings = useStore((s) => s.settings);
  const examMin = settings.sessions.reduce((s, x) => s + x.minutes, 0);

  return (
    <Screen>
      <H>Exam</H>
      <Card>
        <Row
          icon="list.bullet"
          title="Default sequence and targets"
          subtitle="Order of the 7 projects and your target time for each"
          onPress={() => router.push('/settings/defaults')}
        />
        <Divider />
        <Row
          icon="clock"
          title="Exam time and alerts"
          subtitle={`${settings.sessions.length} sessions, ${fmtMin(examMin * 60)} + ${settings.breakMinutes} min break · warnings at ${settings.projectWarnings.join(', ')} min`}
          onPress={() => router.push('/settings/exam')}
        />
        <Divider />
        <Row
          icon="tag"
          title="Checklist criteria"
          subtitle="The NDEB criteria and findings for each requirement, and infection control errors"
          onPress={() => router.push('/settings/tags')}
        />
      </Card>

      <H>Sets</H>
      <Card>
        {sets.map((s, i) => (
          <View key={s.id}>
            {i > 0 && <Divider />}
            <Row title={s.name} onPress={() => router.push(`/settings/set/${s.id}`)} />
          </View>
        ))}
        <Btn title="New set" kind="secondary" icon="plus" onPress={() => router.push('/settings/set/new')} />
      </Card>

      <H>Campaigns</H>
      <Card>
        {campaigns.map((c, i) => (
          <View key={c.id}>
            {i > 0 && <Divider />}
            <Row title={c.name} subtitle={`${c.items.length} projects`} onPress={() => router.push(`/settings/campaign/${c.id}`)} />
          </View>
        ))}
        <Btn title="New campaign" kind="secondary" icon="plus" onPress={() => router.push('/settings/campaign/new')} />
      </Card>

      <H>Data</H>
      <Card>
        <Row
          icon="externaldrive"
          title="Backup and restore"
          subtitle="Save all your data to Files or iCloud Drive"
          onPress={() => router.push('/settings/data')}
        />
      </Card>
    </Screen>
  );
}
