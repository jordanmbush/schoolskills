import { describe, expect, it } from "vitest";

import { keyX, strokeFor } from "@/engine/keyboard";
import { unlockedAt } from "./keys";
import {
  SHIELD_FINGERS,
  buildWave,
  fire,
  hasLanded,
  isAirborne,
  progressAt,
  startStorm,
  targetIndex,
  tick,
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

/** The specs whose `gap` clears their `fall` — the levels that are pure reaction. */
const REACTION = SPECS.filter(([, s]) => s.gap[0] >= s.fall[1]);

/** The specs whose ranges overlap — the levels that stack letters up. */
const STACKING = SPECS.filter(([, s]) => s.gap[1] < s.fall[0]);

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
    const s = spec({ keys: HOME, count: 40, gap: [10, 12], fall: [5, 7] });
    const gaps = new Set<number>();
    const falls = new Set<number>();
    for (const seed of SEEDS) {
      const wave = buildWave(s, seed);
      for (const gap of gapsOf(wave)) gaps.add(gap);
      for (const letter of wave.letters) falls.add(letter.fallMs);
    }
    expect([...gaps].sort()).toEqual([10, 11, 12]);
    expect([...falls].sort()).toEqual([5, 6, 7]);
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

    const overtaking = spec({ count: 20, gap: [10, 10], fall: [100, 2000] });
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
        s.fall[1],
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
    expect(state.resolved[0]).toEqual({ outcome: "shot", atMs: 500 });
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

describe("what lands takes the shield apart", () => {
  it("takes a point off the zone above it and no others", () => {
    const state = to(runOf([at("f", 0, 100)], { shield: 3 }), 100);
    expect(state.resolved[0]).toEqual({ outcome: "landed", atMs: 100 });
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
      { outcome: "landed", atMs: 300 },
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
    expect(state.resolved[0]).toEqual({ outcome: "landed", atMs: 100 });
    expect(state.resolved[1], "each is timed by its own landing").toEqual({
      outcome: "landed",
      atMs: 200,
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
    // would ever find out. Freezing the input turns that into a throw.
    const deepFreeze = <T>(value: T): T => {
      if (value && typeof value === "object") {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
      }
      return value;
    };

    const start = deepFreeze(
      runOf([at("f", 0, 1000), at("j", 300, 1000)], { shield: 2, repairAt: 2 }),
    );
    const fired = fire(to(start, 400), "KeyF");
    const ticked = to(fired, 1400);

    expect(fired.resolved[0]?.outcome).toBe("shot");
    expect(ticked.shield["r-index"], "the second letter got through").toBe(1);

    expect(start.timeMs, "the state we started from is untouched").toBe(0);
    expect(start.resolved).toEqual([null, null]);
    expect(start.combo).toBe(0);
    expect(start.shield).toEqual(evenShield(2));
    expect(start.ending).toBeNull();

    // And the whole run again from the frozen start, which must come out the
    // same: a reducer that mutated its input would have spent it.
    expect(to(fire(to(start, 400), "KeyF"), 1400)).toEqual(ticked);
  });
});
