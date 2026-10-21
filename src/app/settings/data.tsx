import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Btn, Card, H, Input, Screen, T, useTheme } from '../../components/ui';
import { backupNow, fetchCloudData, restoreFromCloud, testConnection } from '../../lib/cloud';
import { confirm, notify } from '../../lib/dialog';
import { pickBackup, shareBackup } from '../../lib/export';
import { timeAgo } from '../../lib/stats';
import { initialData, pickData, useStore } from '../../lib/store';

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function DataScreen() {
  const c = useTheme();
  const counts = useStore((s) => `${s.attempts.length} attempts, ${s.runs.length} runs`);
  const cloud = useStore((s) => s.cloud);
  const setCloud = useStore((s) => s.setCloud);
  const replaceAll = useStore((s) => s.replaceAll);
  const [busy, setBusy] = useState<string | null>(null);

  const task = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label);
    try {
      const msg = await fn();
      if (msg) notify(msg);
    } catch (e) {
      notify(`${label} failed`, errText(e));
    } finally {
      setBusy(null);
    }
  };

  // Read first, ask, then replace: nothing changes on the phone until the user confirms.
  const restoreCloud = () =>
    task('Restore', async () => {
      const data = await fetchCloudData();
      confirm(
        'Replace all data on this phone?',
        `The cloud backup has ${data.attempts.length} attempts. This phone has ${counts}.`,
        'Replace',
        () =>
          task('Restore', async () => {
            await restoreFromCloud(data, (d, t) => setBusy(`Restore: photo ${d} of ${t}`));
            return 'Restore complete.';
          }),
      );
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Backup and restore' }} />
      <T muted>On this phone: {counts}.</T>

      <H>Automatic cloud backup (GitHub)</H>
      <Card>
        <T
          weight="600"
          style={{ color: cloud.lastError ? c.bad : cloud.lastBackupAt ? c.good : c.warn }}
        >
          {cloud.lastError
            ? `Last backup failed: ${cloud.lastError}`
            : cloud.repo && cloud.token
              ? `Last backup: ${timeAgo(cloud.lastBackupAt)}`
              : 'Not set up. Your data is only on this phone.'}
        </T>
        <T muted size={13}>
          When this is set up, the app copies all data and photos to your private GitHub repository 20 seconds after
          each change, and when you leave the app. GitHub keeps every earlier version.
        </T>
        <T muted size={13}>
          Repository (owner/name)
        </T>
        <Input
          value={cloud.repo}
          onChangeText={(t) => setCloud({ repo: t.trim(), lastError: null })}
          placeholder="blackj2493/ndecc-prep-data"
        />
        <T muted size={13}>
          Access token
        </T>
        <Input
          value={cloud.token}
          onChangeText={(t) => setCloud({ token: t.trim(), lastError: null })}
          placeholder="github_pat_…"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn
            style={{ flex: 1 }}
            title="Test"
            kind="secondary"
            disabled={!!busy}
            onPress={() => task('Test', testConnection)}
          />
          <Btn
            style={{ flex: 1 }}
            title={busy?.startsWith('Back up') ? 'Backing up…' : 'Back up now'}
            icon="icloud.and.arrow.up"
            disabled={!!busy}
            onPress={() =>
              task('Back up', async () => {
                await backupNow();
                return 'Backup complete.';
              })
            }
          />
        </View>
        <Btn
          title={busy?.startsWith('Restore') ? busy : 'Restore from the cloud'}
          kind="plain"
          icon="icloud.and.arrow.down"
          disabled={!!busy}
          onPress={restoreCloud}
        />
        {cloud.lastError?.includes('Restore from the cloud first') && (
          <Btn
            title="Overwrite the cloud with this phone's data"
            kind="danger"
            disabled={!!busy}
            onPress={() =>
              confirm(
                'Overwrite the cloud backup?',
                'Do this only if this phone has the data you want to keep. GitHub still keeps the old version in its history.',
                'Overwrite',
                () => task('Back up', async () => (await backupNow(true), 'Backup complete.')),
              )
            }
          />
        )}
      </Card>

      <H>Backup file</H>
      <Card>
        <T size={14}>
          An extra copy you can save in Files or iCloud Drive. The file does not include photos.
        </T>
        <Btn
          title="Save a backup file"
          kind="secondary"
          icon="square.and.arrow.up"
          onPress={() => shareBackup(pickData(useStore.getState())).catch((e) => notify('Backup failed', errText(e)))}
        />
        <Btn
          title="Restore from a backup file"
          kind="plain"
          icon="square.and.arrow.down"
          onPress={async () => {
            try {
              const data = await pickBackup();
              if (!data) return;
              confirm('Replace all data?', `The backup has ${data.attempts.length} attempts.`, 'Replace', () =>
                replaceAll(data),
              );
            } catch (e) {
              notify('Restore failed', errText(e));
            }
          }}
        />
      </Card>

      <H>Reset</H>
      <Card>
        <Btn
          title="Delete all data on this phone"
          kind="danger"
          onPress={() =>
            confirm(
              'Delete all data?',
              'This deletes every attempt, run, set and setting on this phone. The cloud backup stays.',
              'Delete all',
              () => replaceAll(initialData()),
            )
          }
        />
      </Card>
    </Screen>
  );
}
