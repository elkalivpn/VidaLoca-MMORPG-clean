// Lightweight synthesized Web Audio API sound effects (zero external audio asset dependencies)

const MUTE_KEY = 'vidaloca_sfx_muted';

export function isSfxMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MUTE_KEY) === '1';
}

export function setSfxMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || isSfxMuted()) return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  try {
    return new Ctx();
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'triangle',
  gainPeak = 0.08,
) {
  const now = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

export function playCoinSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 987.77, 0, 0.09, 'sine', 0.07);
  playTone(ctx, 1318.51, 0.07, 0.16, 'sine', 0.08);
  setTimeout(() => void ctx.close().catch(() => undefined), 350);
}

export function playLevelUpSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 523.25, 0, 0.12, 'triangle', 0.08);
  playTone(ctx, 659.25, 0.1, 0.12, 'triangle', 0.08);
  playTone(ctx, 783.99, 0.2, 0.14, 'triangle', 0.08);
  playTone(ctx, 1046.5, 0.31, 0.26, 'triangle', 0.1);
  setTimeout(() => void ctx.close().catch(() => undefined), 750);
}

export function playAlertSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 440, 0, 0.11, 'sawtooth', 0.05);
  playTone(ctx, 349.23, 0.12, 0.16, 'sawtooth', 0.05);
  setTimeout(() => void ctx.close().catch(() => undefined), 400);
}
