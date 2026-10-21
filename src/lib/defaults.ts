import type { PracticeSet, ReqId, Requirement, Settings, ToothSpec } from './types';

export const REQUIREMENTS: Requirement[] = [
  { id: 'amalgam', name: 'Class II amalgam restoration', short: 'Amalgam' },
  { id: 'class2', name: 'Class II composite restoration', short: 'Class II comp' },
  { id: 'class4', name: 'Class IV composite restoration', short: 'Class IV comp' },
  { id: 'endo', name: 'Endodontic access', short: 'Endo access' },
  { id: 'mod', name: 'Class II amalgam preparation (MOD)', short: 'MOD prep' },
  { id: 'crownPrep', name: 'Crown preparation', short: 'Crown prep' },
  { id: 'provisional', name: 'Provisional crown', short: 'Provisional' },
];

export const REQ_BY_ID = Object.fromEntries(REQUIREMENTS.map((r) => [r.id, r])) as Record<
  ReqId,
  Requirement
>;

export const DEFAULT_SEQUENCE: ReqId[] = [
  'amalgam',
  'class2',
  'class4',
  'endo',
  'mod',
  'crownPrep',
  'provisional',
];

const t = (tooth: string, surface = ''): ToothSpec => ({ tooth, surface });

function set(
  n: number,
  crown: string,
  mod: string,
  class2: ToothSpec,
  class4: ToothSpec,
  amalgam: string,
  endo: string,
): PracticeSet {
  return {
    id: `set${n}`,
    name: `Set ${n}`,
    teeth: {
      crownPrep: t(crown),
      provisional: t(crown),
      mod: t(mod, 'MOD'),
      class2,
      class4,
      amalgam: t(amalgam),
      endo: t(endo),
    },
    targets: {},
  };
}

export const DEFAULT_SETS: PracticeSet[] = [
  set(1, '3.3', '1.5', t('4.7', 'ML'), t('1.1', 'ML'), '2.7', '3.6'),
  set(2, '1.3', '4.5', t('1.6', 'ML'), t('4.2', 'D'), '2.7', '3.6'),
  set(3, '1.6', '3.6', t('2.7', 'ML'), t('2.3', 'D'), '4.5', '3.4'),
  set(4, '2.6', '4.6', t('3.7', 'ML'), t('3.3', 'M'), '1.7', '2.1'),
  set(5, '4.3', '2.6', t('4.7', 'ML'), t('2.2', 'M'), '3.5', '1.1'),
];

export const DEFAULT_SETTINGS: Settings = {
  sequence: DEFAULT_SEQUENCE,
  targets: {
    amalgam: 40,
    class2: 70,
    class4: 55,
    endo: 30,
    mod: 45,
    crownPrep: 55,
    provisional: 35,
  },
  sessions: [
    { name: 'Morning', minutes: 240 },
    { name: 'Afternoon', minutes: 240 },
  ],
  breakMinutes: 30,
  projectWarnings: [10, 2],
  halfwayAlert: true,
  endAlert: true,
  sessionWarnings: [30, 10],
};

const COMMON = ['Wrong tooth', 'Restarted / repeated', 'Adjacent tooth damage', 'Soft tissue damage'];

export const DEFAULT_TAGS: Record<ReqId, string[]> = {
  mod: [
    ...COMMON,
    'Outline overextended',
    'Outline underextended',
    'Pulpal floor too shallow',
    'Pulpal floor too deep',
    'Isthmus too wide',
    'Proximal clearance inadequate',
    'Box walls not converging',
    'Gingival floor uneven',
    'Unsupported enamel',
    'Lingual convergence wrong',
  ],
  amalgam: [
    ...COMMON,
    'Open contact',
    'Overhang',
    'Underfilled',
    'Overfilled / high occlusion',
    'Marginal ridge height wrong',
    'Poor anatomy',
    'Wedge not seated',
    'Voids',
  ],
  class2: [
    ...COMMON,
    'Prep overextended',
    'Open contact',
    'Overhang',
    'Underfilled',
    'Flash at margins',
    'Poor anatomy',
    'Wedge not seated',
    'Voids',
  ],
  class4: [
    ...COMMON,
    'Prep overextended',
    'Bevel missing',
    'Incisal length wrong',
    'Facial contour wrong',
    'Lingual contour wrong',
    'Open contact',
    'Overhang / flash',
    'Voids',
  ],
  endo: [
    ...COMMON,
    'Outline wrong shape',
    'Overextended access',
    'Pulp horns not unroofed',
    'Canal / orifice missed',
    'No straight-line access',
    'Gouging',
    'Perforation',
  ],
  crownPrep: [
    ...COMMON,
    'Over-reduction',
    'Under-reduction (occlusal)',
    'Under-reduction (axial)',
    'Undercut',
    'Excessive taper',
    'Margin not continuous',
    'Margin position wrong',
    'Sharp line angles',
  ],
  provisional: [
    ...COMMON,
    'Open margin',
    'Overextended margin',
    'Open contact',
    'High occlusion',
    'Poor contour',
    'Voids / bubbles',
    'Locked in undercut',
    'Poor finish / polish',
  ],
};

/** From the 2026 NDECC Protocol, pages 13-14. Two errors per session are allowed; three fail. */
export const IC_ERRORS = [
  'Hand hygiene not performed',
  'Mask not worn correctly',
  'Eye protection not worn correctly',
  'Hair not controlled',
  'Gloves with tears or holes',
  'Face / hair / mask touched with gloves',
  'Loupe cord or battery touched with gloves',
  'Clothing touched with gloves',
  'Contaminated surface / supplies / instruments',
  'Bulk container on working surface',
  'Unsafe placement of supplies or instruments',
  'Amalgam handled or disposed incorrectly',
  'Sharps handled incorrectly',
  'No cooling water with high-speed',
  'Supplies contaminated by aerosols',
  'Leaning on the patient',
  'Manikin not treated like a patient',
  'Material left at the exam tooth',
  'Oral cavity cover damaged',
];

export const IC_CRITICAL = [
  'CRITICAL: Mask not worn',
  'CRITICAL: Gloves not worn',
  'CRITICAL: Eye protection not worn',
  'CRITICAL: Loose supplies left in the mouth',
];
