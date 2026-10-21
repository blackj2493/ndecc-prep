import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/** Key-value storage for the app state. iOS/Expo Go: SQLite. */
export const kvStorage: StateStorage = Storage;

/** Asks the system not to evict app data. Only needed on the web. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  return null;
}
