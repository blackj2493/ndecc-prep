import { Asset } from 'expo-asset';
import type { RunAlert } from './run';

// A web app on iOS cannot schedule lock-screen notifications. While the timer screen is
// open (it keeps the screen on), the chimes play through Web Audio. Web Audio may start
// only from a tap, so every timer button calls unlockAudio().

type Ctx = AudioContext;
let ctx: Ctx | null = null;
const raw: Record<'chime' | 'end', ArrayBuffer | null> = { chime: null, end: null };
const buf: Record<'chime' | 'end', AudioBuffer | null> = { chime: null, end: null };

async function fetchSound(mod: number) {
  const a = Asset.fromModule(mod);
  return (await fetch(a.uri)).arrayBuffer();
}

export async function initAlerts() {
  // Safari 16.4+: play even when the ring/silent switch is on silent.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  raw.chime = await fetchSound(require('../../assets/sounds/chime.wav'));
  raw.end = await fetchSound(require('../../assets/sounds/end.wav'));
}

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    // A silent tick inside the tap is what unlocks audio on iOS.
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
    for (const k of ['chime', 'end'] as const)
      if (!buf[k] && raw[k])
        ctx.decodeAudioData(raw[k]!.slice(0)).then((b) => {
          buf[k] = b;
        });
  } catch {
    // No audio support: the on-screen banner still shows.
  }
}

export function playAlert(final: boolean) {
  const b = buf[final ? 'end' : 'chime'];
  if (!ctx || !b) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(ctx.destination);
  s.start(0);
}

export async function scheduleAlerts(_alerts: RunAlert[], _fired: string[]) {}
export async function cancelAlerts() {}
