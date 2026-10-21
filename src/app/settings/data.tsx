import { Stack } from 'expo-router';
import { Alert } from 'react-native';
import { Btn, Card, H, Screen, T } from '../../components/ui';
import { pickBackup, shareBackup } from '../../lib/export';
import { initialData, pickData, useStore } from '../../lib/store';

export default function DataScreen() {
  const counts = useStore((s) => `${s.attempts.length} attempts, ${s.runs.length} runs`);
  const replaceAll = useStore((s) => s.replaceAll);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Backup and restore' }} />
      <T muted>All data stays on this iPhone: {counts}.</T>

      <H>Backup</H>
      <Card>
        <T size={14}>
          Save a backup file to Files or iCloud Drive. Do this every week. If you delete Expo Go, the app data is
          deleted too. The backup does not include photos.
        </T>
        <Btn title="Save a backup" icon="square.and.arrow.up" onPress={() => shareBackup(pickData(useStore.getState())).catch((e) => Alert.alert('Backup failed', String(e)))} />
      </Card>

      <H>Restore</H>
      <Card>
        <T size={14}>Restore replaces all the data in the app with the data in the backup file.</T>
        <Btn
          title="Restore from a backup"
          kind="secondary"
          icon="square.and.arrow.down"
          onPress={async () => {
            try {
              const data = await pickBackup();
              if (!data) return;
              Alert.alert('Replace all data?', `The backup has ${data.attempts.length} attempts.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Replace', style: 'destructive', onPress: () => replaceAll(data) },
              ]);
            } catch (e) {
              Alert.alert('Restore failed', e instanceof Error ? e.message : String(e));
            }
          }}
        />
      </Card>

      <H>Reset</H>
      <Card>
        <Btn
          title="Delete all data"
          kind="danger"
          onPress={() =>
            Alert.alert('Delete all data?', 'This deletes every attempt, run, set and setting. Save a backup first.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete all', style: 'destructive', onPress: () => replaceAll(initialData()) },
            ])
          }
        />
      </Card>
    </Screen>
  );
}
