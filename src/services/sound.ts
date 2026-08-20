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
   * Six sounds for one screen, and what makes them a set rather than six
   * effects is that they have to stay apart from each other while three or
   * four of them happen a second (docs/typing.md §8.12).
   *
   * They are laid out along two axes a five-year-old can hear without being
   * taught either. **Pitch says whose it is**: the gun and the stones are
   * bright and short, the shield is low and long, so "I did something" and
   * "something happened to me" never have to be told apart by timbre alone.
   * **Length says how much it cost**: 50ms for a shot, 90 for a stone, 160
   * for armour absorbing a letter, 340 for the last point of a zone, and
   * three quarters of a second for the run ending. Nothing else on the
   * screen is allowed to be the longest sound in it.
   *
   * Gains are deliberately below the rest of the kit. A race plays a handful
   * of sounds a minute; a storm plays one per keystroke, and a mixer summing
   * six of those into a limiter is a mush that teaches nothing.
   */

  /**
   * The trigger, on every stroke the gun takes — the hit and the miss are
   * layered over the top of it rather than replacing it.
   *
   * That layering is the point. A child who presses a key gets an answer
   * within a frame whatever else is true, so the sound never has to wait on
   * whether the shot landed, and the quietest, shortest thing on the screen
   * is the one that happens most often.
   *
   * Two parts, because a single glide read as a blip rather than as a shot.
   * The click is what makes it one — a 20ms burst of high noise is the report,
   * and the ear places it as a *release* rather than as a note. The glide
   * under it is the shot leaving: fast, an octave and a half, and over before
   * the next key can be pressed. Deliberately not dramatic — it fires several
   * times a second and anything with a tail would be a drone.
   */
  shoot: () => {
    noise({ dur: 0.02, gain: 0.16, sweepFrom: 7000, sweepTo: 4200 });
    tone({ freq: 1700, dur: 0.07, wave: "square", gain: 0.16, glideTo: 480 });
  },

  /**
   * A hailstone shot out of the sky: a bright tone and a glassy noise burst.
   *
   * The pitch climbs with the streak exactly as `correct` does, and for the
   * same reason — it is the same streak, and the multiplier it is paying at
   * is the number the HUD is already showing (§8.6). Capped at an octave, so
   * a long run stops climbing rather than ending up somewhere only a dog can
   * hear it.
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
   * **A shot going past**, and the shape is the whole of how it reads that
   * way. A thing that passes you gets brighter as it comes and darker as it
   * goes, so this is two noise sweeps back to back — up through the near
   * field, then down and away, the second longer than the first because that
   * is what receding sounds like. Nothing else in the set moves in two
   * directions, which is what makes a miss unmistakable next to the shot that
   * caused it.
   *
   * Under it, a short low fall: the sound has to *cost* something as well as
   * describe something, and ten points off is not a neutral event. Quiet
   * enough not to be the thing you hear, present enough that a run of misses
   * sags.
   *
   * `wrong`'s 260ms sawtooth would be both the wrong length and the wrong
   * feeling. A child losing a storm mashes, and eight harsh buzzes a second is
   * a drone; a flurry of whizzes is a flurry.
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
   * The loudest thing that is not the end of the run, because it is the
   * moment a child can still do something about — the next letter on that
   * finger ends the storm, and every clean hit from here is a chance to mend
   * it (§8.5). A sound that were merely a bigger crunch would leave the one
   * turning point in a run indistinguishable from the four hits before it.
   */
  shieldBreak: () => {
    tone({ freq: 300, dur: 0.34, wave: "sawtooth", gain: 0.26, glideTo: 88 });
    noise({ dur: 0.4, gain: 0.2, sweepFrom: 3200, sweepTo: 150 });
  },

  /**
   * A stone came through the hole. The run is over.
   *
   * A falling minor figure under a long collapse of noise, and it is the one
   * sound on this screen that is allowed to be sad. It is also why the storm
   * does not play `finish`: a race ends by being finished and a storm can end
   * by being lost, and a major triad over a broken shield would be the game
   * congratulating a child for dying (`useRaceFinish`'s `fanfare`).
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
};
