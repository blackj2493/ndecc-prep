import { Icon } from './Icon';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GRADE_LABEL, overallGrade } from '../lib/criteria';
import type { Criterion, Grade } from '../lib/types';
import { Btn, Chip, Divider, Input, T, useTheme } from './ui';

const OPTIONS: { g: Grade; label: string }[] = [
  { g: 'C', label: 'OK' },
  { g: 'MC', label: 'MC' },
  { g: 'NC', label: 'Fail' },
];

export const tagOf = (cr: Criterion, detail: string) => `${cr.name}: ${detail}`;

export function GradeBadge({ grade }: { grade: Grade | null }) {
  const c = useTheme();
  const color = grade === 'C' ? c.good : grade === 'MC' ? c.warn : grade === 'NC' ? c.bad : c.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon
        name={grade === 'NC' ? 'xmark.circle.fill' : grade ? 'checkmark.circle.fill' : 'circle.dashed'}
        color={color}
        size={20}
      />
      <T weight="700" style={{ color }}>
        {grade ? GRADE_LABEL[grade] : 'Not graded'}
      </T>
    </View>
  );
}

export function Checklist({
  criteria,
  ratings,
  tags,
  onChange,
  onAddDetail,
}: {
  criteria: Criterion[];
  ratings: Record<string, Grade>;
  tags: string[];
  onChange: (ratings: Record<string, Grade>, tags: string[]) => void;
  onAddDetail: (criterionId: string, detail: string) => void;
}) {
  const c = useTheme();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const rated = criteria.filter((cr) => ratings[cr.id]).length;
  const grade = overallGrade(ratings);

  const rate = (cr: Criterion, g: Grade) => {
    const next = { ...ratings };
    if (next[cr.id] === g) delete next[cr.id];
    else next[cr.id] = g;
    // An OK criterion keeps no findings.
    const nextTags = next[cr.id] === 'C' ? tags.filter((t) => !t.startsWith(`${cr.name}: `)) : tags;
    onChange(next, nextTags);
    // Open the findings of a problem criterion so the detail is one more tap.
    if (g !== 'C' && next[cr.id]) setOpen(cr.id);
  };

  const toggleTag = (t: string) => onChange(ratings, tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t]);

  const restOk = () => {
    const next = { ...ratings };
    for (const cr of criteria) if (!next[cr.id] && cr.id !== 'critical') next[cr.id] = 'C';
    onChange(next, tags);
  };

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GradeBadge grade={grade} />
        <T muted size={13}>
          {rated} of {criteria.length} rated
        </T>
      </View>
      <T muted size={12}>
        The grade is the worst rating, the same as the NDEB. MC = minimally competent, which is still a pass.
      </T>

      {criteria.map((cr) => {
        const r = ratings[cr.id];
        const isOpen = open === cr.id;
        const found = cr.details.filter((d) => tags.includes(tagOf(cr, d)));
        return (
          <View key={cr.id}>
            <Divider />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
              <Pressable style={{ flex: 1 }} onPress={() => setOpen(isOpen ? null : cr.id)} hitSlop={6}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <T weight="500" size={15} style={{ flexShrink: 1 }}>
                    {cr.name}
                  </T>
                  <Icon name={isOpen ? 'chevron.up' : 'chevron.down'} color={c.muted} size={11} />
                </View>
                {found.length > 0 && (
                  <T size={12} style={{ color: r === 'NC' ? c.bad : c.warn }} numberOfLines={2}>
                    {found.join(', ')}
                  </T>
                )}
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {OPTIONS.map(({ g, label }) => {
                  const on = r === g;
                  const tone = g === 'C' ? c.good : g === 'MC' ? c.warn : c.bad;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => rate(cr, g)}
                      style={{
                        minWidth: 46,
                        paddingVertical: 7,
                        borderRadius: 8,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: on ? tone : c.border,
                        backgroundColor: on ? tone : 'transparent',
                      }}
                    >
                      <Text style={{ color: on ? '#fff' : c.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {isOpen && (
              <View style={{ gap: 8, paddingBottom: 10 }}>
                <T muted size={13}>
                  {cr.hint}
                </T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {cr.details.map((d) => (
                    <Chip key={d} label={d} selected={tags.includes(tagOf(cr, d))} onPress={() => toggleTag(tagOf(cr, d))} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Input style={{ flex: 1 }} value={draft} onChangeText={setDraft} placeholder="Other finding" />
                  <Btn
                    title="Add"
                    kind="secondary"
                    disabled={!draft.trim()}
                    onPress={() => {
                      const d = draft.trim();
                      onAddDetail(cr.id, d);
                      if (!tags.includes(tagOf(cr, d))) onChange(ratings, [...tags, tagOf(cr, d)]);
                      setDraft('');
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}
      <Btn title="Rate the rest OK" kind="secondary" icon="checkmark.circle" disabled={criteria.every((cr) => ratings[cr.id] || cr.id === 'critical')}
        onPress={restOk} />
    </View>
  );
}
