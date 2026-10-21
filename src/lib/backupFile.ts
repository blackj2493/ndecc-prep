import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { parseBackup, serializeBackup } from './backupFormat';
import type { Data } from './store';

export async function shareBackup(data: Data) {
  const f = new File(Paths.cache, `ndecc-prep-backup-${new Date().toISOString().slice(0, 10)}.json`);
  if (f.exists) f.delete();
  f.create();
  f.write(serializeBackup(data));
  await Sharing.shareAsync(f.uri, { mimeType: 'application/json', UTI: 'public.json' });
}

export async function pickBackup(): Promise<Data | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  return parseBackup(await new File(res.assets[0].uri).text());
}
