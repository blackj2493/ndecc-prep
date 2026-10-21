import type { Criterion, Grade, ReqId } from './types';

// Criteria = the user's own checklist, plus points the NDEB 2026 Protocol (pp. 19-25) grades
// that the user's list did not have. Hints summarise the NDEB thresholds:
// C = Competent, MC = Minimally Competent (still a pass), Fail = Not Competent.

const c = (id: string, name: string, hint: string, details: string[]): Criterion => ({ id, name, hint, details });

const damage = (fail = 'Fail: needs a restoration; excessive soft-tissue damage; repaired with material.') =>
  c(
    'damage',
    'Damage',
    `C: none. MC: fixable by enameloplasty; minor soft-tissue damage. ${fail}`,
    ['Examination tooth', 'Adjacent tooth', 'Soft tissue'],
  );

const critical = (details: string[]) =>
  c('critical', 'Critical errors', 'Any one of these fails the requirement.', details);

function restoration(kind: 'amalgam' | 'class2' | 'class4'): Criterion[] {
  const resin = kind !== 'amalgam';
  return [
    c(
      'margin',
      'Margin',
      'C: junction not detectable. MC: deficiency or excess that can be corrected' +
        (kind === 'amalgam' ? ' (enameloplasty); excess not harming the gingiva.' : '.') +
        ' Fail: void or deficiency that needs a new restoration; excess that ' +
        (kind === 'amalgam' ? 'harms the gingiva.' : 'cannot be corrected.'),
      ['Void', 'Deficiency', 'Excess / overhang', ...(kind === 'class4' ? [] : ['Marginal ridge height'])],
    ),
    c(
      'contact',
      'Contact',
      `C: optimal. MC: present but too ${kind === 'class4' ? 'incisal' : 'occlusal'} or too gingival. Fail: open or light (food impaction); unwaxed floss cannot pass.`,
      ['Open', 'Light', 'Too tight', kind === 'class4' ? 'Too incisal' : 'Too occlusal', 'Too gingival'],
    ),
    c(
      'contour',
      'Contour',
      'MC: over- or undercontour that does not harm the gingiva. Fail: contour that harms the gingiva' +
        (kind === 'class4' ? ' or esthetics; incisal edge out of harmony.' : '.'),
      kind === 'class4'
        ? ['Overcontoured', 'Undercontoured', 'Facial contour', 'Lingual contour', 'Incisal edge length']
        : ['Overcontoured', 'Undercontoured', 'Poor occlusal anatomy'],
    ),
    c(
      'bite',
      'Bite',
      'MC: high, but light contacts remain on other teeth. Fail: so high it can fracture the restoration or the opposing tooth' +
        (kind === 'class4' ? '.' : '; occlusal surface too thin.'),
      kind === 'class4' ? ['High', 'High in protrusion'] : ['High', 'Too thin occlusally', 'No occlusal contact'],
    ),
    c(
      'finish',
      'Finish',
      'MC: roughness that polishing fixes' +
        (resin ? '; contamination that can be corrected' : '') +
        '. Fail: roughness whose correction ruins the contour; voids or porosity that weaken it' +
        (resin ? '; incomplete polymerization; contamination needing replacement.' : '.'),
      ['Rough', 'Voids / porosity', ...(resin ? ['Contamination', 'Incomplete cure'] : [])],
    ),
    damage(),
    critical(['Wrong tooth', 'Wrong material', 'Fractured or loose', 'No restoration']),
  ];
}

export const DEFAULT_CRITERIA: Record<ReqId, Criterion[]> = {
  amalgam: restoration('amalgam'),
  class2: restoration('class2'),
  class4: restoration('class4'),
  endo: [
    c(
      'outline',
      'External outline',
      'C: straight-line access to ALL canals, pulp horns removed. MC: access to all canals; overextension that does not weaken the tooth. Fail: any canal restricted; outline past a cusp ridge, marginal ridge, incisal edge or cingulum.',
      ['Canal not visible', 'Underextended', 'Overextended', 'Wrong position'],
    ),
    c(
      'walls',
      'Internal walls',
      'C: all pulp removed, smooth. MC: minimal pulp left; minimal gouging. Fail: excessive pulp; removal that changes the restoration plan.',
      ['Pulp tissue left', 'Pulp horns left', 'Gouging', 'Rough walls'],
    ),
    c(
      'depth',
      'Canal access 2 mm',
      'C: canals accessed to 2.0 mm. MC: less than 2.0 mm (still a pass), or over-instrumented without harm.',
      ['Less than 2 mm', 'Over-instrumented'],
    ),
    c(
      'debris',
      'No debris',
      'MC: minimal debris; every canal still accessible. Fail: debris that blocks the chamber or a canal.',
      ['Debris in chamber', 'Debris blocks a canal'],
    ),
    c('perforation', 'No perforation', 'Any perforation fails. A pulp chamber that is not reached fails.', [
      'Floor perforation',
      'Wall perforation',
      'Chamber not reached',
    ]),
    damage('Fail: damage that changes the restoration plan; adjacent tooth needs a restoration.'),
    critical(['Wrong tooth', 'No access on the assigned tooth']),
  ],
  mod: [
    c(
      'depth',
      'Depth',
      'Pulpal floor. C: 1.5 to <2.0 mm. MC: 1.0–1.5 or 2.0–3.0 mm. Fail: <1.0 or ≥3.0 mm.',
      ['Too shallow', 'Too deep', 'Uneven floor'],
    ),
    c(
      'width',
      'Width (B-L)',
      'C: optimal convenience and resistance form. MC: too wide but acceptable. Fail: too narrow for the smallest condenser; width that weakens the tooth.',
      ['Too wide', 'Too narrow', 'Isthmus too wide'],
    ),
    c(
      'convergence',
      'Convergence',
      'C: walls converge occlusally. Fail: divergent box walls; occlusally divergent internal form that loses retention.',
      ['Box walls diverge', 'Occlusal walls diverge'],
    ),
    c(
      'proxClear',
      'Proximal clearance',
      'C: 0.5 mm. MC: 0–0.5 or 0.5–1.5 mm. Fail: ≥1.5 mm, or not clear of the adjacent tooth.',
      ['Not cleared', 'Too little', 'Too much'],
    ),
    c(
      'gingClear',
      'Gingival clearance',
      'C: apical to contact and >0.5 mm above the gum. MC: ≤0.5 mm above the gum; clearance 0.5–2.0 mm. Fail: ≥2.0 mm; subgingival; not clear of the adjacent tooth.',
      ['Not cleared', 'Subgingival', 'Too much'],
    ),
    c(
      'boxSeat',
      'Box seat width',
      'Gingival floor M-D. Premolar: C 1.0–<1.5, MC 1.5–<2.0, Fail <1.0 or ≥2.0 mm. Molar: C 1.0–<2.0, MC 2.0–<3.0, Fail <1.0 or ≥3.0 mm.',
      ['Too narrow', 'Too wide', 'Not flat'],
    ),
    c(
      'exitAngles',
      'Exit angles',
      'Fail: flared buccal or lingual wall of the proximal box.',
      ['Buccal wall flared', 'Lingual wall flared'],
    ),
    c(
      'internal',
      'Axial wall and internal form',
      'NDEB extra. C: rounded internal line angles; reverse curve where needed. Fail: no axial wall (no step between pulpal and gingival floor).',
      ['No axial wall', 'Sharp line angles', 'No reverse curve'],
    ),
    c(
      'enamel',
      'No unsupported enamel',
      'MC: unsupported enamel that does not compromise the margin. Fail: it compromises the margin; overpreparation leaves unsupported enamel occlusally.',
      ['Proximal', 'Occlusal'],
    ),
    c(
      'finish',
      'Finish',
      'C: smooth margins and walls. MC: roughness that does not compromise the restoration. Fail: roughness that does.',
      ['Rough margin', 'Rough internal walls'],
    ),
    damage(),
    critical(['Wrong tooth', 'Wrong preparation design', 'No preparation']),
  ],
  crownPrep: [
    c(
      'taper',
      'Taper',
      'MC: too much convergence that keeps retention; walls so parallel the provisional is hard to draw. Fail: convergence that loses retention.',
      ['Too much taper', 'Too parallel'],
    ),
    c(
      'path',
      'Path of draw',
      'C: no undercuts. MC: undercut a spacer can block. Fail: undercut that needs the prep changed; crown cannot seat or come off.',
      ['Undercut', 'No common path'],
    ),
    c(
      'marginHeight',
      'Margin height',
      'C: 0.5 mm above the gum. MC: 0–<0.5 or 0.5–1.0 mm above, or ≤1.0 mm below. Fail: >1.0 mm above or below; margin does not follow the gingival contour.',
      ['Too high', 'Too low', 'Does not follow the gingiva'],
    ),
    c(
      'marginWidth',
      'Margin width',
      'Axial reduction at the margin. MC: facial within 0.5 mm of the requirement. Fail: >1.5 mm; facial <0.5 mm; lingual <0.3 mm; wrong margin design.',
      ['Too wide', 'Too narrow facially', 'Too narrow lingually', 'Wrong design'],
    ),
    c(
      'marginSmooth',
      'Smooth margin',
      'C: optimally defined. MC: continuous with irregularity. Fail: discontinuous or not discernible.',
      ['Irregular', 'Discontinuous', 'Lip / unsupported edge'],
    ),
    c(
      'redBuccal',
      'Reduction: buccal',
      'MC: over-reduction that keeps vitality; under-reduction that keeps contour. Fail: too little for the restoration; too much for vitality or retention.',
      ['Under-reduced', 'Over-reduced', 'Not following the contour'],
    ),
    c('redLingual', 'Reduction: lingual', 'Same rules as buccal.', [
      'Under-reduced',
      'Over-reduced',
      'Not following the contour',
    ]),
    c(
      'redOcclusal',
      'Reduction: incisal / occlusal',
      'Fail: too little for the restoration; reduction that ignores the occlusal plane or the existing clearance.',
      ['Under-reduced', 'Over-reduced', 'Flat / not following the anatomy'],
    ),
    c(
      'clearance',
      'Clearance',
      'The examiner checks clearance in maximum intercuspation.',
      ['Too little in MIP', 'Too little in excursion'],
    ),
    c(
      'finish',
      'Finish',
      'MC: sharp line angle or roughness without harm. Fail: sharp angle or unsupported enamel that compromises the tooth or margin; tooth rebuilt with material.',
      ['Sharp line angles', 'Rough surfaces', 'Unsupported enamel'],
    ),
    damage(),
    critical(['Wrong tooth', 'No preparation']),
  ],
  provisional: [
    c(
      'margin',
      'Margin',
      'MC: underextended without losing the seal; overextended without harming the gingiva. Fail: open margin (no seal); overcontoured margin that harms the gingiva; thin, weak margin.',
      ['Open / short', 'Overextended', 'Overcontoured', 'Thin'],
    ),
    c(
      'fit',
      'Seating and stability',
      'NDEB extra. MC: fully seated, stable and retentive. Fail: unstable; cannot be seated or removed.',
      ['Not fully seated', 'Rocks', 'Locked in undercut'],
    ),
    c(
      'contact',
      'Contact',
      'MC: present but too occlusal or too gingival. Fail: open or light; unwaxed floss cannot pass.',
      ['Open', 'Light', 'Too tight', 'Wrong position'],
    ),
    c(
      'contour',
      'Contour',
      'Fail: does not reproduce the natural contour and harms the gingiva, esthetics or strength.',
      ['Overcontoured', 'Undercontoured', 'Poor anatomy'],
    ),
    c(
      'bite',
      'Bite',
      'MC: high, but light contacts remain in the quadrant. Fail: so high it can fracture the crown or the opposing tooth.',
      ['High', 'No occlusal contact'],
    ),
    c(
      'finish',
      'Finish',
      'MC: roughness that lets floss pass; small cracks or thin areas without risk. Fail: roughness that breaks floss; porosity that traps food; crack likely to fail.',
      ['Rough', 'Porosity / bubbles', 'Crack', 'Thin area'],
    ),
    c(
      'excess',
      'No excess material',
      'Fail: excess material on soft or hard tissue.',
      ['Under the gum', 'On adjacent teeth'],
    ),
    damage(),
    critical(['Fractured when submitted', 'No restoration']),
  ],
};

const ORDER: Grade[] = ['C', 'MC', 'NC'];

/** The NDEB grade is the worst rating on the checklist. */
export function overallGrade(ratings: Record<string, Grade>): Grade | null {
  const vals = Object.values(ratings);
  if (!vals.length) return null;
  return vals.reduce((w, g) => (ORDER.indexOf(g) > ORDER.indexOf(w) ? g : w), 'C' as Grade);
}

export const GRADE_LABEL: Record<Grade, string> = {
  C: 'Competent',
  MC: 'Minimally competent',
  NC: 'Not competent',
};
