import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { strokeFor } from "@/engine/keyboard";
import { unlockedAt } from "./keys";
import { LESSONS } from "./lessons";
import {
  MIN_FALL_MS,
  buildWave,
  fallRange,
  isAirborne,
  isFalling,
  startStorm,
  type ShieldFinger,
  type Wave,
  type WaveSpec,
} from "./storm";
import {
  STORM_LESSONS,
  isStormLesson,
  stormPool,
  stormWave,
  waveSpecFor,
  type StormLesson,
} from "./storms";

/**
 * The twenty Hailstorm levels (docs/typing.md §5.6, §8.1, §8.3, §8.10).
 *
 * Three kinds of claim live here and they are worth separating before reading
 * any of them:
 *
 *   - **Reachability**, which is the one a child would meet. A storm may only
 *     rain keys the ladder has taught by its own rung — the same invariant
 *     §5.2 holds the generated passages to, asked of the waves.
 *   - **Safety**, which nobody would ever meet as a bug report. §8.10's "no
 *     strobe, ever, in any mode" is a promise about how often one shield zone
 *     can light up, and #155 established by measurement that no floor on `gap`
 *     buys it — two letters spawned a second apart can land together, because
 *     `fall` is a range too. So the rule is a **count of tint starts per zone
 *     per second, read off the built schedule**, and this is where the twenty
 *     specs meet it.
 *   - **Shape**, which is what makes twenty levels a ladder rather than twenty
 *     copies: one letter at a time at the bottom, five or more in the air at
 *     the top, repairs that stop, and a shield that thins.
 */

/**
 * A sample of the space a spec can draw from, and honestly no more than that.
 *
 * The same spread `storm.test.ts` and `generate.test.ts` use. What it is for
 * differs by claim, and the difference is worth stating once here rather than
 * being inferred at each assertion below:
 *
 *   - **Reachability** really is universal over seeds — a wave can only ever
 *     draw from `stormPool`, whatever the roll — so asking it at sixteen is
 *     asking it of the generator, and a seventeenth would only be slower.
 *   - **The tint rate is not.** A `WaveSpec` is a pair of *ranges*, so it is a
 *     built wave and not a spec that is safe or unsafe, and sixteen seeds are
 *     sixteen measurements rather than a bound. Swept far more widely, four of
 *     the twenty specs (83, 89, 93, 99) do reach four or five starts a second
 *     at seeds nobody is ever served. What makes the shipped twenty safe is
 *     that a level's seed is derived to keep the rule and frozen (decision 58,
 *     re-derived in "each level's seed" below), not that the specs cannot roll
 *     a bad wave.
 */
const SEEDS = [
  0, 1, 2, 7, 42, 99, 128, 1000, 4242, 65535, 123456, 999983, 2147483647,
  16777216, 31337, 8675309,
];

/** The rungs §5.6 gives a storm, transcribed from the doc rather than derived. */
const RUNGS = [
  4, 9, 13, 19, 23, 29, 34, 39, 45, 49, 53, 59, 65, 69, 73, 79, 83, 89, 93, 99,
];

/** Every wave the twenty ship with — the storms a child actually meets. */
const SHIPPED: [name: string, lesson: StormLesson, wave: Wave][] =
  STORM_LESSONS.map((lesson) => [lesson.title, lesson, stormWave(lesson)]);

/** Every spec, crossed with the sweep of seeds. */
const SAMPLED: [name: string, spec: WaveSpec, wave: Wave][] =
  STORM_LESSONS.flatMap((lesson) => {
    const spec = waveSpecFor(lesson);
    return SEEDS.map((seed): [string, WaveSpec, Wave] => [
      `${lesson.id} @ ${seed}`,
      spec,
      buildWave(spec, seed),
    ]);
  });

/**
 * When each zone lights up, in ms: one entry per letter that lands on it.
 *
 * Read off the **built schedule** and not off the spec, which is the whole
 * point (§8.10, `fallRange`). A zone tints when a letter *lands* on the finger
 * above it, and a landing is `spawnMs + fallMs` — two draws, not one — so a
 * question about how often a zone lights can only be answered after the wave
 * exists.
 *
 * Every letter counts, because a run in which nothing is shot is the worst
 * case and the one a child who cannot keep up is actually having. A letter
 * that IS shot never lands and never tints.
 */
function tintsByZone(wave: Wave): Map<ShieldFinger, number[]> {
  const zones = new Map<ShieldFinger, number[]>();
  for (const letter of wave.letters) {
    const at = zones.get(letter.finger) ?? [];
    at.push(letter.landMs);
    zones.set(letter.finger, at);
  }
  for (const at of zones.values()) at.sort((a, b) => a - b);
  return zones;
}

/**
 * The most tints one zone starts inside any one-second window.
 *
 * A sliding window anchored at each landing, which is where every window's
 * maximum sits: moving the window's start off a landing can only drop letters
 * from the front.
 *
 * Deliberately an over-count. §8.10 measured the tint's own curve — 40% of
 * peak gone by 20ms, 90% by 50ms — so two landings within ~20ms of each other
 * re-peak one lit tint and are one visible episode rather than two flashes.
 * Counting them separately errs towards the strobe, which is the direction to
 * be wrong in.
 */
function peakTintRate(wave: Wave, windowMs = 1000): number {
  let peak = 0;
  for (const at of tintsByZone(wave).values())
    for (let i = 0; i < at.length; i++) {
      let inside = 0;
      for (let j = i; j < at.length && at[j] - at[i] < windowMs; j++) inside++;
      peak = Math.max(peak, inside);
    }
  return peak;
}

/** The most zones that light within one tint's life of each other. */
function peakZonesLit(wave: Wave, windowMs = 150): number {
  const landings = wave.letters
    .map((letter) => ({ at: letter.landMs, finger: letter.finger }))
    .sort((a, b) => a.at - b.at);

  let peak = 0;
  for (let i = 0; i < landings.length; i++) {
    const lit = new Set<ShieldFinger>();
    for (
      let j = i;
      j < landings.length && landings[j].at - landings[i].at < windowMs;
      j++
    )
      lit.add(landings[j].finger);
    peak = Math.max(peak, lit.size);
  }
  return peak;
}

/**
 * The most letters *coming down* at once.
 *
 * The count only ever rises when a letter starts to drop, so asking
 * `isFalling` at every drop instant finds the maximum without sweeping the
 * clock — and it asks the engine's own half-open interval rather than
 * restating it (§8.3).
 *
 * Falling and not merely drawn, because that is the claim the early levels
 * make. Every letter hangs at the top for the same beat before it moves
 * (`QUEUE_MS`), so a reaction level shows one letter coming down with the next
 * queued above it — which is a queue, not a second thing to track. `maxOnField`
 * is the other count, and the pair of them is what says so.
 */
const maxFalling = (wave: Wave): number =>
  Math.max(
    0,
    ...wave.letters.map(
      (letter) =>
        wave.letters.filter((other) => isFalling(other, letter.dropMs)).length,
    ),
  );

/** The most letters drawn at once — queued and falling together. */
const maxOnField = (wave: Wave): number =>
  Math.max(
    0,
    ...wave.letters.map(
      (letter) =>
        wave.letters.filter((other) => isAirborne(other, letter.spawnMs))
          .length,
    ),
  );

/** How many letters land on the busiest zone. */
const busiestZone = (wave: Wave): number =>
  Math.max(0, ...[...tintsByZone(wave).values()].map((at) => at.length));

/** The four groups of five the ladder walks through, in order. */
const QUARTERS = [0, 5, 10, 15].map((from) => SHIPPED.slice(from, from + 5));

/** Letters a second, which is what a `gap` range means for the run as a whole. */
const density = (spec: WaveSpec) => 2000 / (spec.gap[0] + spec.gap[1]);

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

describe("the twenty levels", () => {
  /**
   * **§5.7 is checked, not trusted.**
   *
   * "The design doc and the shipped specs agree" is an acceptance criterion of
   * this story and it is the kind that rots in a week — twenty rows of numbers
   * in prose, beside twenty rows of numbers in code, with nothing between them
   * but somebody's diligence. So the doc's own table is read off disk and
   * compared column by column, exactly as `StormField.test.tsx` reads
   * `game.css` rather than restating its arithmetic.
   *
   * The doc is the source being checked and not the other way round: if these
   * ever part company, one of them is wrong and this says which two cells to
   * look at.
   */
  it("matches §5.7's table in docs/typing.md, column by column", () => {
    const doc = readFileSync("docs/typing.md", "utf8");
    // §5.7 alone: from its heading to the next one, so the twenty rows read
    // here cannot quietly become §6's tables the day a section is added.
    const table = doc.split("### 5.7 · The twenty storms")[1].split("\n## ")[0];
    const rows = [...table.matchAll(/^\|\s*(\d+)\s*\|(.+)\|\s*$/gm)].map(
      (match) => [
        Number(match[1]),
        ...match[2].split("|").map((cell) => cell.trim()),
      ],
    );
    expect(rows).toHaveLength(20);

    const printed = ([n, title, len, gap, fall, shield, mends, rains, seed]: (
      string | number
    )[]) => ({
      n,
      title,
      len: Number(len),
      gap: String(gap).split("–").map(Number),
      fall: String(fall).split("–").map(Number),
      shield: Number(shield),
      repairAt: mends === "—" ? 0 : Number(mends),
      focus: rains === "—" ? undefined : rains,
      seed: Number(seed),
    });

    expect(rows.map(printed)).toEqual(
      STORM_LESSONS.map((lesson) => ({
        n: lesson.n,
        // The doc's table drops the "Hailstorm · " every one of the twenty
        // carries in §5.6, because the table it is in is only storms.
        title: lesson.title.replace("Hailstorm · ", ""),
        len: lesson.kind.wave.count,
        gap: lesson.kind.wave.gap,
        fall: lesson.kind.wave.fall,
        shield: lesson.kind.wave.shield,
        repairAt: lesson.kind.wave.repairAt,
        focus: lesson.kind.wave.focus,
        seed: lesson.kind.wave.seed,
      })),
    );
  });

  it("sits on the rungs §5.6 names, and on no others", () => {
    expect(STORM_LESSONS.map((lesson) => lesson.n)).toEqual(RUNGS);
    expect(LESSONS.filter(isStormLesson)).toHaveLength(20);
  });

  it("gives every one of them a wave with letters in it", () => {
    // A `count` of 0 is not an empty level, it is a screen that ends on the
    // frame it opens: `startStorm` stamps `cleared` on a wave with nothing in
    // it (§8.3), and the route would write a 0-card session and show the
    // ending panel before a child had touched a key.
    for (const [name, lesson, wave] of SHIPPED) {
      expect(lesson.kind.wave.count, name).toBeGreaterThan(0);
      expect(wave.letters.length, name).toBe(lesson.kind.wave.count);
      expect(startStorm(wave).ending, name).toBeNull();
    }
  });

  it("makes the rung's `wordCount` its wave's length", () => {
    // The join §8.7 rests on three times over: `survived` is
    // `cards.length >= wordCount`, the `unbroken` badge is guarded on the wave
    // having a length (decision 29), and `lessonKey` is `typing|L39|28`, which
    // is what puts a storm and its rung in one bucket.
    for (const [name, lesson] of SHIPPED)
      expect(lesson.wordCount, name).toBe(lesson.kind.wave.count);
  });
});

describe("a storm can only rain what the ladder has taught", () => {
  /**
   * **The acceptance criterion, and the same guarantee §5.2 gives the
   * passages.** A child at lesson 13 has met fifteen characters, and a wave
   * that dropped a `9` on them would be asking for a key nobody has shown them
   * — unshootable, and unfair in the one mode where a letter you cannot find
   * costs you a shield point.
   *
   * It is checked over the pool rather than over a built wave because the pool
   * is the stronger statement: a wave is a sample of it, and a seed that
   * happened not to draw the bad key would hide the fault until a re-tune.
   */
  it("draws every key from `unlockedAt(n)`", () => {
    for (const lesson of STORM_LESSONS) {
      const unlocked = unlockedAt(lesson.n);
      for (const key of stormPool(lesson))
        expect(unlocked.has(key), `${lesson.id}: ${JSON.stringify(key)}`).toBe(
          true,
        );
    }
  });

  it("and every letter that actually falls is one of them", () => {
    // The same claim one layer down, over every seed: `buildWave` filters the
    // pool (a thumb's key, a character this board cannot produce) and must
    // never add to it.
    for (const [name, , wave] of SAMPLED) {
      const lesson = STORM_LESSONS.find(
        (l) => l.id === name.slice(0, name.indexOf(" ")),
      )!;
      const unlocked = unlockedAt(lesson.n);
      for (const letter of wave.letters) {
        expect(unlocked.has(letter.ch), `${name}: ${letter.ch}`).toBe(true);
        expect(strokeFor(letter.ch), `${name}: ${letter.ch}`).not.toBeNull();
        expect(letter.finger, `${name}: ${letter.ch}`).not.toBe("thumb");
      }
    }
  });

  it("rains what its title says, without ever replacing the rest", () => {
    // A focused level is about half its own focus (`storms.ts`), which is what
    // makes "Hailstorm · Digits" a level about the number row at lesson 53 —
    // where only `3 4 5 6` have arrived, so a fixed multiplier would have put
    // one digit in six on screen and called it a title.
    const focused = STORM_LESSONS.filter((lesson) => lesson.kind.wave.focus);
    expect(focused.map((lesson) => lesson.n)).toEqual([34, 39, 53, 59, 65, 69]);

    for (const lesson of focused) {
      const alphabet = [...unlockedAt(lesson.n)];
      const pool = stormPool(lesson);
      const extra = pool.length - alphabet.length;
      expect(extra, `${lesson.id} weights nothing`).toBeGreaterThan(0);
      // Between a third and two thirds of what can fall: enough to be the
      // level's subject, never so much that the rest of the alphabet stops.
      const share = extra / pool.length;
      expect(share, `${lesson.id} share`).toBeGreaterThan(0.3);
      expect(share, `${lesson.id} share`).toBeLessThan(0.7);
    }

    // And a level with no focus is exactly its rung's alphabet, in one copy.
    for (const lesson of STORM_LESSONS.filter((l) => !l.kind.wave.focus))
      expect(stormPool(lesson).length, lesson.id).toBe(
        unlockedAt(lesson.n).size,
      );
  });
});

describe("no zone can strobe", () => {
  /**
   * **WCAG 2.3.1's own line: more than three flashes in any one second.**
   *
   * The unit is one shield zone, because that is the thing that lights: a
   * `.storm__hit` tint is mounted per landing on one segment (§8.10, decision
   * 42), and eight segments taking one letter each in a second is eight small
   * patches lighting in turn rather than a flash. A zone taking four is the
   * failure.
   *
   * Three is the standard's line and not a preference — but it is asserted
   * here over a *sample* of sixteen seeds per spec, which is a measurement and
   * not a property of the specs (see `SEEDS`). The claim that carries a child
   * is the next one down: `SHIPPED` is held to two, at the seed each level
   * freezes, and "each level's seed" re-derives that seed from the rule rather
   * than reading it off the table.
   */
  const MAX_TINTS_PER_ZONE_PER_SECOND = 3;

  /**
   * And what the shipped twenty are actually at.
   *
   * The seed on each row is derived to keep it (decision 58, re-derived
   * below), so this is not a hope about a draw: it is the wave that is served,
   * and the one claim here that is a guarantee rather than a sample.
   */
  const SHIPPED_MAX = 2;

  it("holds every spec under the line, at the sixteen seeds sampled", () => {
    for (const [name, , wave] of SAMPLED)
      expect(peakTintRate(wave), name).toBeLessThanOrEqual(
        MAX_TINTS_PER_ZONE_PER_SECOND,
      );
  });

  it("holds the twenty that ship under two", () => {
    for (const [name, , wave] of SHIPPED)
      expect(peakTintRate(wave), name).toBeLessThanOrEqual(SHIPPED_MAX);
  });

  it("never lights more than half the shield at once", () => {
    // The other half of a flash, which is area: eight zones lighting together
    // is a band across the screen, where two is two small patches. §8.10
    // measured the stand-in wave at two of eight; the twenty are held to four,
    // and every seed to five.
    for (const [name, , wave] of SHIPPED)
      expect(peakZonesLit(wave), name).toBeLessThanOrEqual(4);
    for (const [name, , wave] of SAMPLED)
      expect(peakZonesLit(wave), name).toBeLessThanOrEqual(5);
  });

  it("would catch a spec that packed one zone", () => {
    // The measurement, proved on a wave built to fail it: eight letters on one
    // key, 150ms apart, is a zone lighting eight times in just over a second.
    // Without this, "no spec exceeds the bound" could be passing because the
    // function cannot count.
    const packed = buildWave(
      {
        keys: ["f"],
        count: 8,
        gap: [150, 150],
        fall: [MIN_FALL_MS, MIN_FALL_MS],
        shield: 3,
        repairAt: 0,
      },
      1,
    );
    expect(peakTintRate(packed)).toBe(7);
    expect(peakZonesLit(packed)).toBe(1);
  });
});

describe("the ladder's difficulty climbs", () => {
  it("drops one letter at a time until lesson 19, with the next one queued", () => {
    // Pure reaction (§8.3): `gap` clears `fall`, so a letter lands before the
    // next one starts to drop and there is never a second one coming down.
    // Read off the built schedule at every seed rather than off the declared
    // range, because `MIN_FALL_MS` can raise a fall and turn a promise into an
    // overlap.
    for (const [name, lesson, wave] of SHIPPED) {
      if (lesson.n >= 19) continue;
      expect(maxFalling(wave), name).toBe(1);
      for (const seed of SEEDS)
        expect(
          maxFalling(buildWave(waveSpecFor(lesson), seed)),
          `${name} @ ${seed}`,
        ).toBe(1);

      // And what IS beside it is the next letter, waiting its turn. Two on the
      // field where one is falling is the queue (`QUEUE_MS`); a third would
      // mean the beat had grown past the gap these levels are spaced at, and
      // the reaction levels would have quietly become reading-ahead ones.
      expect(maxOnField(wave), name).toBeLessThanOrEqual(2);
    }
  });

  it("stacks them from lesson 19 on, and four deep at the top", () => {
    for (const [name, lesson, wave] of SHIPPED) {
      if (lesson.n < 19) continue;
      expect(maxFalling(wave), name).toBeGreaterThan(1);
      if (lesson.n >= 83) expect(maxFalling(wave), name).toBeGreaterThan(3);
    }
  });

  it("asks for more letters, faster, as it climbs", () => {
    // Quarter by quarter rather than row by row, because the row-to-row curve
    // dips on purpose: lesson 53's storm eases where the number row has just
    // arrived, exactly as the wpm column does (§6.3, decision 11), and lesson
    // 73 is long where 79 is dense. What may never happen is a *stretch* of
    // the ladder that does not climb.
    const counts = QUARTERS.map((quarter) =>
      mean(quarter.map(([, lesson]) => lesson.kind.wave.count)),
    );
    const rates = QUARTERS.map((quarter) =>
      mean(quarter.map(([, lesson]) => density(waveSpecFor(lesson)))),
    );

    for (let i = 1; i < QUARTERS.length; i++) {
      expect(counts[i], `quarter ${i + 1} letters`).toBeGreaterThan(
        counts[i - 1],
      );
      expect(rates[i], `quarter ${i + 1} rate`).toBeGreaterThan(rates[i - 1]);
    }

    // And end to end, which is the sentence a child would say: the last storm
    // is more than three times the first.
    const [, first] = SHIPPED[0];
    const [, last] = SHIPPED[SHIPPED.length - 1];
    expect(last.kind.wave.count).toBeGreaterThan(first.kind.wave.count * 3 - 1);
  });

  it("takes the repairs away at lesson 79 and never gives them back", () => {
    // "No repairs" is the level's name and the block's turn (§5.6). Every
    // storm below it mends the weakest zone every `repairAt` clean hits; from
    // 79 up, what breaks stays broken.
    for (const [name, lesson] of SHIPPED) {
      const { repairAt } = lesson.kind.wave;
      if (lesson.n < 79) expect(repairAt, name).toBeGreaterThan(0);
      else expect(repairAt, name).toBe(0);
    }
  });

  it("never deepens the shield as it climbs", () => {
    const depths = SHIPPED.map(([, lesson]) => lesson.kind.wave.shield);
    for (let i = 1; i < depths.length; i++)
      expect(depths[i]).toBeLessThanOrEqual(depths[i - 1]);
    expect(depths[0]).toBeGreaterThan(depths[depths.length - 1]);
  });

  it("cannot end before its letters do, on the very first storm", () => {
    // "First ice" is the first thing on this ladder that is a game, met at
    // lesson 4 by a child who has four keys and has never seen one. It is the
    // one level whose wave cannot breach: no zone takes more letters than the
    // shield can hold, so a child who presses nothing still sees all twelve
    // and meets a hole rather than an ending.
    const [name, lesson, wave] = SHIPPED[0];
    expect(lesson.n).toBe(4);
    expect(busiestZone(wave), name).toBeLessThanOrEqual(
      lesson.kind.wave.shield,
    );
  });

  it("writes every fall at or above the floor", () => {
    // `MIN_FALL_MS` is a backstop and not a difficulty knob (decision 52): a
    // spec that asked for something faster would come out of `fallRange` as a
    // metronome at the floor, and the level would be quietly not what the row
    // says. So no row asks.
    for (const [name, lesson] of SHIPPED) {
      const spec = waveSpecFor(lesson);
      expect(spec.fall[0], name).toBeGreaterThanOrEqual(MIN_FALL_MS);
      expect(fallRange(spec), name).toEqual(spec.fall);
    }
  });
});

describe("each level's seed", () => {
  /**
   * **The twenty seeds are derived, not chosen** (decision 58).
   *
   * A level is the same weather every time it is opened, so twenty numbers sit
   * in the table — and twenty unexplained numbers would be twenty things
   * nobody could ever safely edit. So the rule is written here and the table
   * is checked against it: **the level's own number, or the first seed above
   * it whose wave keeps the level's promises.** Fourteen of the twenty are the
   * lesson number itself; the other six are within six of it.
   *
   * The promises are the three things this file has already asserted about
   * every shipped wave, which is what makes this a derivation rather than a
   * second opinion: the tint rate under two, at least six of the eight fingers
   * used, and no zone taking more than a third of the letters.
   */
  const keeps = (wave: Wave, spec: WaveSpec) =>
    peakTintRate(wave) <= 2 &&
    tintsByZone(wave).size >= 6 &&
    busiestZone(wave) * 3 <= spec.count;

  it("is the first at or above its own rung that keeps them", () => {
    for (const [name, lesson] of SHIPPED) {
      const spec = waveSpecFor(lesson);
      let first = lesson.n;
      while (!keeps(buildWave(spec, first), spec)) first++;
      expect(lesson.kind.wave.seed, name).toBe(first);
    }
  });

  it("spreads a wave across the hand rather than stuttering on three keys", () => {
    // The property the rule above is made of, stated for itself: a wave that
    // dropped half its letters on one finger would be a level about that
    // finger, and the shield's whole story — which finger let it through — is
    // only worth telling when every finger had a turn.
    for (const [name, , wave] of SHIPPED) {
      expect(tintsByZone(wave).size, name).toBeGreaterThanOrEqual(6);
      expect(busiestZone(wave) * 3, name).toBeLessThanOrEqual(
        wave.letters.length,
      );
    }
  });

  it("is the same storm on every machine and in every session", () => {
    // Decision 58, said as the thing a child would notice: opening lesson 45
    // twice is opening the same level twice. `buildWave` is deterministic in
    // `(spec, seed)` and both halves come off the rung, so this is what makes
    // "I beat Whiteout" a sentence about a thing rather than about a roll.
    for (const [name, lesson, wave] of SHIPPED)
      expect(stormWave(lesson), name).toEqual(wave);
  });
});
