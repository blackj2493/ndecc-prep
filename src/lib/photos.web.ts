import * as ImagePicker from 'expo-image-picker';
import { createStore, del, get, keys, set } from 'idb-keyval';
import { uid } from './run';

// Photos are JPEG blobs in their own IndexedDB store, keyed by file name.
const db = createStore('ndecc-prep-photos', 'photos');
const urls = new Map<string, string>();

const MAX_SIDE = 1600;

/** Scales a picked image down so 2-3 months of photos stay small. */
async function compress(src: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(src);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Image failed'))), 'image/jpeg', 0.8));
}

export async function addPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res =
    source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const blob = asset.file ?? (await (await fetch(asset.uri)).blob());
  const name = `${uid()}.jpg`;
  await set(name, await compress(blob), db);
  return name;
}

export function deletePhoto(name: string) {
  const u = urls.get(name);
  if (u) URL.revokeObjectURL(u);
  urls.delete(name);
  del(name, db).catch(() => {});
}

/** An object URL for an <Image>, or null if the photo is not on this device. */
export async function loadPhotoUrl(name: string): Promise<string | null> {
  const cached = urls.get(name);
  if (cached) return cached;
  const blob = await get<Blob>(name, db);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(name, u);
  return u;
}

export const hasPhoto = async (name: string) => (await keys(db)).includes(name);

export async function readPhotoBase64(name: string): Promise<string | null> {
  const blob = await get<Blob>(name, db);
  if (!blob) return null;
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function writePhotoBase64(name: string, b64: string) {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  await set(name, new Blob([buf], { type: 'image/jpeg' }), db);
}
