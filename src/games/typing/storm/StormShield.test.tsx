import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FINGER_ZONES } from "@/engine/keyboard";
import {
  SHIELD_FINGERS,
  buildWave,
  fire,
  startStorm,
  tick,
  zoneTally,
} from "@/engine/typing/storm";

import { StormShield } from "./StormShield";

import type { ShieldFinger, StormState, WaveSpec } from "@/engine/typing/storm";

/**
 * The shield, as a child reads it: eight segments, how much is left of each,
 * and one event apiece when something happens to one (docs/typing.md §8.5).
 *
 * The geometry is NOT here. That a segment sits over its own finger's keys is
 * a claim about this component's numbers *and* game.css's arithmetic, and
 * `StormField.test.tsx` is where the stylesheet is read and run in key units —
 * so the alignment lives beside the lane it shares its half-gap correction
 * with, rather than in a second, weaker copy here.
 */

const only = (ch: string, over: Partial<WaveSpec> = {}): WaveSpec => ({
  keys: [ch],
  count: 4,
  gap: [300, 300],
  fall: [500, 500],
  shield: 3,
  repairAt: 0,
  ...over,
});

const frameOf = (spec: WaveSpec, atMs: number): StormState =>
  tick(startStorm(buildWave(spec, 7)), atMs);

/** One rendered segment, as the attributes the stylesheet reads. */
type Drawn = {
  finger: string;
  vars: Record<string, number>;
  hole: boolean;
  hit: number;
  mend: number;
};

const segments = (state: StormState): Drawn[] =>
  renderToStaticMarkup(<StormShield state={state} />)
    .split('<div class="storm__zone"')
    .slice(1)
    .map((chunk) => ({
      finger: /data-finger="([\w-]+)"/.exec(chunk)![1],
      vars: Object.fromEntries(
        [...chunk.matchAll(/(--[\w-]+):([\d.]+)/g)].map(([, name, value]) => [
          name,
          Number(value),
        ]),
      ),
      hole: chunk.includes("data-hole"),
      hit: (chunk.match(/class="storm__hit"/g) ?? []).length,
      mend: (chunk.match(/class="storm__mend"/g) ?? []).length,
    }));

const at = (state: StormState, finger: ShieldFinger) =>
  segments(state).find((zone) => zone.finger === finger)!;

describe("StormShield", () => {
  it("spans the field in eight, one per finger, in the reducer's order", () => {
    // The same order the engine breaks a repair's ties in, which is what lets
    // "the weakest zone" be a thing a child could have predicted by looking.
    expect(segments(frameOf(only("f"), 0)).map((zone) => zone.finger)).toEqual([
      ...SHIELD_FINGERS,
    ]);
  });

  it("takes every span from the engine, and computes none of its own", () => {
    for (const zone of segments(frameOf(only("f"), 0))) {
      const span = FINGER_ZONES[zone.finger as ShieldFinger];
      expect(zone.vars["--zone-x"], zone.finger).toBe(span.x);
      expect(zone.vars["--zone-w"], zone.finger).toBe(span.width);
    }
  });

  it("carries no `data-stone`, so the fall loop steps over it", () => {
    // `useStormClock` walks the sky's children and reads `data-stone` off each
    // one. Absent, that is `Number(undefined)` — `NaN`, which indexes no
    // letter and is skipped. An EMPTY one would be `Number("")`, which is 0:
    // the shield would be handed the first letter's `--drop` on every frame,
    // as though it were the stone.
    expect(
      renderToStaticMarkup(<StormShield state={frameOf(only("f"), 0)} />),
    ).not.toContain("data-stone");
  });

  it("draws hit points as a fraction of the level's own shield", () => {
    // A fraction, so the stylesheet never learns how deep this wave's shield
    // is — a level with six points a zone draws the same eight blocks.
    const start = frameOf(only("f", { shield: 3 }), 0);
    expect(at(start, "l-index").vars["--hp"]).toBe(1);

    // One `f` has landed by 550ms: two of three left on the left index, and
    // nothing taken off any other finger.
    const hurt = frameOf(only("f", { shield: 3 }), 550);
    expect(at(hurt, "l-index").vars["--hp"]).toBeCloseTo(2 / 3, 10);
    expect(at(hurt, "r-index").vars["--hp"]).toBe(1);
  });

  it("reads a zone at zero as a hole, and nothing above it", () => {
    const hurt = frameOf(only("f", { shield: 2 }), 550);
    expect(at(hurt, "l-index").hole).toBe(false);

    // Two landings into a two-point zone: empty, and the next `f` down this
    // column ends the run.
    const gone = frameOf(only("f", { shield: 2 }), 850);
    expect(at(gone, "l-index").vars["--hp"]).toBe(0);
    expect(at(gone, "l-index").hole).toBe(true);
    expect(segments(gone).filter((zone) => zone.hole)).toHaveLength(1);
  });

  it("starts a run with nothing pulsing", () => {
    // Both pulses are mounted by a counter, and a counter at zero renders no
    // element — otherwise every segment would flash on the frame a wave began.
    const start = segments(frameOf(only("f"), 0));
    expect(start.map((zone) => zone.hit + zone.mend)).toEqual(Array(8).fill(0));
  });

  it("tints once for a landing, and once for two in the same tick", () => {
    // The no-strobe rule, at the only altitude a unit test can hold it: one
    // pulse element per zone however much damage arrived, and a counter that
    // moves by two rather than a second element (§8.10). What that element
    // then does — mount once, animate once, and not restart on a frame where
    // nothing happened — is the browser's to answer, and `e2e/smoke.mjs` does.
    const one = frameOf(only("f"), 550);
    expect(at(one, "l-index").hit).toBe(1);
    expect(zoneTally(one)["l-index"].hit).toBe(1);

    // 30ms of gap and a 500ms fall puts two landings inside one 16ms frame.
    const together = tick(
      startStorm(buildWave(only("f", { gap: [30, 30] }), 7)),
      540,
    );
    expect(together.resolved.filter(Boolean)).toHaveLength(2);
    expect(zoneTally(together)["l-index"].hit).toBe(2);
    expect(at(together, "l-index").hit).toBe(1);
  });

  it("pulses a repair when one is paid out", () => {
    // A shield of two with a repair every second hit: one letter through, then
    // two shot, and the weakest zone — the one that just took the hit — gets
    // its point back (§8.5).
    const spec = only("f", { shield: 2, repairAt: 2 });
    const hurt = frameOf(spec, 550);
    expect(at(hurt, "l-index").vars["--hp"]).toBe(0.5);
    expect(at(hurt, "l-index").mend).toBe(0);

    // A tick between the two shots, because the second letter has not spawned
    // at 550ms and firing at an empty field is a miss that breaks the streak
    // (§8.4) — which is the rule the repair hangs off.
    const mended = fire(tick(fire(hurt, "KeyF"), 100), "KeyF");
    expect(mended.shield["l-index"]).toBe(2);
    expect(zoneTally(mended)["l-index"]).toEqual({ hit: 1, mend: 1 });
    expect(at(mended, "l-index").mend).toBe(1);
    expect(at(mended, "l-index").vars["--hp"]).toBe(1);
  });

  it("does not read the letter that ended the run as a repair", () => {
    // The fatal landing is resolved as `landed` like any other, but `tick`
    // breaks before the decrement — there was nothing left to take. Counting
    // it against the hit points would leave the arithmetic one short and draw
    // a lime pulse on the frame a child died.
    const dead = frameOf(only("f", { shield: 1 }), 900);

    expect(dead.ending).toEqual({
      kind: "breached",
      finger: "l-index",
      index: 1,
    });
    expect(zoneTally(dead)["l-index"]).toEqual({ hit: 2, mend: 0 });
    expect(at(dead, "l-index").mend).toBe(0);
    // It still tints. A letter through a hole is the loudest thing that
    // happens in this game, and the counter moved.
    expect(at(dead, "l-index").hit).toBe(1);
    expect(at(dead, "l-index").hole).toBe(true);
  });

  it("draws a shieldless wave as eight holes rather than eight NaNs", () => {
    // `spec.shield: 0` is a legal wave — every zone starts as a hole and the
    // first letter down ends it. `0 / 0` is the trap: CSS drops a NaN and
    // would draw a full segment over a zone that is not there.
    const naked = segments(frameOf(only("f", { shield: 0 }), 0));
    expect(naked.map((zone) => zone.vars["--hp"])).toEqual(Array(8).fill(0));
    expect(naked.every((zone) => zone.hole)).toBe(true);
  });
});
