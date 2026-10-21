import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Icon, type IconName } from '../components/Icon';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cancelAlerts, playAlert, scheduleAlerts, unlockAudio } from '../lib/alerts';
import { REQ_BY_ID } from '../lib/defaults';
import {
  completeCurrent,
  computeAlerts,
  currentItem,
  doLater,
  endBreak,
  finishRun,
  itemElapsedMs,
  markRestart,
  pauseRun,
  resumeRun,
  runToRecords,
  sessionElapsedMs,
  sessionLengthMs,
  skipCurrent,
  startBreak,
  startRun,
} from '../lib/run';
import { fmtClock } from '../lib/stats';
import { useStore } from '../lib/store';
import type { ActiveRun } from '../lib/types';
import { confirm } from '../lib/dialog';

// The timer is always dark: easier to read across the bench and kinder to the battery.
const C = {
  bg: '#000',
  panel: '#141416',
  text: '#F5F5F5',
  muted: '#9A9AA0',
  accent: '#2DD4BF',
  warn: '#FBBF24',
  bad: '#F87171',
  good: '#4ADE80',
};

function Big({ title, icon, onPress, color, flex }: { title: string; icon: IconName; onPress: () => void; color: string; flex?: number }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex,
        backgroundColor: color,
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} color="#000" size={22} />
      <Text style={{ color: '#000', fontSize: 18, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

function Small({ title, icon, onPress }: { title: string; icon: IconName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 12,
        paddingVertical: 10,
        alignItems: 'center',
        gap: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} color={C.text} size={18} />
      <Text style={{ color: C.text, fontSize: 12 }}>{title}</Text>
    </Pressable>
  );
}

export default function RunScreen() {
  useKeepAwake();
  const run = useStore((s) => s.activeRun);
  const setActiveRun = useStore((s) => s.setActiveRun);
  const addRun = useStore((s) => s.addRun);
  const [now, setNow] = useState(() => Date.now());
  const [banner, setBanner] = useState<{ title: string; body: string; final: boolean; until: number } | null>(null);
  const [landscape, setLandscape] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const { width, height } = useWindowDimensions();
  const wide = width > height;

  // Each tick also fires due alerts in the app. Alerts that are more than 5 s late (the app was in
  // the background, where the notification already rang) are marked as fired without a sound.
  useEffect(() => {
    const tick = () => {
      const n = Date.now();
      setNow(n);
      const r = useStore.getState().activeRun;
      if (!r) return;
      const due = computeAlerts(r, n).filter((a) => a.at <= n && !r.firedAlerts.includes(a.id));
      if (!due.length) return;
      const fresh = due.filter((a) => n - a.at < 5000);
      const last = fresh[fresh.length - 1];
      if (last) {
        playAlert(fresh.some((a) => a.final));
        setBanner({ title: last.title, body: last.body, final: last.final, until: n + 8000 });
      }
      setActiveRun({ ...r, firedAlerts: [...r.firedAlerts, ...due.map((a) => a.id)] });
    };
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [setActiveRun]);

  // iOS web apps cannot lock the orientation; there the layout follows the phone.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    ScreenOrientation.lockAsync(
      landscape ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP,
    ).catch(() => {});
  }, [landscape]);
  useEffect(() => () => void (Platform.OS !== 'web' && ScreenOrientation.unlockAsync().catch(() => {})), []);

  // Reschedule the lock-screen notifications whenever the clock state changes.
  const schedKey = run ? `${run.phase}|${run.currentKey}|${run.sessionIndex}|${run.segStart}` : '';
  useEffect(() => {
    if (!run) return;
    if (run.phase === 'running' || run.phase === 'break')
      scheduleAlerts(computeAlerts(run, Date.now()), run.firedAlerts).catch(() => {});
    else cancelAlerts().catch(() => {});
    // Only a change of clock state needs a new schedule, not every tick of `run`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedKey]);

  if (!run)
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text style={{ color: C.text, fontSize: 18 }}>No run is open.</Text>
        <Big title="Close" icon="xmark" color={C.accent} onPress={() => router.back()} />
      </SafeAreaView>
    );

  // Every timer button runs through here, so each tap also keeps web audio unlocked.
  const set = (fn: (r: ActiveRun, n: number) => ActiveRun) => {
    unlockAudio();
    setShowMore(false);
    setActiveRun(fn(run, Date.now()));
  };
  const cur = currentItem(run);
  const done = run.items.filter((i) => i.status === 'done').length;
  const sessLen = sessionLengthMs(run);
  const sessLeft = sessLen - sessionElapsedMs(run, now);
  const isLastSession = run.sessionIndex >= run.sessions.length - 1;
  const sessionName = run.sessions[run.sessionIndex]?.name ?? 'Session';

  const save = () => {
    const { record, attempts } = runToRecords(run, Date.now());
    cancelAlerts().catch(() => {});
    addRun(record, attempts);
    setActiveRun(null);
    router.replace(`/review/${record.id}`);
  };
  const discard = () =>
    confirm('Discard this run?', 'No times are saved.', 'Discard', () => {
          cancelAlerts().catch(() => {});
          setActiveRun(null);
          router.back();
        });
  const More = showMore && (
    <Pressable
      onPress={() => setShowMore(false)}
      style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24, zIndex: 20 }}
    >
      <View style={{ backgroundColor: C.panel, borderRadius: 18, padding: 16, gap: 10, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Text style={{ color: C.muted, fontSize: 15 }}>{cur ? REQ_BY_ID[cur.reqId].short : 'Run'}</Text>
        <Big title="Mark a restart (time keeps running)" icon="rotate.right" color={C.warn} onPress={() => { setShowMore(false); setActiveRun(markRestart(run)); }} />
        <Big title="Do this project later" icon="chevron.down" color={C.accent} onPress={() => set(doLater)} />
        <Big title="Skip this project" icon="xmark" color={C.accent} onPress={() => set(skipCurrent)} />
        <Big title="End the run now" icon="checkmark" color={C.bad} onPress={() => set(finishRun)} />
        <Pressable onPress={() => setShowMore(false)} style={{ paddingVertical: 10 }}>
          <Text style={{ color: C.text, textAlign: 'center', fontSize: 16 }}>Cancel</Text>
        </Pressable>
      </View>
    </Pressable>
  );

  const Header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Icon name="chevron.down" color={C.muted} size={22} />
      </Pressable>
      <Text style={{ color: C.muted, fontSize: 15, flex: 1 }} numberOfLines={1}>
        {run.title} · {done}/{run.items.length} done
      </Text>
      {Platform.OS !== 'web' && (
        <Pressable onPress={() => setLandscape(!landscape)} hitSlop={10}>
          <Icon name="rotate.right" color={C.muted} size={20} />
        </Pressable>
      )}
    </View>
  );

  const Banner =
    banner && banner.until > now ? (
      <Pressable
        onPress={() => setBanner(null)}
        style={{
          position: 'absolute',
          top: 8,
          left: 16,
          right: 16,
          backgroundColor: banner.final ? C.bad : C.warn,
          borderRadius: 14,
          padding: 14,
          zIndex: 10,
        }}
      >
        <Text style={{ color: '#000', fontSize: 22, fontWeight: '800' }}>{banner.title}</Text>
        {banner.body ? <Text style={{ color: '#000', fontSize: 15 }}>{banner.body}</Text> : null}
      </Pressable>
    ) : null;

  // ---- Ready ----
  if (run.phase === 'ready')
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 16 }}>
        {Header}
        <ScrollView contentContainerStyle={{ gap: 6 }}>
          {run.items.map((it, i) => (
            <Text key={it.key} style={{ color: C.text, fontSize: 17 }}>
              {i + 1}. {REQ_BY_ID[it.reqId].short} · {it.tooth} {it.surface} ·{' '}
              <Text style={{ color: C.muted }}>{Math.round(it.targetSec / 60)} min</Text>
            </Text>
          ))}
        </ScrollView>
        <Big title="Start" icon="play.fill" color={C.accent} onPress={() => set(startRun)} />
      </SafeAreaView>
    );

  // ---- Finished ----
  if (run.phase === 'finished')
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 16, justifyContent: 'center' }}>
        <Text style={{ color: C.text, fontSize: 28, fontWeight: '800', textAlign: 'center' }}>Run finished</Text>
        <Text style={{ color: C.muted, fontSize: 17, textAlign: 'center' }}>
          {done} projects in {fmtClock(run.examMs)}
        </Text>
        <Big title="Save and review" icon="checkmark" color={C.accent} onPress={save} />
        <Pressable onPress={discard}>
          <Text style={{ color: C.bad, textAlign: 'center', fontSize: 16 }}>Discard</Text>
        </Pressable>
      </SafeAreaView>
    );

  // ---- Break ----
  if (run.phase === 'break') {
    const left = (run.breakStartedAt ?? now) + run.breakMinutes * 60000 - now;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 16 }}>
        {Header}
        {Banner}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Text style={{ color: C.muted, fontSize: 20 }}>Break</Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={{ color: left < 0 ? C.bad : C.text, fontSize: 120, fontWeight: '200', fontVariant: ['tabular-nums'] }}
          >
            {fmtClock(left, false)}
          </Text>
          {cur && (
            <Text style={{ color: C.muted, fontSize: 16 }}>
              Next: {REQ_BY_ID[cur.reqId].short} {cur.tooth}
            </Text>
          )}
        </View>
        <Big title="End break" icon="play.fill" color={C.accent} onPress={() => set(endBreak)} />
      </SafeAreaView>
    );
  }

  // ---- Running / paused ----
  const paused = run.phase === 'paused';
  const elapsed = cur ? itemElapsedMs(run, cur, now) : 0;
  const target = (cur?.targetSec ?? 0) * 1000;
  const left = target - elapsed;
  const pct = target ? Math.min(1, elapsed / target) : 0;
  const tone = left < 0 ? C.bad : left < 5 * 60000 ? C.warn : C.text;
  const upcoming = run.items.filter((i) => i.status === 'pending');

  const Project = cur && (
    <View style={{ flex: wide ? 3 : undefined, backgroundColor: C.panel, borderRadius: 18, padding: 16, gap: 6, justifyContent: 'center' }}>
      <Text style={{ color: C.accent, fontSize: 22, fontWeight: '700' }} numberOfLines={1}>
        {REQ_BY_ID[cur.reqId].short}
        <Text style={{ color: C.text }}>
          {'  '}
          {cur.tooth} {cur.surface}
        </Text>
      </Text>
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{ color: tone, fontSize: wide ? 130 : 96, fontWeight: '200', fontVariant: ['tabular-nums'] }}
      >
        {left < 0 ? '+' + fmtClock(-left, false) : fmtClock(left, false)}
      </Text>
      <View style={{ height: 8, backgroundColor: '#2A2A2E', borderRadius: 4 }}>
        <View style={{ height: 8, width: `${pct * 100}%`, backgroundColor: tone, borderRadius: 4 }} />
      </View>
      <Text style={{ color: C.muted, fontSize: 15, fontVariant: ['tabular-nums'] }}>
        {left < 0 ? 'Over target' : 'Left of target'} · spent {fmtClock(elapsed, false)} of {Math.round(cur.targetSec / 60)} min
        {cur.repeats ? ` · ${cur.repeats} restart${cur.repeats > 1 ? 's' : ''}` : ''}
        {paused ? ' · PAUSED' : ''}
      </Text>
    </View>
  );

  const Side = (
    <View style={{ flex: wide ? 2 : undefined, gap: 10 }}>
      <View style={{ backgroundColor: C.panel, borderRadius: 18, padding: 14, gap: 2 }}>
        <Text style={{ color: C.muted, fontSize: 13 }}>
          {run.kind === 'mock' ? `${sessionName} session${isLastSession ? ' (last)' : ''}` : 'Time left in this run'}
        </Text>
        <Text
          style={{
            color: sessLeft < 0 ? C.bad : sessLeft < 30 * 60000 ? C.warn : C.text,
            fontSize: 34,
            fontWeight: '300',
            fontVariant: ['tabular-nums'],
          }}
        >
          {sessLeft < 0 ? '+' + fmtClock(-sessLeft) : fmtClock(sessLeft)}
        </Text>
        <Text style={{ color: C.muted, fontSize: 13 }} numberOfLines={2}>
          {upcoming.length
            ? 'Next: ' + upcoming.slice(0, 3).map((i) => `${REQ_BY_ID[i.reqId].short} ${i.tooth}`).join(' → ')
            : 'This is the last project.'}
        </Text>
      </View>
      <Big title="Done" icon="checkmark" color={C.good} onPress={() => set(completeCurrent)} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Small
          title={paused ? 'Resume' : 'Pause'}
          icon={paused ? 'play.fill' : 'pause.fill'}
          onPress={() => set(paused ? resumeRun : pauseRun)}
        />
        {!isLastSession && <Small title="Break" icon="cup.and.saucer" onPress={() => set(startBreak)} />}
        <Small title="More" icon="ellipsis" onPress={() => setShowMore(true)} />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingVertical: 8, gap: 10 }}>
      {Header}
      {Banner}
      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', gap: 12, justifyContent: 'center' }}>
        {Project}
        {Side}
      </View>
      {More}
    </SafeAreaView>
  );
}
