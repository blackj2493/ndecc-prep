import { parseBackup, serializeBackup } from './backupFormat';
import { hasPhoto, readPhotoBase64, writePhotoBase64 } from './photos';
import { pickData, useStore, type Data } from './store';

// Backup to a private GitHub repository through the REST "contents" API:
//   data.json        - all app data (git history keeps every earlier version)
//   photos/<name>    - each photo, uploaded once
// The token is a fine-grained token limited to that one repository.

const API = 'https://api.github.com';

const headers = (token: string, raw = false) => ({
  Authorization: `Bearer ${token}`,
  Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

function toBase64(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const utf8Base64 = (text: string) => toBase64(new TextEncoder().encode(text));

function config() {
  const { repo, token } = useStore.getState().cloud;
  if (!repo.trim() || !token.trim()) throw new Error('Cloud backup is not set up.');
  return { repo: repo.trim(), token: token.trim() };
}

async function check(res: Response, what: string) {
  if (res.ok) return res;
  let detail = '';
  try {
    detail = (await res.json()).message ?? '';
  } catch {}
  if (res.status === 401) throw new Error('GitHub rejected the token. It may be wrong or expired.');
  if (res.status === 403 || res.status === 404)
    throw new Error(`GitHub refused ${what} (${res.status}). Check the repository name and the token's access.`);
  throw new Error(`${what} failed (${res.status}) ${detail}`);
}

/** Creates or replaces one file. `sha` is needed to replace an existing file. */
async function putFile(path: string, base64: string, message: string, sha?: string | null) {
  const { repo, token } = config();
  return fetch(`${API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: base64, ...(sha ? { sha } : {}) }),
  });
}

async function fileSha(path: string): Promise<string | null> {
  const { repo, token } = config();
  const res = await fetch(`${API}/repos/${repo}/contents/${path}`, { headers: headers(token) });
  if (res.status === 404) return null;
  await check(res, 'Reading the backup');
  return (await res.json()).sha;
}

/** Checks that the repository exists, is private and the token can write to it. */
export async function testConnection(): Promise<string> {
  const { repo, token } = config();
  const res = await fetch(`${API}/repos/${repo}`, { headers: headers(token) });
  await check(res, 'Opening the repository');
  const info = await res.json();
  if (!info.private) throw new Error('The repository is PUBLIC. Make it private before you back up your data.');
  if (info.permissions && !info.permissions.push) throw new Error('The token cannot write to the repository.');
  return `Connected to ${info.full_name} (private).`;
}

let running = false;
let again = false;

/**
 * Uploads all data, then any photos that are not in the repository yet.
 * A device that has never backed up does not overwrite a backup with more attempts
 * (a new or reset phone must restore first) unless `force` is set.
 */
export async function backupNow(force = false): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  const { setCloud } = useStore.getState();
  try {
    const data = pickData(useStore.getState());
    const json = serializeBackup(data);
    const msg = `Backup ${new Date().toISOString().slice(0, 16)}: ${data.attempts.length} attempts`;
    const sha = await fileSha('data.json');
    if (sha && !force && !useStore.getState().cloud.lastBackupAt) {
      const remote = await fetchCloudData();
      if (remote.attempts.length > data.attempts.length)
        throw new Error(
          `The cloud backup has ${remote.attempts.length} attempts and this device has ${data.attempts.length}. ` +
            'Restore from the cloud first. The app did not overwrite the backup.',
        );
    }
    await check(await putFile('data.json', utf8Base64(json), msg, sha), 'Saving the data');

    const uploaded = new Set(useStore.getState().cloud.uploadedPhotos);
    const names = [...new Set(data.attempts.flatMap((a) => a.photos))].filter((n) => !uploaded.has(n));
    for (const name of names) {
      const b64 = await readPhotoBase64(name);
      if (!b64) continue;
      const res = await putFile(`photos/${name}`, b64, `Photo ${name}`);
      // 422 = the photo is already there (an earlier upload that was not recorded).
      if (!res.ok && res.status !== 422) await check(res, 'Uploading a photo');
      uploaded.add(name);
      setCloud({ uploadedPhotos: [...uploaded] });
    }
    setCloud({ lastBackupAt: new Date().toISOString(), lastError: null });
  } catch (e) {
    setCloud({ lastError: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    running = false;
    if (again) {
      again = false;
      backupNow().catch(() => {});
    }
  }
}

/** Reads the backup without changing anything, so the user can confirm first. */
export async function fetchCloudData(): Promise<Data> {
  const { repo, token } = config();
  const res = await fetch(`${API}/repos/${repo}/contents/data.json`, { headers: headers(token, true) });
  if (res.status === 404) throw new Error('There is no backup in this repository yet.');
  await check(res, 'Reading the backup');
  return parseBackup(await res.text());
}

/** Replaces all local data with the backup, then downloads the photos this device does not have. */
export async function restoreFromCloud(data: Data, onProgress?: (done: number, total: number) => void) {
  const { repo, token } = config();
  const { replaceAll, setCloud } = useStore.getState();
  replaceAll(data);
  const names = [...new Set(data.attempts.flatMap((a) => a.photos))];
  let done = 0;
  for (const name of names) {
    if (!(await hasPhoto(name))) {
      const res = await fetch(`${API}/repos/${repo}/contents/photos/${name}`, { headers: headers(token, true) });
      if (res.ok) await writePhotoBase64(name, toBase64(new Uint8Array(await res.arrayBuffer())));
    }
    onProgress?.(++done, names.length);
  }
  setCloud({ uploadedPhotos: names, lastBackupAt: new Date().toISOString(), lastError: null });
}

const DATA_KEYS: (keyof Data)[] = ['sets', 'campaigns', 'settings', 'attempts', 'runs', 'criteria', 'icTags', 'reqNotes'];
const DEBOUNCE_MS = 20000;
const STALE_MS = 6 * 3600 * 1000;

/**
 * Backs up 20 s after the last data change, when the app goes to the background,
 * and on start if the last backup is older than 6 h. Returns a stop function.
 */
export function startAutoBackup(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const configured = () => {
    const { repo, token } = useStore.getState().cloud;
    return !!repo.trim() && !!token.trim();
  };
  const run = () => {
    timer = null;
    if (configured()) backupNow().catch(() => {});
  };
  const unsub = useStore.subscribe((s, prev) => {
    if (DATA_KEYS.some((k) => s[k] !== prev[k])) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    }
  });
  const onHide = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      run();
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHide);

  const last = useStore.getState().cloud.lastBackupAt;
  if (configured() && (!last || Date.now() - new Date(last).getTime() > STALE_MS)) run();

  return () => {
    unsub();
    if (timer) clearTimeout(timer);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHide);
  };
}
