import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_SETS, DEFAULT_SETTINGS, DEFAULT_TAGS, IC_CRITICAL, IC_ERRORS } from './defaults';
import type {
  ActiveRun,
  Attempt,
  Campaign,
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
  tags: Record<ReqId, string[]>;
  icTags: string[];
  /** Free technique notes for each requirement ("my method"). */
  reqNotes: Partial<Record<ReqId, string>>;
}

interface State extends Data {
  activeRun: ActiveRun | null;
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
  setTags: (reqId: ReqId, tags: string[]) => void;
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
  tags: DEFAULT_TAGS,
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
      setTags: (reqId, tags) => set((s) => ({ tags: { ...s.tags, [reqId]: tags } })),
      setIcTags: (icTags) => set({ icTags }),
      setReqNotes: (reqId, text) => set((s) => ({ reqNotes: { ...s.reqNotes, [reqId]: text } })),
      replaceAll: (data) => set({ ...initialData(), ...data }),
    }),
    {
      name: 'ndecc-prep',
      version: 1,
      storage: createJSONStorage(() => Storage),
    },
  ),
);

export const pickData = (s: State): Data => ({
  sets: s.sets,
  campaigns: s.campaigns,
  settings: s.settings,
  attempts: s.attempts,
  runs: s.runs,
  tags: s.tags,
  icTags: s.icTags,
  reqNotes: s.reqNotes,
});

export const targetFor = (settings: Settings, set: PracticeSet | undefined, reqId: ReqId) =>
  set?.targets[reqId] ?? settings.targets[reqId];
