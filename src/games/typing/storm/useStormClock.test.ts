import { describe, expect, it } from "vitest";

import { keyX, strokeFor } from "@/engine/keyboard";
import {
  QUEUE_MS,
  buildWave,
  fire,
  startStorm,
  tick,
} from "@/engine/typing/storm";

import { MAX_STEP_MS, QUIT_KEY, redrawn, stepMs } from "./useStormClock";

import type {
  ShieldFinger,
  StormLetter,
  StormState,
  Wave,
  WaveSpec,
} from "@/engine/typing/storm";

/**
 * The two decisions the clock makes, without a browser to make them in.
 *
 * The loop itself is four lines around `tick` and cannot be interesting in a
 * unit test — what a `requestAnimationFrame` does and when it is cancelled is
 * a question for a real browser, and `e2e/smoke.mjs` counts the outstanding
 * frames there. What IS answerable here is everything the loop decides before
 * it touches the DOM: how long a frame is allowed to be, and when the picture
 * has changed enough to be worth re-rendering.
 */

const spec: WaveSpec = {
  keys: ["f"],
  count: 4,
  gap: [300, 300],
  fall: [1000, 1000],
  shield: 3,
  repairAt: 0,
};

/**
 * The fixture wave at an absolute moment of wave time.
 *
 * Spawns are at 0, 300, 600 and 900 — the queue shifts no spawn (§8.3) — and
 * each letter then hangs for `QUEUE_MS` before falling for a second, so the
 * landings are at 2000, 2300, 2600 and 2900. Both clocks are used below and
 * the call sites say which they mean.
 */
const run = (atMs: number): StormState =>
  tick(startStorm(buildWave(spec, 7)), atMs);

describe("the key that leaves a storm", () => {
  /*
   * `QUIT_KEY` is taken inside the gun's own listener and before the trigger,
   * so what it must be is a key that could not have been a shot. Two ways it
   * could stop being one, and both are decidable here.
   */

  it("is not a key the board carries", () => {
    // A key with a lane is a key `preventDefault` swallows and a key a letter
    // can fall down. `Escape` has neither, which is what makes it spendable.
    expect(keyX(QUIT_KEY)).toBeNull();
  });

  it("is not a key any character is typed with", () => {
    // The stronger half: if some character resolved to this code, a child
    // shooting that letter would leave the game instead.
    for (const ch of [...`abcdefghijklmnopqrstuvwxyz0123456789 ;',./[]\\-=\``])
      expect(strokeFor(ch)?.code, ch).not.toBe(QUIT_KEY);
  });
});

describe("stepMs", () => {
  it("is nothing on the first frame of a run", () => {
    // There is no interval before the first timestamp. Measuring one against
    // zero would hand the storm however long the page had been open.
    expect(stepMs(9_000, null)).toBe(0);
  });

  it("is the wall clock for any frame a game could be played at", () => {
    expect(stepMs(1016.7, 1000)).toBeCloseTo(16.7, 10);
    expect(stepMs(1033, 1000)).toBe(33);
    expect(stepMs(1000 + MAX_STEP_MS, 1000)).toBe(MAX_STEP_MS);
  });

  it("floors a rewind, and a delta that is not a number at all", () => {
    expect(stepMs(1000, 1016)).toBe(0);
    expect(stepMs(Number.NaN, 1000)).toBe(0);
    expect(stepMs(1000, Number.NaN)).toBe(0);
    // Not clamped to the cap: an infinite reading is not a long frame, it is
    // not a reading, and the same answer as a `NaN` is the honest one.
    expect(stepMs(Number.POSITIVE_INFINITY, 1000)).toBe(0);
  });

  it("does not fast-forward the wave through a backgrounded tab", () => {
    // `requestAnimationFrame` is suspended while a tab is hidden, so coming
    // back is one frame carrying however long the child was away. Unclamped,
    // the twenty seconds below would land every letter of the wave at once —
    // `tick` resolves every landing inside the interval it is given, honestly
    // and by design (decision 35), which is exactly why the clamp is here and
    // not there.
    const away = 20_000;
    const back = tick(run(0), stepMs(away, 0));

    expect(back.timeMs).toBeLessThanOrEqual(MAX_STEP_MS);
    expect(back.resolved.filter((outcome) => outcome !== null)).toHaveLength(0);

    // And the unclamped comparison, so the test fails if the clamp is removed
    // rather than merely if the number changes.
    expect(
      tick(run(0), away).resolved.filter((outcome) => outcome !== null),
    ).toHaveLength(spec.count);
  });
});

/** A letter of the given character, falling in its own key's column. */
const letterOf = (ch: string, spawnMs: number, fallMs: number): StormLetter => {
  const stroke = strokeFor(ch)!;
  return {
    ch,
    code: stroke.code,
    shifted: stroke.shift !== null,
    finger: stroke.finger as ShieldFinger,
    lane: keyX(stroke.code)!,
    spawnMs,
    fallMs,
    // No queue: a hand-placed letter falls the instant it appears, so every
    // absolute moment below is the one the test wrote down. The beat a real
    // wave gives a letter (`QUEUE_MS`) is `buildWave`'s, and it belongs to the
    // tests of the schedule rather than to every test of what a landing costs.
    dropMs: spawnMs,
    landMs: spawnMs + fallMs,
  };
};

/**
 * Two letters whose paths cross: a slow `f` from the start, and a `j` that
 * spawns half a second later and lands first.
 *
 * Hand-built rather than seeded, because the crossing is the point and
 * `buildWave` samples both fall times from one range — a seed that produced
 * this today would be a seed, not a fixture.
 */
const crossing: Wave = {
  spec: { ...spec, keys: ["f", "j"], count: 2 },
  seed: 0,
  letters: [letterOf("f", 0, 2000), letterOf("j", 500, 500)],
  durationMs: 2000,
};

describe("redrawn", () => {
  it("says no to a frame that only moved the stones", () => {
    // The whole reason the loop needs this. Sixty times a second `tick`
    // returns a new object with a new `timeMs` and an identical picture; a
    // clock that re-rendered on that would be rendering the field per frame,
    // which is the thing §8.9 says not to do.
    const at = run(120);
    expect(redrawn(at, tick(at, 16))).toBe(false);
  });

  it("says yes when a letter appears", () => {
    // A spawn is a time crossing and nothing else: no field of a `StormState`
    // records it, so identity on the state cannot find it and neither can any
    // comparison of the reducer's own bookkeeping.
    const before = run(299);
    const after = tick(before, 2);

    expect(after.resolved).toBe(before.resolved);
    expect(redrawn(before, after)).toBe(true);
  });

  it("says yes when a letter lands, and when one is shot", () => {
    // A hair before the first landing, which is a fall after the drop.
    const before = run(QUEUE_MS + 999);
    expect(redrawn(before, tick(before, 2))).toBe(true);
    expect(redrawn(before, fire(before, "KeyF"))).toBe(true);
  });

  it("says yes to a miss, streak or no streak", () => {
    const hit = fire(run(QUEUE_MS + 999), "KeyF");
    expect(hit.combo).toBe(1);
    expect(redrawn(hit, fire(hit, "KeyQ"))).toBe(true);

    // And to a miss on an unbroken nothing, which changes no combo at all:
    // the score fell, and the HUD flashes a `--flare` over it (§8.6). Before
    // scoring landed this was the case that changed nothing a screen could
    // see — the one where `fire` hands back a fresh object saying "different"
    // and means it about the clock. Now the only thing left in that shape is
    // a miss on a run that has already ended, which `fire` refuses outright.
    const cold = run(120);
    const missed = fire(cold, "KeyQ");
    expect(missed.combo, "there was no streak to break").toBe(cold.combo);
    expect(missed.score).toBeLessThan(cold.score);
    expect(redrawn(cold, missed)).toBe(true);

    const dead = { ...cold, ending: { kind: "cleared" } as const };
    expect(fire(dead, "KeyQ")).toBe(dead);
    expect(redrawn(dead, fire(dead, "KeyQ"))).toBe(false);
  });

  it("says no when only the target changes mid-air", () => {
    // Two letters at different speeds cross (decision 32), and nothing else
    // moves: nothing is resolved, nothing spawns, and the count of stones on
    // the field is the same on both sides of it.
    //
    // That crossing used to be a redraw, because the board was marked against
    // the lowest letter and would go on marking against the wrong one. There
    // is no board now (decision 64) and nothing else on the screen names the
    // target — a stone carries no target class and the HUD does not print it —
    // so the picture is identical and React is not asked to draw it again.
    const before = tick(startStorm(crossing), 600);
    const after = tick(before, 200);

    expect(after.resolved).toBe(before.resolved);
    expect(redrawn(before, after)).toBe(false);
  });
});

describe("the shape the clock is watching", () => {
  /**
   * Every field a `StormState` declares, written as a value.
   *
   * The type is what makes this catch an OPTIONAL field. `Object.keys` of a
   * fresh run can only see what `startStorm` actually sets, so a
   * `readonly score?: number` added for a HUD would be invisible to a list of
   * key strings — and `redrawn` would go on never comparing it. A
   * `Record<keyof StormState, true>` will not compile without a line for that
   * field, and being an object literal it will not compile with a line for one
   * that has been removed either.
   */
  const FIELDS: Record<keyof StormState, true> = {
    combo: true,
    ending: true,
    misses: true,
    missTintAt: true,
    resolved: true,
    score: true,
    shield: true,
    timeMs: true,
    wave: true,
  };

  it("pins the shape of a StormState, so a new field is decided about here", () => {
    // `redrawn` compares seven of these — `score`, `misses` and `missTintAt`
    // are the HUD's, and the last of them is what its `--flare` wash is
    // mounted from (decision 57) — derives two more from the clock, and leaves
    // `wave` out because a run's wave is fixed. A story that adds a tenth has
    // to come here and say which of those three it is; the alternative is
    // finding out from a HUD that quietly stopped updating.
    expect(Object.keys(startStorm(buildWave(spec, 7))).sort()).toEqual(
      Object.keys(FIELDS).sort(),
    );
  });
});
