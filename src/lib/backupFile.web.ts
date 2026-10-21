import * as DocumentPicker from 'expo-document-picker';
import { parseBackup, serializeBackup } from './backupFormat';
import type { Data } from './store';

/** Opens the iOS share sheet (Save to Files) or, where that is missing, downloads the file. */
export async function shareBackup(data: Data) {
  const name = `ndecc-prep-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([serializeBackup(data)], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export async function pickBackup(): Promise<Data | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const text = a.file ? await a.file.text() : await (await fetch(a.uri)).text();
  return parseBackup(text);
}
