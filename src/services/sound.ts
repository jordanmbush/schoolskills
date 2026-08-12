/**
 * Every sound is synthesised with the Web Audio API — there are no audio files
 * to load, so the hub works with the network unplugged.
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Browsers only allow audio after a gesture; call this from the first click. */
export function unlockAudio() {
  audio();
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (master) master.gain.value = on ? 0.32 : 0;
}

export function isSoundEnabled() {
  return enabled;
}

type ToneOptions = {
  freq: number;
  dur?: number;
  delay?: number;
  wave?: Wave;
  gain?: number;
  glideTo?: number;
};

function tone({
  freq,
  dur = 0.14,
  delay = 0,
  wave = "triangle",
  gain = 0.5,
  glideTo,
}: ToneOptions) {
  const ac = audio();
  if (!ac || !master || !enabled) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo)
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, glideTo), t + dur);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({
  dur = 0.25,
  delay = 0,
  gain = 0.25,
  sweepFrom = 2400,
  sweepTo = 180,
}) {
  const ac = audio();
  if (!ac || !master || !enabled) return;
  const t = ac.currentTime + delay;
  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(sweepFrom, t);
  filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(amp).connect(master);
  src.start(t);
}

const C = {
  c4: 261.6,
  e4: 329.6,
  g4: 392,
  a4: 440,
  c5: 523.3,
  d5: 587.3,
  e5: 659.3,
  g5: 784,
  c6: 1046.5,
};

export const sfx = {
  tap: () => tone({ freq: 520, dur: 0.05, wave: "square", gain: 0.18 }),
  select: () => {
    tone({ freq: C.g4, dur: 0.07, wave: "square", gain: 0.22 });
    tone({ freq: C.d5, dur: 0.09, delay: 0.05, wave: "square", gain: 0.2 });
  },

  /** Pitch climbs with the combo so a hot streak literally sounds higher. */
  correct: (streak = 1) => {
    const step = Math.min(streak - 1, 11);
    const root = C.c5 * Math.pow(2, step / 12);
    tone({ freq: root, dur: 0.1, wave: "triangle", gain: 0.4 });
    tone({
      freq: root * 1.5,
      dur: 0.14,
      delay: 0.06,
      wave: "triangle",
      gain: 0.32,
    });
  },

  wrong: () => {
    tone({ freq: 190, dur: 0.26, wave: "sawtooth", gain: 0.24, glideTo: 92 });
    noise({ dur: 0.16, gain: 0.1, sweepFrom: 900, sweepTo: 120 });
  },

  /** The last three seconds of a card's clock. Quiet — it's a nudge, not an alarm. */
  tick: () => tone({ freq: 1180, dur: 0.035, wave: "square", gain: 0.12 }),

  /**
   * Time's up. Deliberately hollow and falling rather than harsh: running out
   * of time isn't the same as getting it wrong, and it shouldn't sting like it.
   */
  timeout: () => {
    tone({ freq: 420, dur: 0.18, wave: "sine", gain: 0.26, glideTo: 210 });
    tone({
      freq: 280,
      dur: 0.3,
      delay: 0.12,
      wave: "sine",
      gain: 0.2,
      glideTo: 140,
    });
  },

  countdown: (n: number) =>
    tone({
      freq: n <= 0 ? 880 : 440,
      dur: n <= 0 ? 0.34 : 0.12,
      wave: "square",
      gain: 0.3,
    }),

  whoosh: () => noise({ dur: 0.4, gain: 0.16, sweepFrom: 3200, sweepTo: 220 }),

  /** Played the moment you overtake the ghost — short, unmistakable, upward. */
  overtake: () => {
    tone({ freq: C.e5, dur: 0.09, wave: "square", gain: 0.3 });
    tone({ freq: C.g5, dur: 0.09, delay: 0.07, wave: "square", gain: 0.3 });
    tone({ freq: C.c6, dur: 0.18, delay: 0.14, wave: "square", gain: 0.32 });
    noise({ dur: 0.3, gain: 0.1, sweepFrom: 2600, sweepTo: 400 });
  },

  finish: () => {
    [C.c5, C.e5, C.g5].forEach((f, i) =>
      tone({
        freq: f,
        dur: 0.22,
        delay: i * 0.09,
        wave: "triangle",
        gain: 0.34,
      }),
    );
  },

  record: () => {
    [C.c5, C.e5, C.g5, C.c6, C.g5, C.c6].forEach((f, i) =>
      tone({ freq: f, dur: 0.24, delay: i * 0.1, wave: "square", gain: 0.3 }),
    );
    noise({ dur: 0.7, delay: 0.1, gain: 0.12, sweepFrom: 5000, sweepTo: 300 });
  },

  levelUp: () => {
    [C.g4, C.c5, C.e5, C.g5].forEach((f, i) =>
      tone({
        freq: f,
        dur: 0.3,
        delay: i * 0.11,
        wave: "triangle",
        gain: 0.32,
      }),
    );
  },

  badge: () => {
    tone({ freq: C.a4, dur: 0.12, wave: "triangle", gain: 0.3 });
    tone({ freq: C.e5, dur: 0.3, delay: 0.1, wave: "triangle", gain: 0.3 });
  },
};
