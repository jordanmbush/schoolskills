import { describe, expect, it } from "vitest";

import { buildDeck, buildDrill, isTyping } from "@/engine/decks";
import { typingMode } from "@/engine/decks/typing";
import { keyX, strokeFor } from "@/engine/keyboard";
import { cardXp, stormXp } from "@/engine/progress";
import { unlockedAt } from "./keys";
import {
  MIN_FALL_MS,
  MIN_TINT_GAP_MS,
  MISS_POINTS,
  SHIELD_FINGERS,
  buildWave,
  fallRange,
  fire,
  hasLanded,
  isAirborne,
  progressAt,
  startStorm,
  stormReport,
  targetIndex,
  tick,
  zoneKeys,
  zoneTally,
} from "./storm";
import type { Shield, StormLetter, StormState, Wave, WaveSpec } from "./storm";

/**
 * The wave's properties, proved rather than sampled (docs/typing.md §8.3).
 *
 * Every interesting claim this module makes is universally quantified — "the
 * same seed is the same storm", "every character is one the child can type",
 * "an early level never puts two letters on screen" — so each is asserted over
 * a spread of seeds crossed with a spread of specs, not over one hand-picked
 * wave. A generator is a distribution and one seed is an anecdote.
 *
 * Two of them are also load-bearing beyond this file. The first is the story:
 * a child who just lost retries and meets the storm that beat them, which is
 * only true while `(spec, seed)` decides everything. The second is the one that
 * gives the early levels their shape — `gap` above `fall` means pure reaction —
 * and it is arithmetic, so the boundary case is tested at the boundary and one
 * millisecond the other side of it.
 */

/**
 * Enough seeds that a rare draw is not a lucky pass.
 *
 * Spread rather than 0–15, for the same reason `generate.test.ts` spreads
 * its: `mulberry32` is well-behaved over neighbouring seeds, but the numbers a
 * run actually uses come from `randomSeed()` and look nothing like a counter.
 */
const SEEDS = [
  0, 1, 2, 7, 42, 99, 128, 1000, 4242, 65535, 123456, 999983, 2147483647,
  16777216, 31337, 8675309,
];

const HOME = ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"];

const spec = (over: Partial<WaveSpec>): WaveSpec => ({
  keys: HOME,
  count: 24,
  gap: [900, 1300],
  fall: [1000, 1600],
  shield: 3,
  repairAt: 0,
  ...over,
});

/**
 * The shapes the twenty levels will be built out of (§8.3, §5.6's storm rows).
 *
 * Written as levels rather than as fixtures so that a property which only
 * holds for tidy specs fails here: two of them draw from the alphabet a real
 * lesson unlocks, which is where the space bar and the capitals come from.
 */
const SPECS: [name: string, spec: WaveSpec][] = [
  // Lesson 4. Two keys, one at a time — `gap` clear of `fall`.
  [
    "first ice",
    spec({ keys: ["f", "j"], count: 12, gap: [1400, 1800], fall: [900, 1200] }),
  ],
  // Lesson 9. The home row, still one at a time, but only just.
  [
    "home row",
    spec({
      keys: [...unlockedAt(13)],
      count: 20,
      gap: [1200, 1500],
      fall: [800, 1200],
    }),
  ],
  // Lesson 13 onwards. Overlapping, so the child has to work bottom-up.
  ["eight lanes", spec({ keys: HOME, count: 24 })],
  // Lesson 34. Capitals fall too — `A` and `a` are one key and two letters.
  [
    "capitals",
    spec({
      keys: ["a", "A", "s", "S", "l", "L", ";", ":"],
      count: 30,
      gap: [600, 1000],
      fall: [1200, 2000],
    }),
  ],
  // Lesson 59. Digits, which live on a row of their own.
  [
    "numbers falling",
    spec({
      keys: ["1", "2", "3", "8", "9", "0"],
      count: 30,
      gap: [700, 1100],
      fall: [1300, 1900],
    }),
  ],
  // Lesson 93. Everything the ladder ever hands over, including the space it
  // always carries, at speed and with no repairs.
  [
    "everything falls",
    spec({
      keys: [...unlockedAt(100)],
      count: 40,
      gap: [200, 400],
      fall: [1400, 2400],
      shield: 2,
      repairAt: 6,
    }),
  ],
  // Lesson 73. Long, so a schedule that drifts has room to show it.
  ["the long wave", spec({ keys: [...unlockedAt(100)], count: 60 })],
];

/**
 * The specs whose `gap` clears their `fall` — the levels that are pure
 * reaction — and the ones whose ranges overlap.
 *
 * Both read `fallRange(spec)` and never `spec.fall`, which is what
 * `fallRange`'s own docstring asks for: `MIN_FALL_MS` can only ever RAISE a
 * fall, so a spec that declared "one letter at a time" with falls under the
 * floor gets letters that overlap — and a classifier reading the declaration
 * would put it in the group whose assertion is that they never do. Today's
 * fixtures are all above the floor, so the two readings agree; the pair at the
 * bottom of this file is what keeps that a fact rather than an assumption.
 */
const REACTION = SPECS.filter(([, s]) => s.gap[0] >= fallRange(s)[1]);
const STACKING = SPECS.filter(([, s]) => s.gap[1] < fallRange(s)[0]);

/**
 * The most letters on the field at any one moment.
 *
 * The count on screen only ever goes up at a spawn, so asking `isAirborne` at
 * every spawn instant finds the maximum without a sweep. Reading the half-open
 * interval out of the engine rather than restating it here is what makes the
 * boundary pair at the bottom of this file — `gap` exactly `fall`, and one
 * millisecond the other side — a test of the rule the reducer actually fires
 * and damages by, instead of a test of a second copy of it that happens to
 * live in the test file.
 */
const maxOnScreen = (wave: Wave): number =>
  Math.max(
    0,
    ...wave.letters.map(
      (l) =>
        wave.letters.filter((other) => isAirborne(other, l.spawnMs)).length,
    ),
  );

/** The gaps between one spawn and the next, which is what `spec.gap` samples. */
const gapsOf = (wave: Wave) =>
  wave.letters.slice(1).map((l, i) => l.spawnMs - wave.letters[i].spawnMs);

describe("a wave is deterministic in (spec, seed)", () => {
  it("builds the same storm twice, for every spec and every seed", () => {
    for (const [name, s] of SPECS)
      for (const seed of SEEDS)
        expect(buildWave(s, seed), `${name} @ ${seed}`).toEqual(
          buildWave(s, seed),
        );
  });

  it("meets the storm that beat you when you retry it", () => {
    // The story, spelled out: a retry has nothing but the wave in hand, and
    // rebuilding from what the wave carries has to produce the wave back.
    for (const [name, s] of SPECS)
      for (const seed of SEEDS) {
        const wave = buildWave(s, seed);
        expect(buildWave(wave.spec, wave.seed), `${name} @ ${seed}`).toEqual(
          wave,
        );
      }
  });

  it("builds a different storm from a different seed", () => {
    // Otherwise "deterministic" would be satisfied by a generator that ignored
    // the seed entirely, and every level would be the same storm forever.
    for (const [name, s] of SPECS.filter(([, s]) => s.keys.length > 4)) {
      const storms = new Set(
        SEEDS.map((seed) => JSON.stringify(buildWave(s, seed).letters)),
      );
      expect(storms.size, name).toBe(SEEDS.length);
    }
  });

  it("reads no randomness of its own", () => {
    // `Math.random()` anywhere in here would make a wave unrepeatable while
    // every other assertion in this file still passed — the two calls would
    // simply differ from each other, and only a child pressing "again" would
    // ever find out. So the global is taken away for the length of one build.
    const real = Math.random;
    Math.random = () => {
      throw new Error("buildWave must draw only from mulberry32(seed)");
    };
    try {
      for (const [, s] of SPECS) expect(() => buildWave(s, 42)).not.toThrow();
    } finally {
      Math.random = real;
    }
  });
});

describe("every letter in a wave is one the child can shoot", () => {
  it("falls only characters that are in spec.keys and on this board", () => {
    for (const [name, s] of SPECS) {
      const allowed = new Set(s.keys);
      for (const seed of SEEDS)
        for (const letter of buildWave(s, seed).letters) {
          const where = `${name} @ ${seed}: ${letter.ch}`;
          expect(allowed.has(letter.ch), where).toBe(true);
          // The same null `reachable()` is built out of (§5.2). A letter this
          // layout cannot produce is a letter that can never be shot.
          expect(strokeFor(letter.ch), where).not.toBeNull();
        }
    }
  });

  it("carries the key, the finger and the lane the layout gives it", () => {
    // Restating any of the three inside the game would be a second copy of the
    // layout, and a lane half a unit out is a spatial hint that teaches the
    // wrong thing. So each is checked against `engine/keyboard.ts` itself.
    for (const [name, s] of SPECS)
      for (const seed of SEEDS)
        for (const letter of buildWave(s, seed).letters) {
          const where = `${name} @ ${seed}: ${letter.ch}`;
          const stroke = strokeFor(letter.ch);
          expect(letter.code, where).toBe(stroke?.code);
          expect(letter.finger, where).toBe(stroke?.finger);
          expect(letter.lane, where).toBe(keyX(letter.code));
        }
  });

  it("never drops anything onto a thumb", () => {
    // The shield has eight segments, one per finger, and none for the thumbs
    // (§8.5) — so a falling space would have nothing above it to damage. The
    // unlocked alphabet always contains one, which is why this is a filter and
    // not a note in the docs.
    const alphabet = SPECS.find(([name]) => name === "everything falls")![1];
    expect(
      alphabet.keys,
      "the premise: the alphabet carries a space",
    ).toContain(" ");

    for (const [name, s] of SPECS)
      for (const seed of SEEDS)
        for (const letter of buildWave(s, seed).letters)
          expect(letter.finger, `${name} @ ${seed}`).not.toBe("thumb");
  });

  it("falls each letter down the column of its own key", () => {
    // §8.2, in one assertion each: the two examples the design is written in.
    const f = buildWave(spec({ keys: ["f"], count: 1 }), 1).letters[0];
    expect(f.lane).toBe(keyX("KeyF"));

    const y = buildWave(spec({ keys: ["y"], count: 1 }), 1).letters[0];
    expect(y.lane).toBe(keyX("KeyY"));
    expect(y.lane).toBeGreaterThan(keyX("KeyG")!);
    expect(y.lane).toBeLessThan(keyX("KeyH")!);
  });

  it("drops a character this board cannot produce, and keeps the rest", () => {
    // Curly quotes and em dashes are what prose pulled from a library carries,
    // and the level that let one through would be unbeatable rather than hard.
    const wave = buildWave(spec({ keys: ["“", "—", "f"] }), 7);
    expect(wave.letters).toHaveLength(24);
    expect(new Set(wave.letters.map((l) => l.ch))).toEqual(new Set(["f"]));
  });

  it("is an empty storm rather than a throw when nothing can fall", () => {
    // The engine's habit: a mode that no longer makes sense still opens
    // (`deckSpec` never throws). A wave with nothing in it is a screen that
    // ends; a throw is a game loop that dies holding a child's run.
    const wave = buildWave(spec({ keys: [" ", "“"], count: 20 }), 3);
    expect(wave.letters).toEqual([]);
    expect(wave.durationMs).toBe(0);
    expect(wave.spec.count, "the spec is echoed as written").toBe(20);
  });

  it("falls exactly as many letters as the spec asks for", () => {
    for (const [name, s] of SPECS)
      for (const seed of SEEDS)
        expect(buildWave(s, seed).letters, `${name} @ ${seed}`).toHaveLength(
          s.count,
        );
  });
});

describe("gap and fall are sampled per letter", () => {
  it("keeps every draw inside the spec's ranges", () => {
    for (const [name, s] of SPECS)
      for (const seed of SEEDS) {
        const wave = buildWave(s, seed);
        const where = `${name} @ ${seed}`;

        expect(wave.letters[0].spawnMs, `${where}: the wave starts at 0`).toBe(
          0,
        );
        for (const gap of gapsOf(wave)) {
          expect(gap, `${where}: gap`).toBeGreaterThanOrEqual(s.gap[0]);
          expect(gap, `${where}: gap`).toBeLessThanOrEqual(s.gap[1]);
        }
        for (const letter of wave.letters) {
          expect(letter.fallMs, `${where}: fall`).toBeGreaterThanOrEqual(
            s.fall[0],
          );
          expect(letter.fallMs, `${where}: fall`).toBeLessThanOrEqual(
            s.fall[1],
          );
        }
      }
  });

  it("draws a fresh number for each letter, not one for the wave", () => {
    // "Sometimes random within the level" (§8.3) is the whole difference
    // between a storm and a metronome, and a generator that sampled once per
    // wave would satisfy every range assertion above.
    for (const [name, s] of SPECS.filter(([, s]) => s.count >= 20))
      for (const seed of SEEDS) {
        const wave = buildWave(s, seed);
        const where = `${name} @ ${seed}`;
        expect(new Set(gapsOf(wave)).size, `${where}: gaps`).toBeGreaterThan(5);
        expect(
          new Set(wave.letters.map((l) => l.fallMs)).size,
          `${where}: falls`,
        ).toBeGreaterThan(5);
      }
  });

  it("can draw either end of a range", () => {
    // A range of three, so every value in it must turn up across the sweep.
    // This is the assertion an exclusive bound fails: a generator that never
    // reached `max` would make every level fractionally easier than written,
    // and nothing else here would notice.
    //
    // The fall range sits just above `MIN_FALL_MS` rather than at any three
    // numbers, because the floor would flatten a range under it (below) — and
    // a range flattened to a constant is exactly what this assertion is here
    // to catch. Sitting one millisecond above the floor also says the floor
    // does not disturb a range that clears it.
    const s = spec({
      keys: HOME,
      count: 40,
      gap: [10, 12],
      fall: [MIN_FALL_MS + 1, MIN_FALL_MS + 3],
    });
    const gaps = new Set<number>();
    const falls = new Set<number>();
    for (const seed of SEEDS) {
      const wave = buildWave(s, seed);
      for (const gap of gapsOf(wave)) gaps.add(gap);
      for (const letter of wave.letters) falls.add(letter.fallMs);
    }
    expect([...gaps].sort()).toEqual([10, 11, 12]);
    expect([...falls].sort((a, b) => a - b)).toEqual([
      MIN_FALL_MS + 1,
      MIN_FALL_MS + 2,
      MIN_FALL_MS + 3,
    ]);
  });
});

describe("no letter is ever a blur", () => {
  /*
   * The cap at the top of the ladder (§8.10, decision 52). "Whiteout" is meant
   * to be hard because there are many letters, not because one of them cannot
   * be read — and the only place that can be guaranteed is the generator,
   * because the twenty specs are a table and a table is edited a row at a time.
   */

  it("floors every fall a too-fast spec asks for", () => {
    const blur = spec({ count: 40, gap: [200, 300], fall: [40, 200] });
    for (const seed of SEEDS)
      for (const letter of buildWave(blur, seed).letters)
        expect(letter.fallMs, `@ ${seed}`).toBe(MIN_FALL_MS);
  });

  it("holds for every spec and seed in this file, capped or not", () => {
    // The universal form of it: whatever a level declares, nothing crosses the
    // sky faster than the floor. The specs above all clear it, so this is the
    // assertion that keeps clearing it true of a table somebody re-tunes.
    for (const [name, s] of SPECS)
      for (const seed of SEEDS)
        for (const letter of buildWave(s, seed).letters)
          expect(letter.fallMs, `${name} @ ${seed}`).toBeGreaterThanOrEqual(
            MIN_FALL_MS,
          );
  });

  it("leaves a spec that clears the floor exactly as it was written", () => {
    // A cap that quietly re-tuned the levels that were already fine would be a
    // difficulty knob wearing a safety rail's clothes.
    for (const [name, s] of SPECS) {
      expect(fallRange(s), name).toEqual(s.fall);
      for (const seed of SEEDS)
        for (const letter of buildWave(s, seed).letters) {
          expect(letter.fallMs, `${name} @ ${seed}`).toBeGreaterThanOrEqual(
            s.fall[0],
          );
          expect(letter.fallMs, `${name} @ ${seed}`).toBeLessThanOrEqual(
            s.fall[1],
          );
        }
    }
  });

  it("raises a range rather than flattening it", () => {
    // Clamping each sample would pile every letter of a too-fast spec onto the
    // floor exactly; clamping the range keeps the draw a draw. Only the half
    // of the range under the floor moves.
    const half = spec({ count: 40, fall: [MIN_FALL_MS - 400, 2000] });
    expect(fallRange(half)).toEqual([MIN_FALL_MS, 2000]);

    const falls = new Set<number>();
    for (const seed of SEEDS)
      for (const letter of buildWave(half, seed).letters)
        falls.add(letter.fallMs);
    expect(Math.min(...falls)).toBeGreaterThanOrEqual(MIN_FALL_MS);
    expect(falls.size).toBeGreaterThan(5);
  });

  it("still builds the same storm twice under the cap", () => {
    // The floor is part of what a seed means, and a cap applied anywhere but
    // in the build would make a replay a different wave.
    const blur = spec({ count: 20, fall: [10, 100] });
    for (const seed of SEEDS)
      expect(buildWave(blur, seed), `@ ${seed}`).toEqual(buildWave(blur, seed));
  });
});

describe("the schedule the wave hands the reducer", () => {
  it("spawns in order and lands a fall later", () => {
    for (const [name, s] of SPECS)
      for (const seed of SEEDS) {
        const wave = buildWave(s, seed);
        wave.letters.forEach((letter, i) => {
          const where = `${name} @ ${seed}: letter ${i}`;
          expect(letter.landMs, where).toBe(letter.spawnMs + letter.fallMs);
          if (i > 0)
            expect(letter.spawnMs, where).toBeGreaterThanOrEqual(
              wave.letters[i - 1].spawnMs,
            );
        });
      }
  });

  it("runs until the last letter lands, which is not the last letter", () => {
    // A slow letter spawned early can land after a fast one spawned later, so
    // the wave's length is a max and not the final element. Sixteen seeds of a
    // spec with a wide `fall` and a tight `gap` is enough to make it happen.
    for (const [name, s] of SPECS)
      for (const seed of SEEDS) {
        const wave = buildWave(s, seed);
        expect(wave.durationMs, `${name} @ ${seed}`).toBe(
          Math.max(...wave.letters.map((l) => l.landMs)),
        );
      }

    // Written above `MIN_FALL_MS` so the range is the one the letters get: the
    // floor would raise a 100ms fall to 800 anyway, and a spec that says one
    // thing while the wave does another is a fixture nobody can reason from.
    const overtaking = spec({
      count: 20,
      gap: [10, 10],
      fall: [MIN_FALL_MS, 2000],
    });
    const waves = SEEDS.map((seed) => buildWave(overtaking, seed));
    expect(
      waves.some((w) => w.durationMs !== w.letters.at(-1)!.landMs),
      "the premise: a slow letter is sometimes overtaken",
    ).toBe(true);
  });
});

describe("when gap clears fall, one letter falls at a time", () => {
  /*
   * The invariant the early levels are made of (§8.3), and it is arithmetic
   * rather than luck. Letter i is on the field over `[spawn_i, spawn_i +
   * fall_i)` and letter i+1 spawns at `spawn_i + gap_{i+1}`, so the two share
   * the screen exactly when `gap_{i+1} < fall_i`. If every gap the spec can
   * draw is at least every fall it can draw, that is never true — and because
   * spawn times only increase, no later letter can overlap letter i either.
   *
   * The boundary goes to safety: `gap` exactly equal to `fall` still leaves one
   * letter on screen, because a letter occupies `[spawnMs, landMs)` — it is
   * gone the instant it lands, and landing is the tick that turns it into
   * shield damage. So the guarantee is `gap[0] >= fall[1]`, not `>`.
   */

  it("puts nothing beside a letter on the reaction levels", () => {
    expect(
      REACTION.length,
      "the premise: some levels are reaction",
    ).toBeGreaterThan(0);

    for (const [name, s] of REACTION) {
      expect(s.gap[0], `${name} is a reaction level`).toBeGreaterThanOrEqual(
        fallRange(s)[1],
      );
      for (const seed of SEEDS)
        expect(maxOnScreen(buildWave(s, seed)), `${name} @ ${seed}`).toBe(1);
    }
  });

  it("holds when a gap is exactly a fall", () => {
    // The boundary itself. The outgoing letter lands on the same millisecond
    // the next one spawns, which is a handover and not an overlap.
    const s = spec({ count: 30, gap: [900, 900], fall: [900, 900] });
    for (const seed of SEEDS)
      expect(maxOnScreen(buildWave(s, seed)), `@ ${seed}`).toBe(1);
  });

  it("is not a reaction level just because the row says so", () => {
    // The floor raises a fall and can therefore turn a spacing promise into an
    // overlap (§8.10, `fallRange`): this spec's own numbers read as one letter
    // at a time — 700ms between spawns against a 500ms fall — and the wave it
    // builds puts two on screen, because every letter falls for 800ms. Which
    // is the right way for it to go; the alternative is a level keeping its
    // promise by dropping letters nobody could read.
    //
    // It is here because the classification above is otherwise only ever asked
    // of specs written above the floor, where the two readings agree and a
    // classifier reading `spec.fall` would look correct forever.
    const s = spec({ count: 20, gap: [700, 700], fall: [300, 500] });
    expect(s.gap[0], "reads as a reaction level").toBeGreaterThanOrEqual(
      s.fall[1],
    );
    expect(s.gap[0], "and is not one").toBeLessThan(fallRange(s)[1]);
    for (const seed of SEEDS)
      expect(maxOnScreen(buildWave(s, seed)), `@ ${seed}`).toBe(2);
  });

  it("stops holding one millisecond the other side of it", () => {
    // And this is the assertion that makes the one above mean something: move
    // the boundary by a millisecond in the direction that overlaps, and two
    // letters share the screen. An off-by-one in either direction fails one of
    // this pair.
    const s = spec({ count: 30, gap: [899, 899], fall: [900, 900] });
    for (const seed of SEEDS)
      expect(maxOnScreen(buildWave(s, seed)), `@ ${seed}`).toBe(2);
  });

  it("stacks letters up on the levels that mean to", () => {
    // The other half of the shape: later levels overlap the ranges so that two
    // or three are in the air and the child has to work bottom-up. Without
    // this the invariant above could be satisfied by a generator that never
    // put two letters on screen at all.
    expect(STACKING.length, "the premise: some levels stack").toBeGreaterThan(
      0,
    );

    for (const [name, s] of STACKING)
      for (const seed of SEEDS)
        expect(
          maxOnScreen(buildWave(s, seed)),
          `${name} @ ${seed}`,
        ).toBeGreaterThan(1);
  });
});

/* ═══ The reducer (§8.4, §8.5) ═══════════════════════════════════════════════
 *
 * The wave above is tested as a distribution, because that is what a generator
 * is. The rules below are tested at the millisecond instead, on waves written
 * by hand: "the second-lowest letter is a miss" and "a letter landing in a hole
 * ends the run" are claims about single instants, and a generated schedule
 * would only ever reach them by luck.
 */

/**
 * One letter, placed by hand.
 *
 * Built through `strokeFor`/`keyX` rather than with literal codes and fingers
 * so that a fixture cannot quietly disagree with the board the game is played
 * on: `at("f", …)` really is the left index finger's zone, and a change to the
 * layout breaks these tests where it should.
 */
const at = (ch: string, spawnMs: number, fallMs: number): StormLetter => {
  const stroke = strokeFor(ch);
  if (!stroke || stroke.finger === "thumb")
    throw new Error(`${ch} is not a letter that can fall`);
  return {
    ch,
    code: stroke.code,
    finger: stroke.finger,
    lane: keyX(stroke.code) ?? 0,
    spawnMs,
    fallMs,
    landMs: spawnMs + fallMs,
  };
};

/** A run over exactly these letters, at time zero. */
const runOf = (letters: StormLetter[], over: Partial<WaveSpec> = {}) =>
  startStorm({
    spec: spec({ count: letters.length, shield: 1, ...over }),
    seed: 0,
    letters,
    durationMs: letters.reduce((last, l) => Math.max(last, l.landMs), 0),
  });

/** Advance the run to an absolute moment, which is how a test thinks. */
const to = (state: StormState, ms: number) => tick(state, ms - state.timeMs);

/** Eight zones, all at `points` — what an undamaged shield looks like. */
const evenShield = (points: number): Shield =>
  Object.fromEntries(SHIELD_FINGERS.map((f) => [f, points])) as Shield;

/** Which letters got through, by index — the shape STM07's death screen counts. */
const landed = (state: StormState) =>
  state.resolved.flatMap((outcome, index) =>
    outcome?.outcome === "landed" ? [index] : [],
  );

describe("where a letter is at time t", () => {
  const letter = at("f", 1000, 500);

  it("is on the field over [spawn, land), and not one millisecond either side", () => {
    // Decision 30, as a boundary rather than as prose. The instant it lands is
    // the tick that turns it into shield damage, so it cannot still be
    // shootable there — a letter that was both would be a free hit that also
    // took a hit point off.
    expect(isAirborne(letter, 999)).toBe(false);
    expect(isAirborne(letter, 1000)).toBe(true);
    expect(isAirborne(letter, 1499)).toBe(true);
    expect(isAirborne(letter, 1500)).toBe(false);

    expect(hasLanded(letter, 1499)).toBe(false);
    expect(hasLanded(letter, 1500)).toBe(true);
  });

  it("has not landed before it has spawned", () => {
    // `hasLanded` is not `!isAirborne`: a letter still to come is neither, and
    // a reducer that read it as "landed" would charge the shield for letters
    // that never fell.
    expect(isAirborne(letter, 0)).toBe(false);
    expect(hasLanded(letter, 0)).toBe(false);
  });

  it("falls from 0 at the top to 1 at the shield", () => {
    expect(progressAt(letter, 1000)).toBe(0);
    expect(progressAt(letter, 1250)).toBe(0.5);
    expect(progressAt(letter, 1500)).toBe(1);
  });
});

describe("the lowest letter is the target", () => {
  it("is the greatest fall progress, not the earliest landing", () => {
    // The disagreement STM01 wrote down, built to order: a slow letter spawned
    // first is more than halfway down while a fast one spawned later has
    // barely started — and yet the fast one lands first. `landMs` order would
    // aim the gun at the letter that is visibly nearer the top of the screen.
    const slow = at("f", 0, 5000); // lands at 5000
    const fast = at("j", 3000, 1000); // lands at 4000
    const state = to(runOf([slow, fast], { shield: 3 }), 3100);

    expect(progressAt(slow, 3100)).toBeGreaterThan(progressAt(fast, 3100));
    expect(slow.landMs).toBeGreaterThan(fast.landMs);
    expect(targetIndex(state)).toBe(0);
  });

  it("hands the target over as the two letters cross", () => {
    // Different fall speeds means the orderings really do swap, once, at a
    // crossing — so the target before it, at it, and after it are three
    // different answers and all three are tested.
    const first = at("f", 0, 2000);
    const second = at("j", 500, 1000);
    const state = runOf([first, second], { shield: 3 });

    expect(targetIndex(to(state, 900))).toBe(0);
    expect(progressAt(first, 1000)).toBe(progressAt(second, 1000));
    expect(targetIndex(to(state, 1000))).toBe(0);
    expect(targetIndex(to(state, 1100))).toBe(1);
  });

  it("gives an exact tie to the earlier spawn", () => {
    // Two letters at the same height are the same shot to a child, so the tie
    // goes to the letter's identity — the index — and a replay of the same
    // wave resolves the dead heat the same way every time.
    const state = to(runOf([at("f", 0, 1000), at("j", 0, 1000)]), 400);
    expect(targetIndex(state)).toBe(0);
  });

  it("has no target when the field is empty", () => {
    const state = runOf([at("f", 1000, 500)], { shield: 3 });
    expect(targetIndex(state), "before the first spawn").toBeNull();
    expect(targetIndex(to(state, 1500)), "after it has landed").toBeNull();
  });

  it("stops targeting a letter that has been shot", () => {
    const state = to(runOf([at("f", 0, 1000), at("j", 100, 1000)]), 200);
    expect(targetIndex(state)).toBe(0);
    expect(targetIndex(fire(state, "KeyF"))).toBe(1);
  });
});

describe("firing resolves the lowest letter, and nothing else", () => {
  const two = () => to(runOf([at("f", 0, 1000), at("j", 300, 1000)]), 500);

  it("shoots the lowest letter with its own key", () => {
    const state = fire(two(), "KeyF");
    expect(state.resolved[0]).toEqual({
      outcome: "shot",
      atMs: 500,
      combo: 1,
    });
    expect(state.resolved[1], "the letter above it is untouched").toBeNull();
    expect(state.combo).toBe(1);
    expect(state.shield, "a hit costs the shield nothing").toEqual(
      evenShield(1),
    );
  });

  it("counts the second-lowest letter as a miss", () => {
    // The rule the whole game is balanced on. `KeyJ` is a real letter on a
    // real lane and it is the wrong shot, because it is not the one about to
    // cost a shield point.
    const before = two();
    const state = fire(before, "KeyJ");

    expect(targetIndex(before), "the premise: KeyJ is not the target").toBe(0);
    expect(isAirborne(before.wave.letters[1], 500)).toBe(true);
    expect(state.resolved, "nothing was resolved").toEqual([null, null]);
    expect(state.combo).toBe(0);
    expect(state.shield).toEqual(evenShield(1));
  });

  it("counts a key nothing on screen uses as a miss", () => {
    const state = fire(two(), "KeyZ");
    expect(state.resolved).toEqual([null, null]);
    expect(state.combo).toBe(0);
  });

  it("counts a shot at an empty field as a miss", () => {
    // Spraying between letters is the same strategy by another route, so it
    // costs the streak the same way.
    const state = fire(runOf([at("f", 1000, 500)]), "KeyF");
    expect(targetIndex(state), "the premise: nothing is falling").toBeNull();
    expect(state.resolved).toEqual([null]);
    expect(state.combo).toBe(0);
  });

  it("shoots a capital with the key that types it", () => {
    // `A` and `a` are one key and two letters (decision 2), so the shift a
    // child is holding cannot make the shot miss.
    const state = to(runOf([at("A", 0, 1000)]), 400);
    expect(state.wave.letters[0].code).toBe("KeyA");
    expect(fire(state, "KeyA").resolved[0]?.outcome).toBe("shot");
  });

  it("does nothing once the run is over", () => {
    const dead = to(runOf([at("f", 0, 100), at("f", 200, 100)]), 400);
    expect(dead.ending?.kind, "the premise: the run ended").toBe("breached");
    expect(fire(dead, "KeyF")).toBe(dead);
    expect(tick(dead, 1000)).toBe(dead);
  });
});

/* ═══ Score, combo and XP (§8.6) ═════════════════════════════════════════════
 *
 * Two numbers with opposite rules, which is the whole of this section: the
 * score is the run's and may fall, the XP is the profile's and may not. They
 * are tested together because the only way to get them wrong is to let one
 * become the other.
 */

/**
 * Twelve `f`s in the air at once, and nothing else.
 *
 * Every letter falls for twenty seconds from within the first tenth of a
 * second, so at 200ms all twelve are airborne and none can land during a test.
 * They are all the same character, and the target is the greatest fall
 * progress — which for equal fall times is the earliest spawn — so `KeyF`
 * shoots them in index order and a chain of hits needs no clock at all.
 * `KeyZ` is a wrong key for every one of them.
 */
const volley = (): StormState =>
  to(
    runOf(
      Array.from({ length: 12 }, (_, i) => at("f", i * 10, 20_000)),
      { shield: 9 },
    ),
    200,
  );

/** Fire `codes` in order, and report the score after each one. */
const scores = (state: StormState, codes: string[]): number[] =>
  codes.map((code) => (state = fire(state, code)).score);

describe("a run of clean hits is worth more", () => {
  it("pays a hit at the multiplier the hit itself lands on", () => {
    // Ten points, scaled by the streak AFTER the hit — the same convention
    // `cardXp(ms, streakAfter)` pays a flash card at, and the same number the
    // HUD is showing by the time a child looks at it. So the first hit is
    // ×1.1 and not ×1.
    expect(scores(volley(), Array(4).fill("KeyF"))).toEqual([11, 23, 36, 50]);
  });

  it("stops growing at ×2, ten in a row", () => {
    // `comboMultiplier` caps at ten steps, so the eleventh and twelfth hits
    // are worth exactly what the tenth was. Uncapped, the end of a long wave
    // would be worth more than the whole of the start of it.
    const gains = scores(volley(), Array(12).fill("KeyF")).map(
      (score, i, all) => score - (all[i - 1] ?? 0),
    );
    expect(gains).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 20, 20]);
  });

  it("records the streak each letter was shot on", () => {
    // Not recoverable from anything else in the run — a wrong key breaks the
    // combo and resolves no letter — and `stormXp` needs it to pay the hit at
    // the multiplier the child actually had.
    const state = fire(fire(fire(volley(), "KeyF"), "KeyZ"), "KeyF");
    expect(state.resolved.map((outcome) => outcome?.combo)).toEqual([
      1,
      1,
      ...Array(10).fill(undefined),
    ]);
    expect(state.resolved[1]).toEqual({ outcome: "shot", atMs: 200, combo: 1 });
  });
});

describe("a wrong key costs", () => {
  it("takes points off and breaks the streak in the same stroke", () => {
    const built = fire(fire(fire(volley(), "KeyF"), "KeyF"), "KeyF");
    expect([built.score, built.combo, built.misses]).toEqual([36, 3, 0]);

    const missed = fire(built, "KeyZ");
    expect(missed.score, "one wrong key undoes one plain hit").toBe(26);
    expect(missed.combo, "and the multiplier with it").toBe(0);
    expect(missed.misses).toBe(1);
    expect(missed.resolved, "and nothing on the field moved").toEqual(
      built.resolved,
    );

    // The next hit is back at ×1.1, which is the real cost of the miss: the
    // ten points, and every later hit paid at a multiplier that has to be
    // earned again.
    expect(fire(missed, "KeyF").score - missed.score).toBe(11);
  });

  it("charges the same for a shot at an empty sky", () => {
    // Spraying between letters is the same strategy by another route (§8.4),
    // so it costs the same. The screen says so with the `--flare` wash over the
    // score, which is every miss's signal now that the storm draws no board to
    // turn red (decision 64).
    const empty = runOf([at("f", 1000, 500)]);
    expect(targetIndex(empty), "the premise: nothing is falling").toBeNull();

    const state = fire(empty, "KeyF");
    expect([state.score, state.misses]).toEqual([-10, 1]);
  });

  it("lets the score go negative, because it is the run's own", () => {
    // A five-year-old who hammers the board bottoms out below zero and can
    // see it. Nothing about that reaches the profile: `stormXp` is floored,
    // and it is floored at the other end of the run rather than here.
    const sprayed = fire(fire(fire(volley(), "KeyZ"), "KeyQ"), "KeyP");
    expect(sprayed.score).toBe(-30);
    expect(sprayed.misses).toBe(3);
    expect(stormXp(sprayed)).toBe(0);
  });

  it("charges a letter that got through to the shield and not to the score", () => {
    // One wrong, one cost. A landing has already taken a shield point, which
    // is the thing that ends runs, and charging for it twice would make the
    // number that goes down mean two different failures at once.
    const hit = fire(
      to(runOf([at("f", 0, 400), at("j", 0, 1000)]), 100),
      "KeyF",
    );
    const through = to(hit, 1200);

    expect(through.resolved[1]?.outcome, "the j landed").toBe("landed");
    expect(through.score, "and cost the score nothing").toBe(hit.score);
    expect(through.misses, "it is not a wrong key").toBe(0);
    expect(through.combo, "it does break the streak").toBe(0);
  });
});

/* ── The miss flash, and the one cadence a wave cannot shape (decision 57) ──
 *
 * §8.10's "no strobe, ever, in any mode" is kept two different ways, because
 * the two things that light have two different clocks. A shield zone tints
 * when a letter LANDS, so its rate is a property of the schedule and each of
 * the twenty levels is held to two a second at its own seed (`storms.test.ts`).
 * The score's `--flare` wash fires when a child presses a WRONG KEY, and no
 * spec can shape a hand: auto-repeat is already not a shot (decision 44), but
 * eight or ten deliberate presses a second is a seven-year-old having a bad
 * time and not a bug to defend against.
 *
 * So the wash carries its own floor, here in the reducer where the clock is.
 * What a miss costs is unchanged and unconditional; what is rate-limited is
 * only the moment the HUD mounts a fresh element from (`StormHud`).
 */
describe("the miss flash cannot be strobed by a fast hand", () => {
  /** A run with a letter in the air, so a wrong key is a miss and not a stroke
   * at an empty sky — the two cost the same, and this keeps the cause plain. */
  const live = () => to(runOf([at("f", 0, 20_000)]), 0);

  it("is unlit until the first miss", () => {
    expect(live().missTintAt).toBeNull();
    expect(startStorm(buildWave(spec({}), 3)).missTintAt).toBeNull();
  });

  it("lights at the moment of the miss, in wave time", () => {
    const missed = fire(to(live(), 1234), "KeyZ");
    expect(missed.missTintAt).toBe(1234);
    expect(missed.misses).toBe(1);
  });

  it("does not relight while the last flash is still recent", () => {
    let state = fire(to(live(), 1000), "KeyZ");
    const lit = state.missTintAt;

    // Six more wrong keys over the next 300ms — a hand going about as fast as
    // a hand goes. Every one of them costs ten points and the streak; none of
    // them mounts a second element.
    for (let ms = 1050; ms <= 1300; ms += 50)
      state = fire(to(state, ms), "KeyZ");

    expect(state.misses, "every miss counted").toBe(7);
    expect(state.score, "and every miss charged").toBe(-70);
    expect(state.missTintAt, "one flash, not seven").toBe(lit);
  });

  it("lights again once the gap has passed", () => {
    const first = fire(to(live(), 0), "KeyZ");
    const inside = fire(to(first, MIN_TINT_GAP_MS - 1), "KeyZ");
    const after = fire(to(inside, MIN_TINT_GAP_MS), "KeyZ");

    expect(inside.missTintAt).toBe(0);
    expect(after.missTintAt).toBe(MIN_TINT_GAP_MS);
  });

  it("stays at two flashes in any one second, whatever the hand does", () => {
    // **Two, not three.** WCAG 2.3.1's line is *more than three* flashes in
    // any one second, and a gap of `g` permits `ceil(1000 / g)` starts inside
    // one — so 340ms would have sat exactly on the line with nothing to spare,
    // and 500 buys the second flash back. That is the same headroom the twenty
    // waves' zone tints ship with (§8.10), on the same screen, for the same
    // five-year-old. Counted the way `storms.test.ts` counts a zone's: starts
    // inside a sliding second, anchored at each start, which is where every
    // window's maximum sits.
    //
    // Swept rather than hammered at one rate, because the worst case is not
    // the fastest hand. A hand landing just inside the gap is the one that
    // reached three, and no amount of pressing faster finds it — so the sweep
    // walks the cadences either side of the constant as well as the ones a
    // child can actually produce.
    const PRESSES = 60;
    // A letter that outlasts the whole sweep, so every press is a miss inside
    // a live run rather than a key at a run that has already ended.
    const held = () => to(runOf([at("f", 0, 120_000)]), 0);

    for (const cadence of [
      10, 20, 40, 60, 100, 150, 200, 250, 333, 400, 450, 499, 500, 501, 750,
    ]) {
      let state = held();
      const lit: number[] = [];
      for (let press = 0; press < PRESSES; press++) {
        state = fire(to(state, press * cadence), "KeyZ");
        if (state.missTintAt !== null && state.missTintAt !== lit.at(-1))
          lit.push(state.missTintAt);
      }

      // Every cost of a miss is charged in full at every cadence. Only the
      // tint is throttled, and that is the whole of decision 57.
      expect(state.misses, `${cadence}ms: every miss counted`).toBe(PRESSES);
      expect(state.score, `${cadence}ms: every miss charged`).toBe(
        -MISS_POINTS * PRESSES,
      );
      expect(state.combo, `${cadence}ms: every miss broke the streak`).toBe(0);
      expect(
        lit.length,
        `${cadence}ms: the premise, a wash that does light`,
      ).toBeGreaterThan(0);

      for (const start of lit)
        expect(
          lit.filter((other) => other >= start && other - start < 1000).length,
          `${cadence}ms, from ${start}ms`,
        ).toBeLessThanOrEqual(2);
    }
  });
});

describe("score can fall; XP cannot", () => {
  /**
   * `stormXp` lives in `engine/progress.ts` beside `cardXp` — the storm's own
   * module may not import it, because it is reachable from `decks/index.ts`
   * and would drag the deck registry and the hundred lessons in behind it
   * (§5.3, decision 7). It is tested here anyway: what it means is a rule
   * about a run, and the run is what this file builds.
   */
  it("pays each hit exactly what `cardXp` pays a card", () => {
    // Reused unchanged, which is what makes a Hailstorm level and a
    // flash-card race pay out on the same scale. Restating the curve here
    // would only pin a copy of it, so the assertion is against `cardXp`
    // itself, on the arguments §8.7 says a hit hands it: how long the letter
    // was in the air, and the streak it was shot on.
    const state = fire(fire(volley(), "KeyF"), "KeyF");
    const shots = [
      { ms: 200 - 0, combo: 1 },
      { ms: 200 - 10, combo: 2 },
    ];

    expect(stormXp(state)).toBe(
      shots.reduce((sum, shot) => sum + cardXp(shot.ms, shot.combo), 0),
    );
    // And it is a real number rather than an accident of two zeroes.
    expect(stormXp(state)).toBeGreaterThan(0);
  });

  it("pays nothing for a letter that landed, and never less than nothing", () => {
    // The floor is what §8.6 turns on: XP is cumulative across years and four
    // games, so a run a child played badly may pay nothing and must never take
    // anything away. Here the score is deep in the red and the XP is zero,
    // which is the pair the whole rule exists to keep apart.
    const beaten = to(
      fire(fire(runOf([at("f", 0, 200)], { shield: 3 }), "KeyZ"), "KeyQ"),
      500,
    );

    expect(beaten.resolved[0]?.outcome).toBe("landed");
    expect(beaten.score).toBeLessThan(0);
    expect(stormXp(beaten)).toBe(0);
  });

  it("is a fold over the run rather than a tally kept during it", () => {
    // The same state twice is the same XP, and a state built two ways is the
    // same XP: nothing about the number depends on how many times it was
    // asked for, which is what "computed once at the end" has to survive.
    const state = fire(fire(fire(volley(), "KeyF"), "KeyZ"), "KeyF");
    expect(stormXp(state)).toBe(stormXp(state));
    expect(stormXp(startStorm(state.wave)), "an untouched run pays 0").toBe(0);
  });
});

describe("what lands takes the shield apart", () => {
  it("takes a point off the zone above it and no others", () => {
    const state = to(runOf([at("f", 0, 100)], { shield: 3 }), 100);
    expect(state.resolved[0]).toEqual({
      outcome: "landed",
      atMs: 100,
      combo: 0,
    });
    expect(state.shield["l-index"], "the finger that types f").toBe(2);
    expect(state.shield).toEqual({ ...evenShield(3), "l-index": 2 });
  });

  it("charges nothing for a letter that was shot", () => {
    const state = to(
      fire(to(runOf([at("f", 0, 1000)], { shield: 3 }), 400), "KeyF"),
      5000,
    );
    expect(state.shield).toEqual(evenShield(3));
    expect(state.resolved[0]?.outcome).toBe("shot");
  });

  it("lets the next letter through once a zone is exhausted", () => {
    // The acceptance criterion, in three moments: a zone at zero is a hole and
    // the run continues; the letter that lands in the hole is what ends it;
    // and the finger it names is the finger that typed it.
    const letters = [at("f", 0, 100), at("f", 200, 100)];
    const state = runOf(letters, { shield: 1 });

    const holed = to(state, 100);
    expect(holed.shield["l-index"]).toBe(0);
    expect(holed.ending, "a hole is not yet a death").toBeNull();

    const dead = to(holed, 300);
    expect(dead.ending).toEqual({
      kind: "breached",
      finger: "l-index",
      index: 1,
    });
    expect(dead.resolved[1], "the letter that got through is recorded").toEqual(
      { outcome: "landed", atMs: 300, combo: 0 },
    );
    expect(dead.shield["l-index"], "there was nothing left to take it").toBe(0);
  });

  it("ends on the first letter when the spec gives no shield at all", () => {
    const state = to(runOf([at("f", 0, 100)], { shield: 0 }), 100);
    expect(state.ending?.kind).toBe("breached");
  });

  it("breaks the streak when a letter gets through", () => {
    // The streak means "are you keeping up", so a letter you let land ends it
    // as surely as a wrong key does — and with it the repair it was earning.
    const hit = fire(
      to(runOf([at("f", 0, 400), at("j", 0, 1000)], { shield: 3 }), 100),
      "KeyF",
    );
    expect(hit.combo, "one clean hit").toBe(1);
    expect(to(hit, 1000).combo, "and then j got through").toBe(0);
  });
});

describe("a tick resolves every landing inside it", () => {
  it("resolves two letters that land in the same tick", () => {
    // The realistic case is a browser that skipped a frame, and the shield has
    // to end up reading the same as it would have over two ticks.
    const state = tick(
      runOf([at("f", 0, 100), at("j", 0, 200)], { shield: 3 }),
      500,
    );

    expect(landed(state)).toEqual([0, 1]);
    expect(state.resolved[0]).toEqual({
      outcome: "landed",
      atMs: 100,
      combo: 0,
    });
    expect(state.resolved[1], "each is timed by its own landing").toEqual({
      outcome: "landed",
      atMs: 200,
      combo: 0,
    });
    expect(state.shield["l-index"]).toBe(2);
    expect(state.shield["r-index"]).toBe(2);
    expect(state.timeMs).toBe(500);
  });

  it("charges a zone twice when both landings are its own", () => {
    const state = tick(
      runOf([at("f", 0, 100), at("f", 0, 200)], { shield: 3 }),
      500,
    );
    expect(state.shield["l-index"], "two hits, not one").toBe(1);
  });

  it("resolves a whole backgrounded tab, letters it never saw included", () => {
    // rAF stops when a tab is hidden, so `dtMs` can be a minute. Every letter
    // in the interval lands, including ones that spawned *and* landed inside
    // it and were airborne at no instant anybody sampled — dropping those
    // would leave the shield disagreeing with the storm that damaged it.
    const letters = ["f", "j", "d", "k", "s", "l"].map((ch, i) =>
      at(ch, i * 1000, 500),
    );
    const state = tick(runOf(letters, { shield: 1 }), 60_000);

    expect(landed(state), "all six").toEqual([0, 1, 2, 3, 4, 5]);
    expect(state.shield, "six zones holed, the pinkies untouched").toEqual({
      ...evenShield(1),
      "l-index": 0,
      "r-index": 0,
      "l-middle": 0,
      "r-middle": 0,
      "l-ring": 0,
      "r-ring": 0,
    });
    expect(state.ending, "survived to the end of the wave").toEqual({
      kind: "cleared",
    });
  });

  it("stops the clock at the landing that ends the run", () => {
    // The rest of that interval never happened: letters still due in it stay
    // unresolved rather than being charged to a shield the child no longer had.
    const letters = [at("f", 0, 100), at("f", 200, 100), at("j", 400, 100)];
    const state = tick(runOf(letters, { shield: 1 }), 60_000);

    expect(state.ending).toEqual({
      kind: "breached",
      finger: "l-index",
      index: 1,
    });
    expect(state.timeMs, "the run's own duration stays honest").toBe(300);
    expect(state.resolved[2], "the third letter never got to land").toBeNull();
    expect(state.shield["r-index"], "and never damaged anything").toBe(1);
  });

  it("never rewinds the storm", () => {
    const state = to(runOf([at("f", 0, 1000)], { shield: 3 }), 400);
    expect(tick(state, -1000).timeMs).toBe(400);
  });
});

describe("the wave ends", () => {
  it("clears with the shield untouched when every letter is shot", () => {
    const letters = [
      at("f", 0, 1000),
      at("j", 400, 1000),
      at("k", 800, 1000),
      at(";", 1200, 1000),
    ];
    let state = runOf(letters, { shield: 3 });
    for (const [ms, code] of [
      [100, "KeyF"],
      [500, "KeyJ"],
      [900, "KeyK"],
      [1300, "Semicolon"],
    ] as const)
      state = fire(to(state, ms), code);

    expect(state.ending, "cleared as the last letter is shot").toEqual({
      kind: "cleared",
    });
    expect(state.shield, "eight zones, all as the spec wrote them").toEqual(
      evenShield(3),
    );
    expect(landed(state), "nothing got through").toEqual([]);
    expect(state.combo).toBe(4);
    expect(
      state.timeMs,
      "and it did not wait for the last letter to fall",
    ).toBeLessThan(letters[3].landMs);
  });

  it("is born cleared when nothing can fall", () => {
    // §8.3's empty storm, carried through to the reducer: a screen that ends,
    // not a loop waiting for a letter that will never spawn.
    const state = runOf([]);
    expect(state.ending).toEqual({ kind: "cleared" });
    expect(tick(state, 10_000)).toBe(state);
  });
});

describe("repairs are the comeback path", () => {
  /*
   * The script all four of these run, so that the only thing that changes is
   * `repairAt`: `f` lands and takes the left index finger's only point, two
   * letters are shot cleanly, and then a second `f` lands on the zone that is
   * either a hole or has just been mended.
   */
  const script = (over: Partial<WaveSpec>) => {
    const letters = [
      at("f", 0, 100),
      at("j", 200, 200),
      at("k", 500, 200),
      at("f", 800, 100),
    ];
    let state = runOf(letters, { shield: 1, ...over });
    state = fire(to(state, 300), "KeyJ");
    state = fire(to(state, 600), "KeyK");
    return state;
  };

  it("mends the weakest zone every repairAt hits, and it stops one", () => {
    const mended = script({ repairAt: 2 });
    expect(mended.combo, "two clean hits").toBe(2);
    expect(mended.shield["l-index"], "the hole is a wall again").toBe(1);

    const after = to(mended, 900);
    expect(after.ending, "the second f is stopped, not fatal").toEqual({
      kind: "cleared",
    });
    expect(after.shield["l-index"], "and costs the mended point").toBe(0);
  });

  it("does not repair at all when repairAt is 0", () => {
    const unmended = script({ repairAt: 0 });
    expect(unmended.combo).toBe(2);
    expect(unmended.shield["l-index"], "still a hole").toBe(0);

    const after = to(unmended, 900);
    expect(after.ending, "and the same letter now ends the run").toEqual({
      kind: "breached",
      finger: "l-index",
      index: 3,
    });
  });

  it("needs the hits to be consecutive", () => {
    // A miss between them breaks the streak, so the repair never arrives —
    // which is what makes the comeback a reward for typing well rather than
    // for surviving long enough.
    const letters = [at("f", 0, 100), at("j", 200, 200), at("k", 500, 200)];
    let state = runOf(letters, { shield: 1, repairAt: 2 });
    state = fire(to(state, 300), "KeyJ");
    state = fire(state, "KeyZ");
    state = fire(to(state, 600), "KeyK");

    expect(state.combo, "the streak restarted").toBe(1);
    expect(state.shield["l-index"], "no repair").toBe(0);
  });

  it("mends the weakest zone, not the first one it finds", () => {
    // Every other case here damages exactly one zone, which makes "weakest",
    // "last damaged" and "first not full" the same answer — so none of them
    // pins the rule §8.5 actually states. Here two zones are damaged unequally
    // and the weaker one is *later* in `SHIELD_FINGERS`: `a` takes one point
    // off the left pinky, two `f`s take both points off the left index, and
    // the clean shot on `j` offers a single repair. It has to go to the hole.
    const letters = [
      at("a", 0, 100),
      at("f", 100, 100),
      at("f", 200, 100),
      at("j", 400, 200),
    ];
    let state = to(runOf(letters, { shield: 2, repairAt: 1 }), 300);
    expect(state.shield["l-pinky"], "grazed").toBe(1);
    expect(state.shield["l-index"], "a hole").toBe(0);

    state = fire(to(state, 500), "KeyJ");
    expect(state.shield["l-index"], "the hole is mended").toBe(1);
    expect(state.shield["l-pinky"], "and the grazed zone is left alone").toBe(
      1,
    );
  });

  it("gives two equally weak zones to the earlier one on the board", () => {
    // Nothing about the shield makes one of them the better answer, so the
    // rule is the drawing order: the segment that lights up is one a child
    // could in principle have predicted, and a replay mends the same one.
    const letters = [at("f", 0, 100), at("j", 100, 100), at("k", 300, 200)];
    let state = to(runOf(letters, { shield: 2, repairAt: 1 }), 400);
    expect(state.shield["l-index"], "both zones down one").toBe(1);
    expect(state.shield["r-index"]).toBe(1);

    state = fire(state, "KeyK");
    expect(state.shield["l-index"], "the earlier of the two is mended").toBe(2);
    expect(state.shield["r-index"], "the later one waits its turn").toBe(1);
  });

  it("repairs to exactly the cap and no further", () => {
    // A wave whose repairs outran its damage would hand a strong player a
    // shield deeper than the level ever wrote down — and "untouched" would
    // stop meaning the eight-of-`shield` the run started with.
    const letters = [
      at("f", 0, 100),
      ...["j", "k", "l", ";", "d", "s"].map((ch, i) =>
        at(ch, 200 + i * 300, 200),
      ),
    ];
    let state = runOf(letters, { shield: 2, repairAt: 1 });
    state = to(state, 100);
    expect(state.shield["l-index"], "one point of damage").toBe(1);

    for (let i = 1; i < letters.length; i++)
      state = fire(to(state, letters[i].spawnMs + 100), letters[i].code);

    expect(state.combo, "six clean hits, six repairs offered").toBe(6);
    expect(state.shield["l-index"], "mended to the cap on the first").toBe(2);
    expect(state.shield, "and no zone anywhere above it").toEqual(
      evenShield(2),
    );
  });
});

describe("the rules are pure, and they do not mutate what they are given", () => {
  /** The script both tests below run: two hits, a miss, and a landing. */
  const play = () => {
    const letters = [at("f", 0, 1000), at("j", 300, 1000), at("k", 600, 400)];
    let state = runOf(letters, { shield: 2, repairAt: 3 });
    state = fire(to(state, 400), "KeyF");
    state = fire(to(state, 700), "KeyJ");
    state = fire(state, "KeyZ");
    return to(state, 1200);
  };

  it("reads no clock, no DOM and no randomness", () => {
    // The engine's lint boundary bans *imports* of React and the services
    // layer, but nothing in it catches a bare `document` or a
    // `requestAnimationFrame` — so the boundary cannot prove this and a test
    // has to. Each global is made hostile for the length of one run: a reducer
    // that so much as reads one throws here, in a millisecond, rather than
    // three stories from now inside a game loop at 60fps.
    const boom = () => {
      throw new Error("the storm reducer must be pure");
    };
    const hostile = [
      "document",
      "window",
      "requestAnimationFrame",
      "performance",
      "Date",
    ];
    const saved = hostile.map(
      (name) =>
        [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
    );
    const realRandom = Math.random;

    let state: StormState | null = null;
    let thrown: unknown = null;
    try {
      for (const name of hostile)
        Object.defineProperty(globalThis, name, {
          configurable: true,
          get: boom,
        });
      Math.random = boom;
      state = play();
    } catch (error) {
      thrown = error;
    } finally {
      Math.random = realRandom;
      for (const [name, descriptor] of saved)
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as Record<string, unknown>)[name];
    }

    expect(thrown).toBeNull();
    expect(state?.resolved.map((r) => r?.outcome)).toEqual([
      "shot",
      "shot",
      "landed",
    ]);
  });

  it("returns new state rather than editing the state it was handed", () => {
    // A reducer that mutated would pass every other test in this file — the
    // returned state would be right, and only the caller holding the old one
    // would ever find out. Freezing turns that into a throw.
    //
    // Every state the run passes through is frozen, not only the one it starts
    // from, because `tick` copies the shield exactly when a letter landed. A
    // repair that wrote through the shield it was handed would hide behind
    // that copy for the whole of a run that only ever fires after a landing —
    // so the fire that repairs, below, is given a shield an earlier state is
    // still holding.
    const deepFreeze = <T>(value: T): T => {
      if (value && typeof value === "object") {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
      }
      return value;
    };
    const tickTo = (state: StormState, ms: number) => deepFreeze(to(state, ms));
    const shoot = (state: StormState, code: string) =>
      deepFreeze(fire(state, code));

    const start = deepFreeze(
      runOf([at("f", 0, 100), at("j", 200, 400), at("k", 700, 300)], {
        shield: 2,
        repairAt: 1,
      }),
    );

    const damaged = tickTo(start, 100);
    expect(damaged.shield["l-index"], "the f got through").toBe(1);

    // Nothing lands between 100 and 300, so this tick hands `damaged`'s own
    // shield straight on — and the hit on `j` repairs at `repairAt: 1`.
    const mended = shoot(tickTo(damaged, 300), "KeyJ");
    expect(mended.resolved[1]?.outcome, "a hit").toBe("shot");
    expect(mended.shield["l-index"], "and the repair path ran").toBe(2);

    const missed = shoot(mended, "KeyZ");
    const ended = tickTo(missed, 1000);
    expect(ended.resolved.map((r) => r?.outcome)).toEqual([
      "landed",
      "shot",
      "landed",
    ]);

    expect(start.timeMs, "the state we started from is untouched").toBe(0);
    expect(start.resolved).toEqual([null, null, null]);
    expect(start.combo).toBe(0);
    expect(start.shield).toEqual(evenShield(2));
    expect(start.ending).toBeNull();

    expect(damaged.shield["l-index"], "and so is the damaged one").toBe(1);
    expect(damaged.resolved[1], "which never saw the shot").toBeNull();
    expect(mended.combo, "and the miss did not reach back into it").toBe(1);

    // And the whole run again from the frozen start, which must come out the
    // same: a reducer that mutated its input would have spent it.
    const again = to(fire(fire(to(to(start, 100), 300), "KeyJ"), "KeyZ"), 1000);
    expect(again).toEqual(ended);
  });
});

/* ═══ What a run came to (§8.5, STM07) ═══════════════════════════════════════
 *
 * The ending screen is a rendering of these four answers and nothing else, so
 * this is where "your right ring finger let three through" is decided to be
 * true. Every one of them is a question about a run that has stopped, which is
 * a state a test can write down and a browser can only be waited for.
 */

describe("the per-zone tally the ending is named from", () => {
  it("counts what landed on each zone, and nothing that was shot", () => {
    const letters = [at("f", 0, 100), at("j", 0, 200), at("f", 300, 100)];
    const state = fire(to(runOf(letters, { shield: 3 }), 350), "KeyF");

    expect(state.resolved.map((r) => r?.outcome)).toEqual([
      "landed",
      "landed",
      "shot",
    ]);
    expect(zoneTally(state)["l-index"].hit, "the f that landed").toBe(1);
    expect(zoneTally(state)["r-index"].hit).toBe(1);
    expect(
      SHIELD_FINGERS.reduce((sum, f) => sum + zoneTally(state)[f].hit, 0),
    ).toBe(2);
  });

  it("counts the letter that ended the run, hole and all", () => {
    const dead = to(
      runOf([at("f", 0, 100), at("f", 200, 100)], { shield: 1 }),
      400,
    );
    expect(dead.ending?.kind).toBe("breached");
    // Two got past this finger: one the shield paid for, and one it could not.
    // The fatal letter is the story, not an exception to it.
    expect(zoneTally(dead)["l-index"]).toEqual({ hit: 2, mend: 0 });
  });

  it("counts `resolved`, and never the clock", () => {
    /*
     * The case `tick` leaves behind, and the reason this is a tally over
     * outcomes rather than a filter on `hasLanded`.
     *
     * The run ends at 300ms on `l-index`, and the clock stops THERE rather
     * than at the end of the tick. A letter from a higher index landing on
     * that same millisecond is left unresolved — but `hasLanded(letter, 300)`
     * reads true of it, because 300 is exactly its `landMs`. A screen that
     * counted the clock would report a letter through a zone the storm never
     * reached, on the one screen where the number is the whole point.
     */
    const letters = [at("f", 0, 100), at("f", 100, 200), at("j", 0, 300)];
    const dead = tick(runOf(letters, { shield: 1 }), 60_000);

    expect(dead.ending).toEqual({
      kind: "breached",
      finger: "l-index",
      index: 1,
    });
    expect(dead.timeMs).toBe(300);
    expect(hasLanded(letters[2], dead.timeMs), "by the clock, it landed").toBe(
      true,
    );
    expect(dead.resolved[2], "by the run, it never did").toBeNull();
    expect(zoneTally(dead)["r-index"].hit, "so nothing got through it").toBe(0);
    expect(stormReport(dead)?.through, "two got through, not three").toBe(2);
  });
});

describe("the keys a zone covers", () => {
  const POOL = [...unlockedAt(39)];

  it("is every character of the wave's own pool that finger types", () => {
    const wave = buildWave(spec({ keys: POOL }), 7);

    for (const finger of SHIELD_FINGERS) {
      const keys = zoneKeys(wave, finger);
      // Every key is that finger's…
      expect(keys.every((ch) => strokeFor(ch)?.finger === finger)).toBe(true);
      // …and every one of that finger's in the pool is there.
      expect(keys).toEqual(
        POOL.filter((ch) => strokeFor(ch)?.finger === finger),
      );
    }

    // Between them the eight cover the whole pool but for the space bar, which
    // is the thumb's and has no zone to break (§8.5).
    const all = SHIELD_FINGERS.flatMap((finger) => zoneKeys(wave, finger));
    expect(new Set(all).size, "no character in two zones").toBe(all.length);
    expect(all.sort().join("")).toBe(
      POOL.filter((ch) => strokeFor(ch)?.finger !== "thumb")
        .sort()
        .join(""),
    );
  });

  it("drops a repeat, and a character this board cannot type", () => {
    // A pool may weight a character by listing it twice (`WaveSpec.keys`), and
    // may carry one the layout has no key for — a wave drops both silently, so
    // a drill built off the same pool has to as well or it would ask a child
    // for a curly quote.
    const wave = buildWave(spec({ keys: ["f", "f", "“", "v", " "] }), 3);
    expect(zoneKeys(wave, "l-index")).toEqual(["f", "v"]);
  });

  it("always has something in it for the finger that just breached", () => {
    // The letter that got through came out of this pool wearing this finger,
    // so the drill offered at the worst moment can never be an empty deck.
    const wave = buildWave(spec({ keys: POOL, count: 40, shield: 1 }), 42);
    const dead = tick(startStorm(wave), 600_000);

    expect(dead.ending?.kind).toBe("breached");
    const report = stormReport(dead);
    expect(report?.breach?.keys.length).toBeGreaterThan(0);
    expect(report?.breach?.keys).toContain(
      wave.letters[(dead.ending as { index: number }).index].ch,
    );
  });
});

describe("the report the ending screen reads", () => {
  it("is nothing at all while the run is live", () => {
    const running = to(runOf([at("f", 0, 1000)], { shield: 3 }), 400);
    expect(running.ending).toBeNull();
    expect(stormReport(running)).toBeNull();
  });

  it("names the finger that let it through, and how many it let through", () => {
    // The acceptance criterion, in one assertion: "your left index finger let
    // three through" is these two fields and nothing else.
    const letters = [
      at("f", 0, 100),
      at("j", 100, 100),
      at("v", 200, 100),
      at("f", 300, 100),
    ];
    const dead = tick(runOf(letters, { shield: 2 }), 60_000);
    const report = stormReport(dead);

    expect(report?.ending).toEqual({
      kind: "breached",
      finger: "l-index",
      index: 3,
    });
    expect(report?.breach?.finger).toBe("l-index");
    expect(report?.breach?.through, "f, v and f again").toBe(3);
    expect(report?.through, "the j as well").toBe(4);
    // Sixteen points of shield, three of them spent — the fatal letter took
    // nothing, because there was nothing left in that zone to take.
    expect(report?.shieldFull).toBe(16);
    expect(report?.shieldLeft).toBe(13);
  });

  it("has no breach, and a shield, on a wave that was cleared", () => {
    const letters = [at("f", 0, 1000), at("j", 400, 1000)];
    const cleared = fire(
      to(fire(to(runOf(letters, { shield: 3 }), 100), "KeyF"), 500),
      "KeyJ",
    );
    const report = stormReport(cleared);

    expect(report?.ending).toEqual({ kind: "cleared" });
    expect(report?.breach).toBeNull();
    expect(report?.through, "nothing got past at all").toBe(0);
    expect(report?.shieldLeft).toBe(report?.shieldFull);
    expect(report?.bestCombo).toBe(2);
  });

  it("reports a shield that was hit and mended as hit, not as whole", () => {
    // `shieldLeft` alone cannot tell "nothing ever landed" from "one landed
    // and a repair put it back", and the two are not the same run.
    const letters = [at("f", 0, 100), at("j", 200, 1000)];
    const mended = fire(
      to(runOf(letters, { shield: 2, repairAt: 1 }), 300),
      "KeyJ",
    );
    const report = stormReport(tick(mended, 60_000));

    expect(report?.shieldLeft, "the repair filled it back up").toBe(
      report?.shieldFull,
    );
    expect(report?.through, "and one still got through").toBe(1);
  });

  it("remembers the longest streak, not the one it ended on", () => {
    const letters = [
      at("f", 0, 4000),
      at("j", 100, 4000),
      at("k", 200, 4000),
      at("d", 300, 4000),
    ];
    let state = to(runOf(letters, { shield: 3 }), 400);
    for (const code of ["KeyF", "KeyJ", "KeyK"]) state = fire(state, code);
    expect(state.combo).toBe(3);

    // A wrong key takes the streak back to nothing, and the last letter goes
    // in on a streak of one — but three in a row happened, and that is what a
    // child is being told about.
    state = fire(fire(state, "KeyZ"), "KeyD");
    expect(state.combo).toBe(1);
    expect(stormReport(state)?.bestCombo).toBe(3);
  });

  it("pays a run that never hit anything a best combo of nothing", () => {
    const dead = to(runOf([at("f", 0, 100)], { shield: 0 }), 100);
    expect(stormReport(dead)?.bestCombo).toBe(0);
    expect(stormXp(dead), "and no XP either").toBe(0);
  });
});

describe("the drill a hole earns", () => {
  it("is exactly that zone's keys, through the door every drill uses", () => {
    /*
     * The composition `StormOver` makes, pinned where the rules are: a zone's
     * keys are fact ids, `buildDrill` routes them on the mode the run files
     * under, and what comes back is a typing config carrying those characters
     * and nothing else. Same call the record book makes for the facts a child
     * keeps missing (§8.5) — the question is different, the machinery is not.
     */
    const wave = buildWave(spec({ keys: [...unlockedAt(39)], shield: 1 }), 42);
    const dead = tick(startStorm(wave), 600_000);
    const keys = stormReport(dead)!.breach!.keys;

    const drill = buildDrill(keys, typingMode("L39"), {
      inputMode: "type",
      timeLimitMs: null,
    });

    expect(isTyping(drill) && drill.words).toEqual(keys);
    // A passage long enough to be worth running, built out of nothing but
    // those keys — the deck layer's rule, and this is what it comes to.
    expect(isTyping(drill) && drill.wordCount).toBeGreaterThanOrEqual(10);
    const cards = buildDeck(drill, 1);
    expect(cards.length).toBe(isTyping(drill) ? drill.wordCount : 0);
    expect([...new Set(cards.map((card) => card.answer))].sort()).toEqual(
      [...keys].sort(),
    );
  });
});
