import { useState } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { GRADE_SHORT, keyDate, type CalendarDay, type WeekPoint } from '../lib/progress';
import { fmtDate } from '../lib/stats';
import type { Grade, ReqId } from '../lib/types';
import { T, useTheme } from './ui';

/** Short names that fit on a chip. */
export const REQ_CHIP: Record<ReqId, string> = {
  amalgam: 'Amalgam',
  class2: 'Cl II',
  class4: 'Cl IV',
  endo: 'Endo',
  mod: 'MOD',
  crownPrep: 'Crown',
  provisional: 'Prov',
};

/** SVG text needs its own font; the default is a serif font. */
const FONT = '-apple-system, system-ui, Helvetica, Arial, sans-serif';

const useDark = () => useColorScheme() === 'dark';

/** Fill colours for 0, 1, 2-3 and 4+ projects (or times done). */
export function useShades() {
  const dark = useDark();
  return dark ? ['#2C2C2E', '#134E4A', '#0F766E', '#2DD4BF'] : ['#ECEEF1', '#B9E2DD', '#5FB8AD', '#0F766E'];
}
/** Text colour on top of shade i. */
export const useShadeText = () => {
  const dark = useDark();
  return (i: number) => (dark ? (i === 3 ? '#04211E' : '#E5E7EB') : i === 3 ? '#FFFFFF' : '#0B3B37');
};

export function useGradeColors() {
  const dark = useDark();
  return (g: Grade) =>
    dark
      ? { C: { bg: '#14532D', fg: '#DCFCE7' }, MC: { bg: '#78350F', fg: '#FEF3C7' }, NC: { bg: '#7F1D1D', fg: '#FEE2E2' } }[g]
      : { C: { bg: '#DCFCE7', fg: '#14532D' }, MC: { bg: '#FEF3C7', fg: '#78350F' }, NC: { bg: '#FEE2E2', fg: '#7F1D1D' } }[g];
}

/** A small label, coloured by grade when there is one. */
export function GradeChip({ grade, label }: { grade: Grade | null; label?: string }) {
  const c = useTheme();
  const col = useGradeColors();
  const k = grade ? col(grade) : { bg: c.border, fg: c.text };
  const text = label ?? (grade ? GRADE_SHORT[grade] : 'not graded');
  return (
    <View style={{ backgroundColor: k.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
      <Text style={{ color: k.fg, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

/** Two or more options side by side; one is selected. */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  const c = useTheme();
  const dark = useDark();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: dark ? '#2C2C2E' : '#E3E3E8', borderRadius: 9, padding: 2 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 8,
              borderRadius: 7,
              backgroundColor: on ? (dark ? '#48484A' : '#FFFFFF') : 'transparent',
            }}
          >
            <Text style={{ color: c.text, fontSize: 14, fontWeight: on ? '600' : '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  const c = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: c.card, borderRadius: 12, padding: 12, gap: 2 }}>
      <T muted size={12}>
        {label}
      </T>
      <T size={24} weight="700" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </T>
      {sub ? (
        <T size={12} weight="600" style={{ color: tone ? c[tone] : c.muted }}>
          {sub}
        </T>
      ) : null}
    </View>
  );
}

const shadeIndex = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3);

/** Weeks as columns, Monday at the top. The number in a square = projects that day. */
export function PracticeCalendar({ days, onDay }: { days: CalendarDay[]; onDay?: (key: string) => void }) {
  const c = useTheme();
  const shades = useShades();
  const fg = useShadeText();
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  const label = (i: number) => fmtDate(keyDate(weeks[i][0].key).toISOString());
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View style={{ width: 14, gap: 4 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <View key={i} style={{ height: 30, justifyContent: 'center' }}>
              <T muted size={11}>
                {d}
              </T>
            </View>
          ))}
        </View>
        {weeks.map((w) => (
          <View key={w[0].key} style={{ flex: 1, gap: 4 }}>
            {w.map((d) => {
              const i = shadeIndex(d.count);
              return (
                <Pressable
                  key={d.key}
                  disabled={!onDay || d.count === 0}
                  onPress={() => onDay?.(d.key)}
                  accessibilityLabel={`${d.key}: ${d.count} projects`}
                  style={{
                    height: 30,
                    borderRadius: 5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: d.future ? 'transparent' : shades[i],
                    borderWidth: d.future ? 1 : d.today ? 2 : 0,
                    borderStyle: d.future ? 'dashed' : 'solid',
                    borderColor: d.future ? c.border : c.text,
                  }}
                >
                  {d.count > 0 && <Text style={{ fontSize: 11, fontWeight: '600', color: fg(i) }}>{d.count}</Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 18 }}>
        <T muted size={11}>
          {label(0)}
        </T>
        <T muted size={11}>
          {label(Math.floor(weeks.length / 2))}
        </T>
        <T muted size={11}>
          this week
        </T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <T muted size={12}>
          Projects per day:
        </T>
        {['0', '1', '2–3', '4+'].map((l, i) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: shades[i] }} />
            <T muted size={12}>
              {l}
            </T>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Pass rate and on-target rate per week, 0-100 %. A week with no data leaves a gap. */
export function WeekChart({ weeks }: { weeks: WeekPoint[] }) {
  const c = useTheme();
  const dark = useDark();
  const orange = dark ? '#FB923C' : '#C2410C';
  const [w, setW] = useState(0);
  const h = 150;
  const pad = { l: 34, r: 34, t: 10, b: 22 };
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (weeks.length - 1);
  const y = (v: number) => pad.t + (1 - v / 100) * (h - pad.t - pad.b);
  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v == null) return void (pen = false);
      d += `${pen ? 'L' : 'M'}${x(i)},${y(v)} `;
      pen = true;
    });
    return d.trim();
  };
  const lastOf = (vals: (number | null)[]) => {
    for (let i = vals.length - 1; i >= 0; i--) if (vals[i] != null) return { i, v: vals[i]! };
    return null;
  };
  const pass = weeks.map((p) => p.passPct);
  const target = weeks.map((p) => p.onTargetPct);
  const lp = lastOf(pass);
  const lt = lastOf(target);
  const series: { vals: (number | null)[]; color: string; dash?: string; last: typeof lp; dy: number }[] = [
    { vals: pass, color: c.accent, last: lp, dy: lp && lt && lp.v < lt.v ? 14 : -8 },
    { vals: target, color: orange, dash: '5 4', last: lt, dy: lp && lt && lp.v < lt.v ? -8 : 14 },
  ];
  return (
    <View style={{ gap: 6 }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={h}>
            {[0, 50, 100].map((v) => (
              <SvgText fontFamily={FONT} key={v} x={pad.l - 6} y={y(v) + 4} fontSize={10} fill={c.muted} textAnchor="end">
                {`${v}%`}
              </SvgText>
            ))}
            {[0, 50, 100].map((v) => (
              <Line key={v} x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={c.border} strokeWidth={1} />
            ))}
            {series.map((s, k) => (
              <Path key={k} d={s.vals.some((v) => v != null) ? path(s.vals) : ''} stroke={s.color} strokeWidth={2.5} strokeDasharray={s.dash} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {series.map((s, k) =>
              s.vals.map((v, i) => (v == null ? null : <Circle key={`${k}-${i}`} cx={x(i)} cy={y(v)} r={3.5} fill={s.color} />)),
            )}
            {series.map((s, k) =>
              s.last ? (
                <SvgText fontFamily={FONT} key={`l${k}`} x={x(s.last.i) + 6} y={y(s.last.v) + s.dy} fontSize={11} fontWeight="700" fill={s.color}>
                  {`${s.last.v}%`}
                </SvgText>
              ) : null,
            )}
            <SvgText fontFamily={FONT} x={pad.l} y={h - 6} fontSize={10} fill={c.muted}>
              {fmtDate(keyDate(weeks[0].start).toISOString())}
            </SvgText>
            <SvgText fontFamily={FONT} x={w - pad.r} y={h - 6} fontSize={10} fill={c.muted} textAnchor="end">
              this week
            </SvgText>
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: c.accent }} />
          <T size={12}>Pass rate (OK + MC)</T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 18, height: 0, borderTopWidth: 3, borderStyle: 'dashed', borderColor: orange }} />
          <T size={12}>Finished on target time</T>
        </View>
      </View>
    </View>
  );
}
