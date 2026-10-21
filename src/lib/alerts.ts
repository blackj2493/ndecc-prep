import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import type { RunAlert } from './run';

// The app plays its own chime in the foreground, so a banner there would only repeat it.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

let chime: AudioPlayer | null = null;
let endChime: AudioPlayer | null = null;

export async function initAlerts() {
  await setAudioModeAsync({ playsInSilentMode: true });
  chime = createAudioPlayer(require('../../assets/sounds/chime.wav'));
  endChime = createAudioPlayer(require('../../assets/sounds/end.wav'));
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) await Notifications.requestPermissionsAsync();
}

export function playAlert(final: boolean) {
  const p = final ? endChime : chime;
  if (p) {
    p.seekTo(0);
    p.play();
  }
  Haptics.notificationAsync(
    final ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
  );
}

/** Replaces all scheduled alerts with the future ones from the current run state. */
export async function scheduleAlerts(alerts: RunAlert[], fired: string[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  const future = alerts.filter((a) => a.at > now + 1000 && !fired.includes(a.id));
  for (const a of future)
    await Notifications.scheduleNotificationAsync({
      content: { title: a.title, body: a.body || undefined, sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.at },
    });
}

export const cancelAlerts = () => Notifications.cancelAllScheduledNotificationsAsync();

/** Web only: browsers allow sound only after a tap. Native needs nothing. */
export function unlockAudio() {}
