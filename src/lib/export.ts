import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { REQ_BY_ID } from './defaults';
import { criteriaStats, fmtMin, overview } from './stats';
import type { Data } from './store';

const GRADE = { C: 'Competent', MC: 'Minimally competent', NC: 'Not competent' } as const;
const SHORT = { C: 'OK', MC: 'MC', NC: 'FAIL' } as const;

/** A prompt plus the data, for pasting into the Claude app. */
export function claudeReport(data: Data, reqId?: string): string {
  const attempts = data.attempts
    .filter((a) => !reqId || a.reqId === reqId)
    .sort((a, b) => a.date.localeCompare(b.date));
  const ov = overview(data.attempts, data.settings);
  const setName = (id?: string) => data.sets.find((s) => s.id === id)?.name ?? '';
  const lines: string[] = [];
  lines.push(
    'I am preparing for the NDEB NDECC Clinical Skills exam (7 requirements on a manikin, 8 h, all 7 must pass).',
    'Each attempt is self-rated on an NDEB-style checklist: OK = competent, MC = minimally competent (still a pass), FAIL = not competent.',
    'Below is my practice log. Please analyse it as an experienced clinical instructor:',
    '1. My weakest requirements, for speed AND for quality, with evidence from the log.',
    '2. Recurring mistakes, and whether each one is getting better or worse.',
    '3. Whether I can finish all 7 within the exam time, and where the time risk is.',
    '4. A concrete practice plan for the next 7 days.',
    'Be direct. Say when the data is too thin to conclude something.',
    '',
    `Exam time: ${fmtMin(ov.examSec)} in ${data.settings.sessions.length} sessions, ${data.settings.breakMinutes} min break.`,
    `Forecast for a full set from recent medians: ${fmtMin(ov.forecastSec)}.`,
    '',
    '## Summary per requirement',
  );
  for (const p of ov.per) {
    if (reqId && p.reqId !== reqId) continue;
    lines.push(
      `- ${REQ_BY_ID[p.reqId].name}: ${p.count} attempts; target ${data.settings.targets[p.reqId]} min; ` +
        `recent median ${fmtMin(p.recentMedianSec)}; best ${fmtMin(p.bestSec)}; ` +
        `on target ${p.onTargetPct == null ? '–' : Math.round(p.onTargetPct) + '%'}; ` +
        `pass ${p.passPct == null ? '–' : Math.round(p.passPct) + '%'} of ${p.graded} graded; ` +
        `top mistakes: ${p.topTags.slice(0, 4).map((t) => `${t.tag} (${t.count})`).join(', ') || 'none'}`,
    );
    const weak = criteriaStats(data.attempts, p.reqId, data.criteria[p.reqId])
      .filter((cs) => cs.nc + cs.mc > 0)
      .map((cs) => `${cs.name} ${cs.nc} fail/${cs.mc} MC of ${cs.rated}`);
    if (weak.length) lines.push(`  Checklist problems: ${weak.join('; ')}`);
    const notes = data.reqNotes[p.reqId];
    if (notes) lines.push(`  My technique notes: ${notes.replace(/\s+/g, ' ')}`);
  }
  lines.push('', '## Every attempt (oldest first)');
  for (const a of attempts)
    lines.push(
      [
        a.date.slice(0, 10),
        REQ_BY_ID[a.reqId].short,
        `${a.tooth}${a.surface ? ' ' + a.surface : ''}`,
        setName(a.setId),
        `${fmtMin(a.durationSec)} (target ${fmtMin(a.targetSec)})`,
        a.examOffsetSec != null ? `started at ${fmtMin(a.examOffsetSec)} into the mock` : '',
        a.grade ? GRADE[a.grade] : 'not graded',
        Object.keys(a.ratings).length
          ? 'checklist: ' +
            (data.criteria[a.reqId] ?? [])
              .filter((cr) => a.ratings[cr.id] && a.ratings[cr.id] !== 'C')
              .map((cr) => `${cr.name}=${SHORT[a.ratings[cr.id]]}`)
              .join(', ')
              .replace(/^$/, 'all OK')
          : '',
        a.tags.length ? `findings: ${a.tags.join(', ')}` : '',
        a.notes ? `notes: ${a.notes.replace(/\s+/g, ' ')}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
    );
  const ic = data.runs.filter((r) => r.icErrors.length);
  if (!reqId && ic.length) {
    lines.push('', '## Infection control errors per mock');
    for (const r of ic) lines.push(`- ${r.startedAt.slice(0, 10)} ${r.title}: ${r.icErrors.join(', ')}`);
  }
  return lines.join('\n');
}

export async function copyForClaude(data: Data, reqId?: string) {
  await Clipboard.setStringAsync(claudeReport(data, reqId));
}

export async function shareBackup(data: Data) {
  const f = new File(Paths.cache, `ndecc-prep-backup-${new Date().toISOString().slice(0, 10)}.json`);
  if (f.exists) f.delete();
  f.create();
  await f.write(JSON.stringify({ app: 'ndecc-prep', version: 1, data }, null, 1));
  await Sharing.shareAsync(f.uri, { mimeType: 'application/json', UTI: 'public.json' });
}

export async function pickBackup(): Promise<Data | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.length) return null;
  const parsed = JSON.parse(await new File(res.assets[0].uri).text());
  if (parsed?.app !== 'ndecc-prep' || !parsed.data?.attempts) throw new Error('This file is not an NDECC Prep backup.');
  return parsed.data as Data;
}
