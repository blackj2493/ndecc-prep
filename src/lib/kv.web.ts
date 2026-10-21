import { createStore, del, get, set } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

// IndexedDB, not localStorage: it holds far more, and a Home Screen web app keeps it
// without the 7-day limit that Safari applies to normal websites.
const db = createStore('ndecc-prep', 'state');

export const kvStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name, db)) ?? null,
  setItem: (name, value) => set(name, value, db),
  removeItem: (name) => del(name, db),
};

/** Asks the browser to keep the data even when the device is low on storage. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
