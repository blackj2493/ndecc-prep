import { kvStorage } from './kv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_CRITERIA } from './criteria';
import { DEFAULT_SETS, DEFAULT_SETTINGS, IC_CRITICAL, IC_ERRORS } from './defaults';
import type {
  ActiveRun,
  Attempt,
  Campaign,
  Criterion,
  PracticeSet,
  ReqId,
  RunRecord,
  Settings,
} from './types';

export interface Data {
  sets: PracticeSet[];
  campaigns: Campaign[];
  settings: Settings;
  attempts: Attempt[];
  runs: RunRecord[];
  criteria: Record<ReqId, Criterion[]>;
  icTags: string[];
  /** Free technique notes for each requirement ("my method"). */
  reqNotes: Partial<Record<ReqId, string>>;
}

/** Settings and status of the GitHub backup. Local to this device; never in a backup file. */
export interface CloudState {
  repo: string;
  token: string;
  lastBackupAt: string | null;
  lastError: string | null;
  /** Photo file names already in the repository. */
  uploadedPhotos: string[];
}

interface State extends Data {
  activeRun: ActiveRun | null;
  cloud: CloudState;
  setCloud: (patch: Partial<CloudState>) => void;
  setActiveRun: (run: ActiveRun | null) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  upsertSet: (s: PracticeSet) => void;
  deleteSet: (id: string) => void;
  upsertCampaign: (c: Campaign) => void;
  deleteCampaign: (id: string) => void;
  addRun: (record: RunRecord, attempts: Attempt[]) => void;
  updateRun: (id: string, patch: Partial<RunRecord>) => void;
  deleteRun: (id: string) => void;
  upsertAttempt: (a: Attempt) => void;
  deleteAttempt: (id: string) => void;
  setCriteria: (reqId: ReqId, list: Criterion[]) => void;
  setIcTags: (tags: string[]) => void;
  setReqNotes: (reqId: ReqId, text: string) => void;
  replaceAll: (data: Data) => void;
}

export const initialData = (): Data => ({
  sets: DEFAULT_SETS,
  campaigns: [],
  settings: DEFAULT_SETTINGS,
  attempts: [],
  runs: [],
  criteria: DEFAULT_CRITERIA,
  icTags: [...IC_ERRORS, ...IC_CRITICAL],
  reqNotes: {},
});

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...initialData(),
      activeRun: null,
      cloud: { repo: 'blackj2493/ndecc-prep-data', token: '', lastBackupAt: null, lastError: null, uploadedPhotos: [] },
      setCloud: (patch) => set((s) => ({ cloud: { ...s.cloud, ...patch } })),
      setActiveRun: (activeRun) => set({ activeRun }),
      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      upsertSet: (item) => set((s) => ({ sets: upsert(s.sets, item) })),
      deleteSet: (id) => set((s) => ({ sets: s.sets.filter((x) => x.id !== id) })),
      upsertCampaign: (item) => set((s) => ({ campaigns: upsert(s.campaigns, item) })),
      deleteCampaign: (id) => set((s) => ({ campaigns: s.campaigns.filter((x) => x.id !== id) })),
      addRun: (record, attempts) =>
        set((s) => ({ runs: [...s.runs, record], attempts: [...s.attempts, ...attempts] })),
      updateRun: (id, patch) =>
        set((s) => ({ runs: s.runs.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteRun: (id) =>
        set((s) => ({
          runs: s.runs.filter((r) => r.id !== id),
          attempts: s.attempts.filter((a) => a.runId !== id),
        })),
      upsertAttempt: (item) => set((s) => ({ attempts: upsert(s.attempts, item) })),
      deleteAttempt: (id) =>
        set((s) => ({
          attempts: s.attempts.filter((a) => a.id !== id),
          runs: s.runs.map((r) => ({ ...r, attemptIds: r.attemptIds.filter((x) => x !== id) })),
        })),
      setCriteria: (reqId, list) => set((s) => ({ criteria: { ...s.criteria, [reqId]: list } })),
      setIcTags: (icTags) => set({ icTags }),
      setReqNotes: (reqId, text) => set((s) => ({ reqNotes: { ...s.reqNotes, [reqId]: text } })),
      replaceAll: (data) =>
        set({
          ...initialData(),
          ...data,
          // Backups from before the checklist have no ratings.
          attempts: data.attempts.map((a) => ({ ...a, ratings: a.ratings ?? {} })),
        }),
    }),
    {
      name: 'ndecc-prep',
      version: 3,
      storage: createJSONStorage(() => kvStorage),
      // v2 replaced the free mistake lists with the NDEB checklist.
      migrate: (persisted, version) => {
        const s = persisted as Record<string, unknown> & { attempts?: Attempt[] };
        if (version < 2) {
          delete s.tags;
          s.criteria = DEFAULT_CRITERIA;
          s.attempts = (s.attempts ?? []).map((a) => ({ ...a, ratings: a.ratings ?? {} }));
        }
        // v3 prefilled the backup repository.
        if (version < 3) {
          const cloud = s.cloud as Partial<CloudState> | undefined;
          if (cloud && !cloud.repo) s.cloud = { ...cloud, repo: 'blackj2493/ndecc-prep-data' };
        }
        return s as unknown as State;
      },
    },
  ),
);

export const pickData = (s: State): Data => ({
  sets: s.sets,
  campaigns: s.campaigns,
  settings: s.settings,
  attempts: s.attempts,
  runs: s.runs,
  criteria: s.criteria,
  icTags: s.icTags,
  reqNotes: s.reqNotes,
});

export const targetFor = (settings: Settings, set: PracticeSet | undefined, reqId: ReqId) =>
  set?.targets[reqId] ?? settings.targets[reqId];

// Debug handle for the browser console on the web build.
if (typeof window !== 'undefined') (window as unknown as { __ndecc: typeof useStore }).__ndecc = useStore;
