export type ReqId =
  | 'amalgam'
  | 'class2'
  | 'class4'
  | 'endo'
  | 'mod'
  | 'crownPrep'
  | 'provisional';

export interface Requirement {
  id: ReqId;
  name: string;
  short: string;
}

/** One project slot in a set: which tooth and which surfaces. */
export interface ToothSpec {
  tooth: string;
  surface: string;
}

export interface PracticeSet {
  id: string;
  name: string;
  teeth: Record<ReqId, ToothSpec>;
  /** Per-set target overrides in minutes. Missing = use the global target. */
  targets: Partial<Record<ReqId, number>>;
}

export interface CampaignItem {
  reqId: ReqId;
  tooth: string;
  surface: string;
  targetMin?: number;
}

export interface Campaign {
  id: string;
  name: string;
  items: CampaignItem[];
}

export interface ExamSession {
  name: string;
  minutes: number;
}

export interface Settings {
  sequence: ReqId[];
  targets: Record<ReqId, number>;
  sessions: ExamSession[];
  breakMinutes: number;
  /** Minutes before a project's target end that trigger a warning. */
  projectWarnings: number[];
  halfwayAlert: boolean;
  endAlert: boolean;
  /** Minutes before a session ends that trigger a warning. */
  sessionWarnings: number[];
}

export type Grade = 'C' | 'MC' | 'NC';

/** One line of the NDEB-style checklist for a requirement. */
export interface Criterion {
  id: string;
  name: string;
  /** Short summary of the NDEB thresholds. */
  hint: string;
  /** Typical findings you can tag, stored on the attempt as "Name: detail". */
  details: string[];
}

export interface Attempt {
  id: string;
  runId?: string;
  reqId: ReqId;
  setId?: string;
  tooth: string;
  surface: string;
  /** ISO date-time when the project started. */
  date: string;
  durationSec: number;
  targetSec: number;
  /** Seconds of exam time that had passed when this project started (mock runs only). */
  examOffsetSec?: number;
  position?: number;
  repeats: number;
  /** Worst checklist rating. Null when nothing is rated. */
  grade: Grade | null;
  /** Checklist ratings by criterion id. */
  ratings: Record<string, Grade>;
  /** Findings, as "Criterion: detail". */
  tags: string[];
  notes: string;
  /** File names inside the app's photo folder. */
  photos: string[];
}

export interface RunRecord {
  id: string;
  kind: 'mock' | 'campaign' | 'single';
  title: string;
  setId?: string;
  startedAt: string;
  endedAt: string;
  activeSec: number;
  attemptIds: string[];
  icErrors: string[];
  notes: string;
}

export type ItemStatus = 'pending' | 'active' | 'done' | 'skipped';

export interface RunItem {
  key: string;
  reqId: ReqId;
  tooth: string;
  surface: string;
  targetSec: number;
  status: ItemStatus;
  activeMs: number;
  repeats: number;
  startedAt?: number;
  examOffsetMs?: number;
}

export type RunPhase = 'ready' | 'running' | 'paused' | 'break' | 'finished';

export interface ActiveRun {
  id: string;
  kind: RunRecord['kind'];
  title: string;
  setId?: string;
  items: RunItem[];
  currentKey: string | null;
  phase: RunPhase;
  /** Start of the current running segment (epoch ms). */
  segStart: number | null;
  sessions: ExamSession[];
  breakMinutes: number;
  sessionIndex: number;
  sessionMs: number;
  examMs: number;
  breakStartedAt: number | null;
  startedAt: number | null;
  firedAlerts: string[];
  /** Copied from settings when the run starts, so later edits do not change a live run. */
  alertCfg: Pick<Settings, 'projectWarnings' | 'halfwayAlert' | 'endAlert' | 'sessionWarnings'>;
}
