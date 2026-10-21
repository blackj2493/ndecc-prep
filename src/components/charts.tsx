import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { fmtDate, fmtMin, type CriterionStats } from '../lib/stats';
import type { Attempt } from '../lib/types';
import { T, useTheme } from './ui';

/** Minutes per attempt over time, with the target as a dashed reference line. Tap a point for details. */
export function TimeChart({ attempts, targetMin }: { attempts: Attempt[]; targetMin: number }) {
  const c = useTheme();
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const list = [...attempts].sort((a, b) => a.date.localeCompare(b.date));
  const h = 180;
  const pad = { l: 34, r: 10, t: 10, b: 20 };
  if (list.length < 2)
    return (
      <T muted size={14}>
        The chart appears after two attempts.
      </T>
    );
  const ys = list.map((a) => a.durationSec / 60);
  const max = Math.max(...ys, targetMin) * 1.1;
  const min = Math.max(0, Math.min(...ys, targetMin) * 0.8);
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (list.length - 1);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b);
  const ticks = [min, (min + max) / 2, max].map((v) => Math.round(v));
  const path = ys.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');
  const s = sel != null ? list[sel] : null;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={h}>
          {ticks.map((v) => (
            <SvgText key={v} x={pad.l - 6} y={y(v) + 4} fontSize={11} fill={c.muted} textAnchor="end">
              {v}
            </SvgText>
          ))}
          <Line x1={pad.l} x2={w - pad.r} y1={y(min)} y2={y(min)} stroke={c.border} strokeWidth={1} />
          <Line
            x1={pad.l}
            x2={w - pad.r}
            y1={y(targetMin)}
            y2={y(targetMin)}
            stroke={c.muted}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <SvgText x={w - pad.r} y={y(targetMin) - 5} fontSize={11} fill={c.muted} textAnchor="end">
            target {targetMin}
          </SvgText>
          <Path d={path} stroke={c.accent} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {ys.map((v, i) => (
            <Circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={sel === i ? 6 : 4}
              fill={v > targetMin ? c.bad : c.accent}
              stroke={c.card}
              strokeWidth={2}
            />
          ))}
          <SvgText x={pad.l} y={h - 4} fontSize={11} fill={c.muted}>
            {fmtDate(list[0].date)}
          </SvgText>
          <SvgText x={w - pad.r} y={h - 4} fontSize={11} fill={c.muted} textAnchor="end">
            {fmtDate(list[list.length - 1].date)}
          </SvgText>
        </Svg>
      )}
      {/* Wide invisible hit targets, one per attempt. */}
      <View style={{ position: 'absolute', left: pad.l, right: pad.r, top: 0, height: h, flexDirection: 'row' }}>
        {list.map((a, i) => (
          <Pressable key={a.id} style={{ flex: 1 }} onPress={() => setSel(sel === i ? null : i)} />
        ))}
      </View>
      <T muted size={13}>
        {s
          ? `${fmtDate(s.date)} · tooth ${s.tooth} · ${fmtMin(s.durationSec)} (target ${fmtMin(s.targetSec)})`
          : 'Minutes per attempt. Red = over target. Tap a point for details.'}
      </T>
    </View>
  );
}

/** Horizontal bars for mistake counts. */
export function TagBars({ tags }: { tags: { tag: string; count: number; recent: number }[] }) {
  const c = useTheme();
  if (!tags.length)
    return (
      <T muted size={14}>
        No findings logged yet.
      </T>
    );
  const max = Math.max(...tags.map((t) => t.count));
  return (
    <View style={{ gap: 8 }}>
      {tags.slice(0, 8).map((t) => (
        <View key={t.tag} style={{ gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={14} style={{ flex: 1 }} numberOfLines={1}>
              {t.tag}
            </T>
            <T size={14} muted>
              {t.count}× {t.recent ? `(${t.recent} in last 5)` : ''}
            </T>
          </View>
          <View style={{ height: 8, backgroundColor: c.border, borderRadius: 4 }}>
            <View
              style={{ height: 8, width: `${(100 * t.count) / max}%`, backgroundColor: c.accent, borderRadius: 4 }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** One stacked bar per criterion: OK / MC / Fail shares of the rated attempts. */
export function CriteriaBars({ stats }: { stats: CriterionStats[] }) {
  const c = useTheme();
  const rows = stats.filter((s) => s.rated > 0).sort((a, b) => b.nc - a.nc || b.mc - a.mc);
  if (!rows.length)
    return (
      <T muted size={14}>
        Rate the checklist on an attempt to see this.
      </T>
    );
  const seg = (n: number, total: number, color: string, first: boolean) =>
    n > 0 ? (
      <View
        style={{
          width: `${(100 * n) / total}%`,
          backgroundColor: color,
          height: 10,
          borderLeftWidth: first ? 0 : 2,
          borderLeftColor: c.card,
        }}
      />
    ) : null;
  return (
    <View style={{ gap: 10 }}>
      {rows.map((s) => (
        <View key={s.id} style={{ gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <T size={14} style={{ flex: 1 }} numberOfLines={1}>
              {s.name}
            </T>
            <T size={13} muted>
              {s.nc ? `${s.nc} fail` : ''}
              {s.nc && s.mc ? ' · ' : ''}
              {s.mc ? `${s.mc} MC` : ''}
              {!s.nc && !s.mc ? 'all OK' : ''} / {s.rated}
              {s.recentNc ? ` (${s.recentNc} fail in last 5)` : ''}
            </T>
          </View>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: c.border }}>
            {seg(s.c, s.rated, c.good, true)}
            {seg(s.mc, s.rated, c.warn, s.c === 0)}
            {seg(s.nc, s.rated, c.bad, s.c + s.mc === 0)}
          </View>
        </View>
      ))}
      <T muted size={12}>
        Green = OK, amber = minimally competent, red = fail. Worst criteria first.
      </T>
    </View>
  );
}
