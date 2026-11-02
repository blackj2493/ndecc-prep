import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uid } from '../lib/run';
import type { MarkKind, PhotoMark, PhotoNote } from '../lib/types';
import { Icon, type IconName } from './Icon';
import { usePhotoUri } from './Photo';
import { emptyNote, fit, MARK_COLORS, MarksSvg, useImageSize } from './PhotoMarks';

type Pt = { x: number; y: number };

const TOOLS: { kind: MarkKind; label: string; icon: IconName }[] = [
  { kind: 'pen', label: 'Pen', icon: 'pencil.tip' },
  { kind: 'arrow', label: 'Arrow', icon: 'arrow.up.right' },
  { kind: 'circle', label: 'Circle', icon: 'circle' },
  { kind: 'text', label: 'Text', icon: 'textformat' },
  { kind: 'pin', label: 'Pin', icon: 'mappin' },
];

const MAX_ZOOM = 6;
/** Line width and text size as a fraction of the photo width, at zoom 1. */
const LINE_W = 0.006;
const TEXT_W = 0.05;
/** Pin radius on screen, in pixels, at any zoom. */
const PIN_PX = 13;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

const BG = '#000000';
const PANEL = '#1C1C1E';
const FG = '#F3F4F6';
const MUTED = '#9CA3AF';
const ACCENT = '#2DD4BF';

/**
 * Full-screen photo viewer. Pinch or double-tap to zoom. "Mark up" adds pen lines, arrows,
 * circles, text and numbered pins with notes. Marks are a layer: the photo file never changes.
 */
export function PhotoViewer({
  names,
  start,
  notes,
  onChange,
  onClose,
}: {
  names: string[];
  start: number;
  notes: Record<string, PhotoNote> | undefined;
  /** Applies a change to one photo's note. The caller applies it to its newest copy. */
  onChange: (name: string, fn: (n: PhotoNote) => PhotoNote) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);
  const name = names[clamp(index, 0, names.length - 1)];
  const note = notes?.[name] ?? emptyNote();
  const uri = usePhotoUri(name);
  const dim = useImageSize(uri);

  const [editing, setEditing] = useState(false);
  const [showMarks, setShowMarks] = useState(true);
  const [tool, setTool] = useState<MarkKind>('pen');
  const [color, setColor] = useState(MARK_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState<PhotoMark | null>(null);
  const [box, setBox] = useState({ W: 0, H: 0 });
  // Zoom belongs to one photo: another photo starts at zoom 1.
  const [zoom, setZoom] = useState({ name, z: 1, tx: 0, ty: 0 });
  const view = zoom.name === name ? zoom : { name, z: 1, tx: 0, ty: 0 };

  const update = (fn: (n: PhotoNote) => PhotoNote) => onChange(name, fn);
  const setMarks = (fn: (m: PhotoMark[]) => PhotoMark[]) => update((n) => ({ ...n, marks: fn(n.marks) }));

  /** Deletes text marks that were left empty. */
  const dropEmptyText = () => {
    if (note.marks.some((m) => m.kind === 'text' && !m.text?.trim()))
      setMarks((ms) => ms.filter((m) => m.kind !== 'text' || !!m.text?.trim()));
  };
  const deselect = () => {
    dropEmptyText();
    setSelectedId(null);
  };

  // iOS Safari zooms the whole page on a pinch; the viewer does its own zoom instead.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', stop);
    document.addEventListener('gesturechange', stop);
    return () => {
      document.removeEventListener('gesturestart', stop);
      document.removeEventListener('gesturechange', stop);
    };
  }, []);

  const fitted = dim && box.W ? fit(dim.w, dim.h, box.W, box.H) : null;

  // The gesture handlers are created once, so they read the newest values from this ref.
  const now = useRef({ name, editing, tool, color, view, fitted, note, box });
  const setView = (v: { z: number; tx: number; ty: number }) => setZoom({ ...v, name: now.current.name });
  const areaRef = useRef<View>(null);
  const origin = useRef<Pt>({ x: 0, y: 0 });
  const g = useRef({
    mode: 'none' as 'none' | 'pinch' | 'pan' | 'draw' | 'tap',
    pinched: false,
    start: { x: 0, y: 0 } as Pt,
    last: { x: 0, y: 0 } as Pt,
    z0: 1,
    t0: { x: 0, y: 0 } as Pt,
    m0: { x: 0, y: 0 } as Pt,
    d0: 1,
    lastTap: { t: 0, x: 0, y: 0 },
    live: null as PhotoMark | null,
  });

  /** Touch points relative to the photo area. */
  const points = (e: GestureResponderEvent): Pt[] => {
    const ne = e.nativeEvent as unknown as { touches?: { pageX: number; pageY: number }[]; pageX: number; pageY: number };
    const list = ne.touches && ne.touches.length ? ne.touches : [{ pageX: ne.pageX, pageY: ne.pageY }];
    return list.map((t) => ({ x: t.pageX - origin.current.x, y: t.pageY - origin.current.y }));
  };

  /** Converts a point in the photo area to a fraction of the photo (0-1). */
  const toPhoto = (p: Pt): [number, number] => {
    const { fitted: f, view: v, box: b } = now.current;
    if (!f) return [0, 0];
    const u = (p.x - b.W / 2 - v.tx) / v.z + f.bw / 2;
    const w = (p.y - b.H / 2 - v.ty) / v.z + f.bh / 2;
    return [clamp(u / f.bw, 0, 1), clamp(w / f.bh, 0, 1)];
  };

  const limit = (z: number, tx: number, ty: number) => {
    const f = now.current.fitted;
    const b = now.current.box;
    if (!f) return { z, tx: 0, ty: 0 };
    const mx = Math.max(0, (f.bw * z - b.W) / 2);
    const my = Math.max(0, (f.bh * z - b.H) / 2);
    return { z, tx: clamp(tx, -mx, mx), ty: clamp(ty, -my, my) };
  };

  /** Zoom so that the photo point under `from` ends up under `to`. */
  const zoomAbout = (z0: number, t0: Pt, from: Pt, to: Pt, z: number) => {
    const b = now.current.box;
    const qx = (from.x - b.W / 2 - t0.x) / z0;
    const qy = (from.y - b.H / 2 - t0.y) / z0;
    return limit(z, to.x - b.W / 2 - qx * z, to.y - b.H / 2 - qy * z);
  };

  const startPinch = (pts: Pt[]) => {
    const s = g.current;
    s.mode = 'pinch';
    s.pinched = true;
    s.live = null;
    setLive(null);
    s.z0 = now.current.view.z;
    s.t0 = { x: now.current.view.tx, y: now.current.view.ty };
    s.m0 = mid(pts[0], pts[1]);
    s.d0 = Math.max(10, dist(pts[0], pts[1]));
  };

  /** A tap on a pin or text label selects it instead of adding a new one. */
  const hitMark = (p: Pt): PhotoMark | undefined => {
    const { fitted: f, view: v, note: n } = now.current;
    if (!f) return undefined;
    const [u, w] = toPhoto(p);
    return [...n.marks].reverse().find((m) => {
      if (m.kind !== 'pin' && m.kind !== 'text') return false;
      const dx = (m.pts[0][0] - u) * f.bw * v.z;
      const dy = (m.pts[0][1] - w) * f.bh * v.z;
      if (m.kind === 'pin') return Math.hypot(dx, dy) < PIN_PX * 1.8;
      const fs = m.w * f.bw * v.z;
      const wide = Math.max(1, (m.text ?? '').length) * fs * 0.6;
      return -dx > -8 && -dx < wide + 8 && dy > -8 && dy < fs + 8;
    });
  };

  // setMarks changes every render (it holds the photo name); the handlers call the newest one.
  const setMarksRef = useRef(setMarks);
  useLayoutEffect(() => {
    now.current = { name, editing, tool, color, view, fitted, note, box };
    setMarksRef.current = setMarks;
  });

  // The handlers read refs only on touch events, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        if (Platform.OS === 'web') {
          const el = areaRef.current as unknown as HTMLElement | null;
          const r = el?.getBoundingClientRect?.();
          if (r) origin.current = { x: r.left + window.scrollX, y: r.top + window.scrollY };
        }
        const pts = points(e);
        const s = g.current;
        s.pinched = false;
        s.start = s.last = pts[0];
        if (pts.length >= 2) return startPinch(pts);
        const { editing: ed, tool: tl, color: col, view: v } = now.current;
        if (ed && (tl === 'pen' || tl === 'arrow' || tl === 'circle')) {
          const at = toPhoto(pts[0]);
          s.mode = 'draw';
          s.live = { id: uid(), kind: tl, color: col, pts: tl === 'pen' ? [at] : [at, at], w: LINE_W / v.z };
          setLive(s.live);
          return;
        }
        s.mode = 'tap';
        s.t0 = { x: v.tx, y: v.ty };
      },
      onPanResponderMove: (e) => {
        const pts = points(e);
        const s = g.current;
        if (pts.length >= 2) {
          if (s.mode !== 'pinch') startPinch(pts);
          const m = mid(pts[0], pts[1]);
          const z = clamp((s.z0 * dist(pts[0], pts[1])) / s.d0, 1, MAX_ZOOM);
          setView(zoomAbout(s.z0, s.t0, s.m0, m, z));
          return;
        }
        if (s.mode === 'pinch' || s.pinched) return; // One finger left after a pinch.
        const p = pts[0];
        s.last = p;
        if (s.mode === 'draw' && s.live) {
          const at = toPhoto(p);
          const lm = s.live;
          s.live = { ...lm, pts: lm.kind === 'pen' ? [...lm.pts, at] : [lm.pts[0], at] };
          setLive(s.live);
          return;
        }
        if ((s.mode === 'tap' || s.mode === 'pan') && dist(p, s.start) > 6) {
          s.mode = 'pan';
          const v = now.current.view;
          if (v.z > 1) setView(limit(v.z, s.t0.x + p.x - s.start.x, s.t0.y + p.y - s.start.y));
        }
      },
      onPanResponderRelease: () => {
        const s = g.current;
        const { editing: ed, tool: tl, color: col, view: v } = now.current;
        if (s.mode === 'draw' && s.live && !s.pinched) {
          const done = s.live;
          const tiny = done.kind !== 'pen' && dist({ x: done.pts[0][0], y: done.pts[0][1] }, { x: done.pts[1][0], y: done.pts[1][1] }) < 0.01;
          if (!tiny) setMarksRef.current((ms) => [...ms, done]);
        } else if (s.mode === 'tap' && !s.pinched) {
          const p = s.start;
          if (ed && (tl === 'text' || tl === 'pin')) {
            const hit = hitMark(p);
            if (hit) {
              setSelectedId(hit.id);
            } else {
              const m: PhotoMark = { id: uid(), kind: tl, color: col, pts: [toPhoto(p)], w: TEXT_W / v.z, text: '' };
              setMarksRef.current((ms) => [...ms.filter((x) => x.kind !== 'text' || !!x.text?.trim()), m]);
              setSelectedId(m.id);
            }
          } else if (!ed) {
            const t = Date.now();
            const lt = s.lastTap;
            if (t - lt.t < 320 && dist(p, lt) < 30) {
              setView(v.z > 1 ? { z: 1, tx: 0, ty: 0 } : zoomAbout(v.z, { x: v.tx, y: v.ty }, p, p, 2.5));
              s.lastTap = { t: 0, x: 0, y: 0 };
            } else s.lastTap = { t, x: p.x, y: p.y };
          }
        }
        s.mode = 'none';
        s.live = null;
        setLive(null);
      },
      onPanResponderTerminate: () => {
        g.current.mode = 'none';
        g.current.live = null;
        setLive(null);
      },
    }),
  );

  const selected = note.marks.find((m) => m.id === selectedId);
  const pins = note.marks.filter((m) => m.kind === 'pin');
  const pinNo = (id: string) => pins.findIndex((m) => m.id === id) + 1;
  const marks = live ? [...note.marks, live] : note.marks;

  const close = () => {
    dropEmptyText();
    onClose();
  };
  const go = (d: number) => {
    deselect();
    setIndex((i) => clamp(i + d, 0, names.length - 1));
  };

  const topBtn = (icon: IconName, onPress: () => void, label?: string, active?: boolean) => (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: label ? 12 : 8,
        borderRadius: 18,
        backgroundColor: active ? ACCENT : 'rgba(255,255,255,0.12)',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} color={active ? '#04211E' : FG} size={18} />
      {label ? <Text style={{ color: active ? '#04211E' : FG, fontSize: 15, fontWeight: '600' }}>{label}</Text> : null}
    </Pressable>
  );

  return (
    <Modal visible animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
          {topBtn('xmark', close)}
          {names.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {topBtn('chevron.left', () => go(-1))}
              <Text style={{ color: FG, fontSize: 14, minWidth: 40, textAlign: 'center' }}>
                {index + 1} / {names.length}
              </Text>
              {topBtn('chevron.right', () => go(1))}
            </View>
          )}
          <View style={{ flex: 1 }} />
          {!editing && note.marks.length > 0 && topBtn(showMarks ? 'eye' : 'eye.slash', () => setShowMarks((v) => !v))}
          {editing
            ? topBtn('checkmark', () => {
                deselect();
                setEditing(false);
              }, 'Done', true)
            : topBtn('pencil.and.outline', () => {
                setShowMarks(true);
                setEditing(true);
              }, 'Mark up')}
        </View>

        {/* Photo */}
        <View
          ref={areaRef}
          style={{ flex: 1, overflow: 'hidden', touchAction: 'none', cursor: editing ? 'crosshair' : 'default' } as object}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setBox({ W: width, H: height });
            if (Platform.OS !== 'web') areaRef.current?.measureInWindow((x, y) => (origin.current = { x, y }));
          }}
          {...pan.panHandlers}
        >
          {uri && fitted ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: fitted.bx,
                top: fitted.by,
                width: fitted.bw,
                height: fitted.bh,
                transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.z }],
              }}
            >
              <Image source={{ uri }} style={{ width: fitted.bw, height: fitted.bh }} />
              {showMarks && (
                <MarksSvg marks={marks} bw={fitted.bw} bh={fitted.bh} pinR={PIN_PX / view.z} selectedId={editing ? selectedId : null} />
              )}
            </View>
          ) : (
            <Text style={{ color: MUTED, textAlign: 'center', marginTop: 80 }}>
              {uri === null ? 'Loading… (If this stays, the photo is not on this device.)' : 'Loading…'}
            </Text>
          )}
        </View>

        {/* Bottom panel */}
        {editing ? (
          <View style={{ backgroundColor: PANEL, padding: 10, gap: 10 }}>
            {selected && (selected.kind === 'pin' || selected.kind === 'text') && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: FG, fontWeight: '600' }}>{selected.kind === 'pin' ? `Pin ${pinNo(selected.id)}` : 'Text'}</Text>
                <TextInput
                  key={selected.id}
                  autoFocus
                  value={selected.text ?? ''}
                  onChangeText={(t) => setMarks((ms) => ms.map((m) => (m.id === selected.id ? { ...m, text: t } : m)))}
                  placeholder={selected.kind === 'pin' ? 'Note for this pin, e.g. “open contact”' : 'Text on the photo'}
                  placeholderTextColor={MUTED}
                  style={{ flex: 1, minWidth: 0, color: FG, backgroundColor: '#2C2C2E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16 }}
                />
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setMarks((ms) => ms.filter((m) => m.id !== selected.id));
                    setSelectedId(null);
                  }}
                >
                  <Icon name="trash" color="#F87171" size={20} />
                </Pressable>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {TOOLS.map((t) => {
                const on = tool === t.kind;
                return (
                  <Pressable
                    key={t.kind}
                    onPress={() => {
                      deselect();
                      setTool(t.kind);
                    }}
                    style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: 8, backgroundColor: on ? ACCENT : 'transparent' }}
                  >
                    <Icon name={t.icon} color={on ? '#04211E' : FG} size={20} />
                    <Text style={{ color: on ? '#04211E' : FG, fontSize: 11, fontWeight: '600' }}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {MARK_COLORS.map((col) => (
                <Pressable
                  key={col}
                  accessibilityLabel={`Colour ${col}`}
                  onPress={() => {
                    setColor(col);
                    if (selected) setMarks((ms) => ms.map((m) => (m.id === selected.id ? { ...m, color: col } : m)));
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: col,
                    borderWidth: color === col ? 3 : 1,
                    borderColor: color === col ? ACCENT : '#6B7280',
                  }}
                />
              ))}
              <View style={{ flex: 1 }} />
              {topBtn('arrow.uturn.backward', () => {
                setSelectedId(null);
                setMarks((ms) => ms.slice(0, -1));
              }, 'Undo')}
            </View>
            <Text style={{ color: MUTED, fontSize: 12 }}>
              {tool === 'pin' || tool === 'text'
                ? 'Tap the photo to add. Tap an existing one to edit it. Two fingers zoom and move.'
                : 'Draw with one finger. Two fingers zoom and move.'}
            </Text>
          </View>
        ) : (
          <ScrollView style={{ flexGrow: 0, maxHeight: '38%', backgroundColor: PANEL }} contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled">
            <TextInput
              multiline
              value={note.caption}
              onChangeText={(t) => update((n) => ({ ...n, caption: t }))}
              placeholder="Note for this photo, e.g. the instructor's feedback"
              placeholderTextColor={MUTED}
              style={{ color: FG, backgroundColor: '#2C2C2E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, minHeight: 56, minWidth: 0, textAlignVertical: 'top' }}
            />
            {pins.map((m, i) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: m.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: m.color === '#FACC15' || m.color === '#FFFFFF' ? '#111827' : '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{i + 1}</Text>
                </View>
                <TextInput
                  value={m.text ?? ''}
                  onChangeText={(t) => setMarks((ms) => ms.map((x) => (x.id === m.id ? { ...x, text: t } : x)))}
                  placeholder={`Note for pin ${i + 1}`}
                  placeholderTextColor={MUTED}
                  style={{ flex: 1, minWidth: 0, color: FG, backgroundColor: '#2C2C2E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 15 }}
                />
              </View>
            ))}
            <Text style={{ color: MUTED, fontSize: 12 }}>Pinch or double-tap to zoom. Tap “Mark up” to draw and add pins.</Text>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
