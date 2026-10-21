import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { uid } from './run';

const dir = () => {
  const d = new Directory(Paths.document, 'photos');
  if (!d.exists) d.create({ intermediates: true });
  return d;
};

/** Photos are stored by file name, because the app folder path can change between installs. */
export const photoUri = (name: string) => new File(dir(), name).uri;

export async function addPhoto(source: 'camera' | 'library'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const name = `${uid()}.jpg`;
  await new File(res.assets[0].uri).copy(new File(dir(), name));
  return name;
}

export function deletePhoto(name: string) {
  const f = new File(dir(), name);
  if (f.exists) f.delete();
}
