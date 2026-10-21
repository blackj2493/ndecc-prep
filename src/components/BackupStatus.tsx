import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { timeAgo } from '../lib/stats';
import { useStore } from '../lib/store';
import { Icon } from './Icon';
import { T, useTheme } from './ui';

const DAY = 24 * 3600 * 1000;

/** A warning card when the data is not safe; one quiet line when it is. */
export function BackupStatus() {
  const c = useTheme();
  const cloud = useStore((s) => s.cloud);
  const attempts = useStore((s) => s.attempts.length);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  const configured = !!cloud.repo && !!cloud.token;
  const stale = !cloud.lastBackupAt || now - new Date(cloud.lastBackupAt).getTime() > DAY;
  const bad = !configured || !!cloud.lastError || (stale && attempts > 0);

  const text = !configured
    ? 'Cloud backup is OFF. Your data is only on this phone. Tap to set it up.'
    : cloud.lastError
      ? `Backup failed: ${cloud.lastError}`
      : stale && attempts > 0
        ? `Last backup ${timeAgo(cloud.lastBackupAt, now)}. Open the app online so it can back up.`
        : `Backed up ${timeAgo(cloud.lastBackupAt, now)}`;

  return (
    <Pressable onPress={() => router.push('/settings/data')}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          padding: bad ? 12 : 0,
          borderRadius: 12,
          backgroundColor: bad ? (configured ? c.warn : c.bad) : 'transparent',
        }}
      >
        <Icon
          name={bad ? 'exclamationmark.triangle.fill' : 'icloud'}
          color={bad ? '#fff' : c.muted}
          size={bad ? 20 : 14}
        />
        <T size={bad ? 15 : 13} weight={bad ? '600' : undefined} style={{ color: bad ? '#fff' : c.muted, flex: 1 }}>
          {text}
        </T>
      </View>
    </Pressable>
  );
}
