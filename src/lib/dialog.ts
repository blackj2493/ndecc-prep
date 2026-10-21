import { Alert, Platform } from 'react-native';

// React Native Web's Alert.alert does nothing, so the web build uses the browser's own dialogs.

/** Asks before a change that is hard to undo. */
export function confirm(title: string, message: string | undefined, okLabel: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}
