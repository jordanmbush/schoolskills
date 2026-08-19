import { describe, expect, it } from "vitest";

import { keyX, strokeFor } from "@/engine/keyboard";
import { unlockedAt } from "./keys";
import { buildWave } from "./storm";
import type { Wave, WaveSpec } from "./storm";

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
 * A letter occupies the field on the half-open interval `[spawnMs, landMs)` —
 * present the instant it spawns, gone the instant it lands, because landing is
 * the tick that resolves it into shield damage. That is why departures are
 * processed before arrivals at an equal timestamp: a letter landing on the same
 * millisecond as the next one spawns is a handover, not an overlap.
 */
const maxOnScreen = (wave: Wave): number => {
  const events = wave.letters.flatMap((l) => [
    { at: l.spawnMs, delta: 1 },
    { at: l.landMs, delta: -1 },
  ]);
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);

  let live = 0;
  let most = 0;
  for (const event of events) {
    live += event.delta;
    most = Math.max(most, live);
  }
  return most;
};

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
