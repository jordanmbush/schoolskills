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

  /* ── Hailstorm ───────────────────────────────────────────────────────────
   *
   * Six sounds for one screen, kept apart from each other by pitch and by
   * length while three or four of them happen a second (docs/typing.md §8.12).
   * The lengths there are the contract; the comments below are how each one is
   * built to hit it.
   */

  /**
   * The trigger, on every stroke the gun takes, with the hit or the miss
   * layered over it (§8.12).
   *
   * Two parts, because a single glide reads as a blip rather than as a shot.
   * The click is what makes it one — a 20ms burst of high noise is the report,
   * and the ear places it as a *release* rather than as a note. The glide
   * under it is the shot leaving: fast, an octave and a half, and over before
   * the next key can be pressed. Nothing with a tail, because it fires several
   * times a second and a tail is a drone.
   */
  shoot: () => {
    noise({ dur: 0.02, gain: 0.16, sweepFrom: 7000, sweepTo: 4200 });
    tone({ freq: 1700, dur: 0.07, wave: "square", gain: 0.16, glideTo: 480 });
  },

  /**
   * A hailstone shot out of the sky: a bright tone and a glassy noise burst.
   *
   * The pitch climbs with the streak exactly as `correct` does, because it is
   * the same streak and the same multiplier the HUD is showing (§8.6). Capped
   * at an octave, so a long run stops climbing rather than ending up somewhere
   * only a dog can hear it.
   */
  shatter: (streak = 1) => {
    const step = Math.min(streak - 1, 11);
    tone({
      freq: C.e5 * Math.pow(2, step / 12),
      dur: 0.08,
      wave: "triangle",
      gain: 0.3,
    });
    noise({ dur: 0.11, gain: 0.1, sweepFrom: 7000, sweepTo: 2200 });
  },

  /**
   * A stroke that hit nothing — the wrong key, or any key at an empty sky
   * (§8.6).
   *
   * **A shot going past.** A thing that passes you gets brighter as it comes
   * and darker as it goes, so this is two noise sweeps back to back — up
   * through the near field, then down and away, the second longer because that
   * is what receding sounds like. Nothing else in the set moves in two
   * directions, which is what makes a miss unmistakable next to the shot that
   * caused it. Under it a short low fall, because ten points off is not a
   * neutral event.
   *
   * `wrong`'s 260ms sawtooth is the wrong length and the wrong feeling. A child
   * losing a storm mashes, and eight harsh buzzes a second is a drone; a flurry
   * of whizzes is a flurry.
   */
  misfire: () => {
    noise({ dur: 0.05, gain: 0.13, sweepFrom: 800, sweepTo: 2800 });
    noise({
      dur: 0.17,
      delay: 0.045,
      gain: 0.13,
      sweepFrom: 2800,
      sweepTo: 500,
    });
    tone({ freq: 190, dur: 0.1, wave: "triangle", gain: 0.12, glideTo: 120 });
  },

  /** A letter got through, and that finger's armour took it (§8.5). */
  shieldHit: () => {
    tone({ freq: 160, dur: 0.16, wave: "sine", gain: 0.3, glideTo: 84 });
    noise({ dur: 0.22, gain: 0.15, sweepFrom: 1500, sweepTo: 220 });
  },

  /**
   * …and that was the zone's last point: there is a hole under one finger now.
   *
   * The loudest thing that is not the end of the run, because it is the last
   * moment a child can still do something about (§8.5). A merely bigger crunch
   * would leave the one turning point in a run sounding like the four hits
   * before it.
   */
  shieldBreak: () => {
    tone({ freq: 300, dur: 0.34, wave: "sawtooth", gain: 0.26, glideTo: 88 });
    noise({ dur: 0.4, gain: 0.2, sweepFrom: 3200, sweepTo: 150 });
  },

  /**
   * A stone came through the hole. The run is over.
   *
   * A falling minor figure under a long collapse of noise — the one sound on
   * this screen allowed to be sad, and what a lost storm plays instead of
   * `finish` (§8.12).
   */
  breach: () => {
    noise({ dur: 0.75, gain: 0.24, sweepFrom: 4800, sweepTo: 110 });
    [392, 311, 233].forEach((freq, i) =>
      tone({
        freq,
        dur: 0.34,
        delay: i * 0.11,
        wave: "triangle",
        gain: 0.3,
        glideTo: freq * 0.5,
      }),
    );
  },

  /* ── Typewriter ──────────────────────────────────────────────────────────
   *
   * The board's own voice: what a key sounds like going down, played whenever
   * the keyboard is on screen (docs/typing.md §4.8). Quietest in the kit and
   * pitchless, because at eight strokes a second it has to sit under `correct`
   * and `wrong` without arguing with either.
   *
   * `noise` and no oscillator, which is what pitchless costs — and it buys the
   * envelope as well: `noise` starts at full gain and decays, where `tone`
   * ramps up over 12ms. Twelve milliseconds of attack on a forty-millisecond
   * sound is a blip; percussion has no attack at all, and that difference is
   * the whole distance between a click and a boop.
   */

  /**
   * One key, struck — the sound under every letter, digit and mark.
   *
   * Three layers, which are the three things a typewriter actually does when
   * you press a key: the typebar slaps the platen (high and gone in a frame),
   * the machine's body answers it (low, a little longer, the wood in the
   * sound), and the escapement ticks the carriage on one space a beat later.
   * The tick is what makes the set read as a typewriter rather than as a
   * mouse click; it is also the quietest of the three, because it is the part
   * a listener recognises without noticing.
   */
  keyStrike: () => {
    noise({ dur: 0.016, gain: 0.1, sweepFrom: 5200, sweepTo: 2400 });
    noise({ dur: 0.05, gain: 0.075, sweepFrom: 700, sweepTo: 190 });
    noise({
      dur: 0.012,
      delay: 0.024,
      gain: 0.05,
      sweepFrom: 7000,
      sweepTo: 5200,
    });
  },

  /**
   * The space bar, which is a bigger lever and sounds like one.
   *
   * The same three layers, moved down and lengthened. Space commits a word
   * (`TypingTrack`), so it is the one stroke in a passage that is also a beat.
   * Deeper rather than louder, so that beat does not become a metronome a child
   * types to.
   */
  keySpace: () => {
    noise({ dur: 0.022, gain: 0.11, sweepFrom: 2600, sweepTo: 1100 });
    noise({ dur: 0.08, gain: 0.09, sweepFrom: 420, sweepTo: 120 });
    noise({
      dur: 0.012,
      delay: 0.03,
      gain: 0.05,
      sweepFrom: 7000,
      sweepTo: 5200,
    });
  },

  /**
   * Return: the bell, and the carriage going back.
   *
   * The one sound in this block allowed a pitch (§4.8) — two sine partials a
   * fifth and a bit apart, which is what stops it reading as a beep. On the
   * real machine the bell warns a few characters before the margin and the
   * carriage is thrown afterwards by hand; both on one key merges a warning
   * and an action a child has never had to tell apart, and what they get is
   * the sound everybody means by "typewriter".
   *
   * Under it, the return: a rising sweep as the carriage flies left, and a low
   * knock as it hits the stop. Rising, because nothing else in the kit is —
   * `misfire` is the only near neighbour and lives on a screen with no keyboard
   * on it.
   *
   * Quieter than `finish`, because Enter commits the last word of a passage, so
   * the two land together and the bell must not be the one that wins.
   */
  keyReturn: () => {
    tone({ freq: 2093, dur: 0.4, wave: "sine", gain: 0.13 });
    tone({ freq: 3136, dur: 0.26, wave: "sine", gain: 0.06 });
    noise({
      dur: 0.18,
      delay: 0.05,
      gain: 0.08,
      sweepFrom: 900,
      sweepTo: 2800,
    });
    noise({ dur: 0.07, delay: 0.22, gain: 0.09, sweepFrom: 800, sweepTo: 160 });
  },
};
