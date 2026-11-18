// Lightweight synthesized Web Audio API sound effects (zero external audio asset dependencies)

const MUTE_KEY = 'vidaloca_sfx_muted';
let sharedAudioCtx: AudioContext | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;

let lastScreechMs = 0;
let lastEngineMs = 0;
let lastCrashMs = 0;
let lastSirenMs = 0;
let lastHeartbeatMs = 0;

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
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new Ctx();
      sharedNoiseBuffer = null;
    }
    if (sharedAudioCtx.state === 'suspended') {
      void sharedAudioCtx.resume().catch(() => undefined);
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoiseBuffer && sharedNoiseBuffer.sampleRate === ctx.sampleRate) {
    return sharedNoiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 1.0);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  sharedNoiseBuffer = buffer;
  return buffer;
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

function playFilteredNoise(
  ctx: AudioContext,
  options: {
    startOffset?: number;
    duration: number;
    filterType: BiquadFilterType;
    freqStart: number;
    freqEnd?: number;
    q?: number;
    gainPeak: number;
  },
) {
  const now = ctx.currentTime + (options.startOffset ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);

  const filter = ctx.createBiquadFilter();
  filter.type = options.filterType;
  filter.frequency.setValueAtTime(options.freqStart, now);
  if (options.freqEnd !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(30, options.freqEnd),
      now + options.duration,
    );
  }
  if (options.q !== undefined) {
    filter.Q.setValueAtTime(options.q, now);
  }

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(0.002, options.gainPeak),
    now + Math.min(0.015, options.duration * 0.2),
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  src.start(now);
  src.stop(now + options.duration + 0.02);
}

export function playCoinSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 987.77, 0, 0.09, 'sine', 0.07);
  playTone(ctx, 1318.51, 0.07, 0.16, 'sine', 0.08);
}

export function playLevelUpSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 523.25, 0, 0.12, 'triangle', 0.08);
  playTone(ctx, 659.25, 0.1, 0.12, 'triangle', 0.08);
  playTone(ctx, 783.99, 0.2, 0.14, 'triangle', 0.08);
  playTone(ctx, 1046.5, 0.31, 0.26, 'triangle', 0.1);
}

export function playAlertSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 440, 0, 0.11, 'sawtooth', 0.05);
  playTone(ctx, 349.23, 0.12, 0.16, 'sawtooth', 0.05);
}

export function playGunshotSfx(intensity = 1): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const vol = Math.min(1.5, Math.max(0.25, intensity));
  const now = ctx.currentTime;

  // Sub-bass punch 120Hz -> 40Hz
  const punchOsc = ctx.createOscillator();
  const punchGain = ctx.createGain();
  punchOsc.type = 'triangle';
  punchOsc.frequency.setValueAtTime(125, now);
  punchOsc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
  punchGain.gain.setValueAtTime(0.2 * vol, now);
  punchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  punchOsc.connect(punchGain);
  punchGain.connect(ctx.destination);
  punchOsc.start(now);
  punchOsc.stop(now + 0.13);

  // Bandpass crack
  playFilteredNoise(ctx, {
    duration: 0.16,
    filterType: 'bandpass',
    freqStart: 1400,
    freqEnd: 420,
    q: 1.0,
    gainPeak: 0.22 * vol,
  });

  // Brief urban alley echo
  playFilteredNoise(ctx, {
    startOffset: 0.095,
    duration: 0.18,
    filterType: 'lowpass',
    freqStart: 780,
    freqEnd: 280,
    q: 0.7,
    gainPeak: 0.06 * vol,
  });
}

export function playImpactBloodSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Dry thump
  const thump = ctx.createOscillator();
  const gain = ctx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(105, now);
  thump.frequency.exponentialRampToValueAtTime(36, now + 0.09);
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
  thump.connect(gain);
  gain.connect(ctx.destination);
  thump.start(now);
  thump.stop(now + 0.11);

  // Organic crunch
  playFilteredNoise(ctx, {
    duration: 0.085,
    filterType: 'bandpass',
    freqStart: 1750,
    freqEnd: 580,
    q: 2.1,
    gainPeak: 0.11,
  });
}

export function playTireScreechSfx(): void {
  const nowMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (nowMs - lastScreechMs < 95) return;
  lastScreechMs = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;
  const baseFreq = 980 + Math.random() * 520;
  playFilteredNoise(ctx, {
    duration: 0.11,
    filterType: 'bandpass',
    freqStart: baseFreq,
    freqEnd: baseFreq + 220,
    q: 6.5,
    gainPeak: 0.045,
  });
  playTone(ctx, baseFreq * 0.92, 0, 0.09, 'triangle', 0.01);
}

export function playEnginePulseSfx(speedKmh: number, boosting: boolean): void {
  const nowMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (nowMs - lastEngineMs < 90) return;
  lastEngineMs = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;
  const clamped = Math.min(220, Math.max(0, speedKmh));
  const now = ctx.currentTime;
  const baseFreq = 38 + (clamped / 180) * 82 + (boosting ? 18 : 0);

  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.linearRampToValueAtTime(baseFreq * 1.04, now + 0.09);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(
    200 + clamped * 2.1 + (boosting ? 260 : 0),
    now,
  );
  filter.Q.setValueAtTime(1.8, now);

  const vol = 0.018 + (clamped / 200) * 0.028 + (boosting ? 0.014 : 0);
  gain.gain.setValueAtTime(0.002, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.11);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);

  if (boosting && clamped > 25) {
    playTone(ctx, 760 + clamped * 4.5, 0, 0.09, 'sine', 0.012);
  }
}

export function playCrashSfx(severity = 1): void {
  const nowMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (nowMs - lastCrashMs < 150) return;
  lastCrashMs = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;
  const sev = Math.min(1.5, Math.max(0.3, severity));
  const now = ctx.currentTime;

  // Sub-thump impact
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(92, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + 0.18);
  subGain.gain.setValueAtTime(0.22 * sev, now);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  sub.connect(subGain);
  subGain.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 0.21);

  // Metallic crunch
  playFilteredNoise(ctx, {
    duration: 0.22,
    filterType: 'bandpass',
    freqStart: 1200,
    freqEnd: 280,
    q: 1.8,
    gainPeak: 0.18 * sev,
  });
  playTone(ctx, 215, 0, 0.14, 'square', 0.035 * sev);
  playTone(ctx, 342, 0.01, 0.12, 'sawtooth', 0.03 * sev);
}

export function playPoliceSirenSfx(): void {
  const nowMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (nowMs - lastSirenMs < 1800) return;
  lastSirenMs = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;
  const notes: Array<[number, number, number]> = [
    [660, 0, 0.17],
    [880, 0.18, 0.17],
    [660, 0.36, 0.17],
    [880, 0.54, 0.18],
  ];
  for (const [freq, offset, dur] of notes) {
    const now = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.015);
  }
}

export function playHeartbeatSfx(): void {
  const nowMs =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (nowMs - lastHeartbeatMs < 780) return;
  lastHeartbeatMs = nowMs;

  const ctx = getAudioContext();
  if (!ctx) return;

  const beat = (offset: number, startFreq: number, peak: number) => {
    const now = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.13);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  };

  beat(0, 62, 0.18);
  beat(0.21, 54, 0.13);
}

export function playCasinoChipSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 2400, 0, 0.035, 'sine', 0.05);
  playTone(ctx, 1650, 0.015, 0.04, 'triangle', 0.04);
  playFilteredNoise(ctx, {
    duration: 0.03,
    filterType: 'highpass',
    freqStart: 2200,
    gainPeak: 0.04,
  });
}

export function playCasinoWinSfx(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  playTone(ctx, 523.25, 0, 0.11, 'triangle', 0.07);
  playTone(ctx, 659.25, 0.08, 0.11, 'triangle', 0.07);
  playTone(ctx, 783.99, 0.16, 0.12, 'triangle', 0.08);
  playTone(ctx, 1046.5, 0.24, 0.22, 'sine', 0.09);
  playTone(ctx, 1318.51, 0.34, 0.28, 'sine', 0.08);
}
