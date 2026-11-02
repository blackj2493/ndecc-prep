import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg';
import type { PhotoMark, PhotoNote } from '../lib/types';
import { usePhotoUri } from './Photo';
import { useTheme } from './ui';

export const MARK_COLORS = ['#EF4444', '#FACC15', '#22C55E', '#3B82F6', '#FFFFFF'];
/** Number/label colour that stays readable on a pin of this colour. */
/** SVG text needs its own font; the default is a serif font. */
const FONT = '-apple-system, system-ui, Helvetica, Arial, sans-serif';
const onColor = (c: string) => (c === '#FACC15' || c === '#FFFFFF' ? '#111827' : '#FFFFFF');

export const emptyNote = (): PhotoNote => ({ caption: '', marks: [] });

/** True when the note has anything worth showing (a caption, a mark). */
export const hasNote = (n?: PhotoNote) => !!n && (n.caption.trim() !== '' || n.marks.length > 0);

/** Pins in order, numbered from 1. */
export const pinsOf = (n?: PhotoNote) => (n?.marks ?? []).filter((m) => m.kind === 'pin');

const sizes = new Map<string, { w: number; h: number }>();

/** The pixel size of an image, so marks can be placed on it exactly. */
export function useImageSize(uri: string | null) {
  const [got, setGot] = useState<{ uri: string; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!uri || sizes.has(uri)) return;
    let live = true;
    Image.getSize(
      uri,
      (w, h) => {
        sizes.set(uri, { w, h });
        if (live) setGot({ uri, w, h });
      },
      () => live && setGot({ uri, w: 4, h: 3 }),
    );
    return () => {
      live = false;
    };
  }, [uri]);
  if (!uri) return null;
  return sizes.get(uri) ?? (got?.uri === uri ? got : null);
}

/** Fits an image of size iw×ih inside a W×H box, centred. */
export function fit(iw: number, ih: number, W: number, H: number) {
  const k = Math.min(W / iw, H / ih);
  const bw = iw * k;
  const bh = ih * k;
  return { bw, bh, bx: (W - bw) / 2, by: (H - bh) / 2 };
}

function arrowPath(m: PhotoMark, bw: number, bh: number) {
  const [[x1, y1], [x2, y2]] = m.pts.map(([x, y]) => [x * bw, y * bh]);
  const sw = m.w * bw;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const head = Math.min(len * 0.5, sw * 4 + 6);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d: number) => `${x2 - head * Math.cos(a + d)} ${y2 - head * Math.sin(a + d)}`;
  return `M ${x1} ${y1} L ${x2} ${y2} M ${p(0.45)} L ${x2} ${y2} L ${p(-0.45)}`;
}

/** Draws the marks of one photo. Coordinates are in the displayed photo's own pixels (bw×bh). */
export function MarksSvg({
  marks,
  bw,
  bh,
  pinR,
  selectedId,
}: {
  marks: PhotoMark[];
  bw: number;
  bh: number;
  /** Pin radius in the same pixels. */
  pinR: number;
  selectedId?: string | null;
}) {
  const pinNo = new Map(marks.filter((m) => m.kind === 'pin').map((m, i) => [m.id, i + 1]));
  return (
    <Svg width={bw} height={bh} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      {marks.map((m) => {
        const sw = Math.max(1, m.w * bw);
        const sel = m.id === selectedId;
        if (m.kind === 'pen') {
          if (!m.pts.length) return null;
          const d = m.pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x * bw} ${y * bh}`).join(' ');
          // A tap with no movement still leaves a dot.
          const dot = m.pts.length === 1 ? ` L ${m.pts[0][0] * bw + 0.1} ${m.pts[0][1] * bh}` : '';
          return (
            <Path key={m.id} d={d + dot} stroke={m.color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          );
        }
        if (m.kind === 'arrow') {
          if (m.pts.length < 2) return null;
          return (
            <Path key={m.id} d={arrowPath(m, bw, bh)} stroke={m.color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          );
        }
        if (m.kind === 'circle') {
          if (m.pts.length < 2) return null;
          const [[x1, y1], [x2, y2]] = m.pts;
          return (
            <Ellipse
              key={m.id}
              cx={((x1 + x2) / 2) * bw}
              cy={((y1 + y2) / 2) * bh}
              rx={(Math.abs(x2 - x1) / 2) * bw}
              ry={(Math.abs(y2 - y1) / 2) * bh}
              stroke={m.color}
              strokeWidth={sw}
              fill="none"
            />
          );
        }
        const [x, y] = [m.pts[0][0] * bw, m.pts[0][1] * bh];
        if (m.kind === 'text') {
          const fs = Math.max(8, m.w * bw);
          const label = m.text?.trim() || (sel ? 'Type below…' : '');
          if (!label) return null;
          return (
            <G key={m.id}>
              <SvgText fontFamily={FONT} x={x} y={y} fontSize={fs} fontWeight="bold" stroke="#000000" strokeWidth={fs / 6} strokeLinejoin="round" fill="#000000">
                {label}
              </SvgText>
              <SvgText fontFamily={FONT} x={x} y={y} fontSize={fs} fontWeight="bold" fill={m.color}>
                {label}
              </SvgText>
              {sel && <Path d={`M ${x} ${y + fs * 0.25} L ${x + fs * label.length * 0.55} ${y + fs * 0.25}`} stroke={m.color} strokeWidth={Math.max(1, fs / 12)} strokeDasharray={`${fs / 4} ${fs / 6}`} />}
            </G>
          );
        }
        return (
          <G key={m.id}>
            {sel && <Circle cx={x} cy={y} r={pinR * 1.5} fill="none" stroke={m.color} strokeWidth={pinR / 4} />}
            <Circle cx={x} cy={y} r={pinR} fill={m.color} stroke="#000000" strokeOpacity={0.5} strokeWidth={pinR / 6} />
            <SvgText fontFamily={FONT} x={x} y={y + pinR * 0.38} fontSize={pinR * 1.1} fontWeight="bold" fill={onColor(m.color)} textAnchor="middle">
              {String(pinNo.get(m.id))}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/** A photo fitted inside a box, with its marks on top. For lists; the viewer draws its own. */
export function AnnotatedPhoto({ name, note, size }: { name: string; note?: PhotoNote; size: number }) {
  const c = useTheme();
  const uri = usePhotoUri(name);
  const dim = useImageSize(uri);
  if (!uri || !dim) return <View style={{ width: size, height: size, borderRadius: 8, backgroundColor: c.border }} />;
  const { bw, bh, bx, by } = fit(dim.w, dim.h, size, size);
  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' }}>
      <View style={{ position: 'absolute', left: bx, top: by, width: bw, height: bh }}>
        <Image source={{ uri }} style={{ width: bw, height: bh }} />
        {note && <MarksSvg marks={note.marks} bw={bw} bh={bh} pinR={Math.max(6, bw * 0.045)} />}
      </View>
    </View>
  );
}
