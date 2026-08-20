import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { comboMultiplier } from "@/engine/combo";
import { stormXp } from "@/engine/progress";
import { buildWave, fire, startStorm, tick } from "@/engine/typing/storm";

import { StormHud } from "./StormHud";

import type { StormState, WaveSpec } from "@/engine/typing/storm";

/**
 * The HUD, as a child reads it: what the run is worth, what the last clean hit
 * was paid at, and one flash of red when a wrong key takes points off
 * (docs/typing.md §8.6).
 *
 * Everything here is a rendering of numbers the reducer already holds, and
 * that is the property this file is really defending: not one of these
 * assertions computes what a hit was worth. `storm.test.ts` decides that a
 * fifth hit is worth fifteen points; this decides only that fifteen is what
 * ends up on the screen.
 */

const only = (ch: string, over: Partial<WaveSpec> = {}): WaveSpec => ({
  keys: [ch],
  count: 4,
  gap: [200, 200],
  fall: [4000, 4000],
  shield: 3,
  repairAt: 0,
  ...over,
});

/** A run with `hits` letters shot and `misses` wrong keys, in that order. */
const played = (hits: number, misses = 0, spec = only("f")): StormState => {
  let state = tick(startStorm(buildWave(spec, 7)), 900);
  for (let i = 0; i < hits; i++) state = fire(state, "KeyF");
  for (let i = 0; i < misses; i++) state = fire(state, "KeyZ");
  return state;
};

const hud = (state: StormState, onQuit?: () => void) =>
  renderToStaticMarkup(<StormHud state={state} onQuit={onQuit} />);

/** The HUD's text, with the markup taken out. */
const readOut = (state: StormState) => hud(state).replace(/<[^>]+>/g, " ");

const flashes = (state: StormState) =>
  (hud(state).match(/class="storm__miss"/g) ?? []).length;

describe("StormHud", () => {
  it("shows the score the reducer is holding, negative included", () => {
    expect(readOut(played(0))).toContain("0");
    expect(readOut(played(3))).toContain(String(played(3).score));

    // Score can fall (§8.6), and a score that fell below zero has to read as
    // one — a HUD that clamped it would be hiding the consequence the wrong
    // key was supposed to have.
    const sprayed = played(0, 3);
    expect(sprayed.score).toBeLessThan(0);
    expect(readOut(sprayed)).toContain(String(sprayed.score));
  });

  it("shows the multiplier the last hit was paid at", () => {
    // `comboMultiplier(state.combo)`: what the hit that just landed was paid
    // at — the third hit paid 13 and the HUD reads ×1.3 — which is also the
    // streak the next hit builds on, so a fourth would pay ×1.4. A run with
    // nothing shot yet rests at ×1.0. The same `comboMultiplier` scales the
    // score and `cardXp`: one streak, one multiplier, so the figure a child
    // watches climb is the figure their XP is worth.
    expect(readOut(played(0))).toContain("×1.0");
    expect(readOut(played(3))).toContain("×1.3");
    expect(readOut(played(3))).toContain(
      `×${comboMultiplier(played(3).combo).toFixed(1)}`,
    );

    // And it goes back to nothing the moment a wrong key breaks the streak,
    // which is what "immediately and visibly" means for the half of the cost
    // that is not points.
    expect(readOut(played(3, 1))).toContain("×1.0");
  });

  it("marks the multiplier as earned only while a streak is running", () => {
    // `data-hot` is what `--lime` hangs off in the stylesheet: at ×1 the
    // number is a fact about the rules, at ×1.3 it is a thing a child earned.
    expect(hud(played(0))).not.toContain("data-hot");
    expect(hud(played(3))).toContain("data-hot");
    expect(hud(played(3, 1))).not.toContain("data-hot");
  });

  it("flashes once per miss, and mounts nothing before the first one", () => {
    // The no-strobe mechanism, at the altitude a unit test can hold it: the
    // flash is one element keyed by a counter that only goes up (§8.10,
    // decision 42), so an unchanged count is the same node and cannot restart
    // the animation. A run starts with no element at all, or every HUD would
    // flash red on its first frame.
    expect(flashes(played(0))).toBe(0);
    expect(flashes(played(2))).toBe(0);
    expect(flashes(played(2, 1))).toBe(1);
    expect(flashes(played(2, 4)), "one element, not one per miss").toBe(1);
  });

  it("carries no `data-stone`, so the fall loop steps over it", () => {
    // `useStormClock` walks the sky's children and reads `data-stone` off each
    // one; the HUD is one of the two that are not stones. Absent, that is
    // `Number(undefined)` — `NaN`, which indexes no letter. An EMPTY one would
    // be `Number("")`, which is 0, and the HUD would be written the first
    // letter's fall sixty times a second.
    expect(hud(played(1))).not.toContain("data-stone");
  });

  /*
   * The way out (docs/typing.md §8.8, #155). A storm fills the viewport with
   * no site chrome over it, so until the run ends this is the only exit there
   * is — and on a tablet, where the game cannot be played at all, it is the
   * only thing on the screen that does anything.
   */

  it("draws a way out while the gun is live", () => {
    const html = hud(played(2), () => {});
    expect(html).toContain("storm__quit");
    expect(html).toContain(">Quit<");
  });

  it("draws none where a screen offers none", () => {
    // The prop is optional so that a still frame — this suite, a future
    // screen showing a run back — is not obliged to invent a destination.
    expect(hud(played(2))).not.toContain("storm__quit");
  });

  it("takes it away with the gun", () => {
    // Once the run has an ending, the panel standing where the board did
    // carries the way out (`StormOver`), and two exits on one screen are two
    // answers to the same question.
    const spec = only("f", { count: 1, fall: [1000, 1000] });
    const over = tick(startStorm(buildWave(spec, 7)), 5000);

    expect(over.ending).not.toBeNull();
    expect(hud(over, () => {})).not.toContain("storm__quit");
  });

  it("keeps the numbers where they were when it goes", () => {
    // Both are placed by column rather than by order (`game.css`), so the
    // multiplier does not slide into the middle of the sky on the frame the
    // quit disappears.
    const live = hud(played(2), () => {});
    expect(live).toMatch(/storm__score[^>]*>[\s\S]*storm__quit/);
    expect(live).toMatch(/storm__quit[\s\S]*storm__combo/);
  });

  it("is the one thing in the sky that is not aria-hidden", () => {
    // The sky's moving parts are hidden one element at a time (§4.4,
    // `StormField`), and this is why: an exit inside a hidden subtree is a
    // trap for exactly the child least able to get out of it.
    const html = hud(played(2), () => {});
    const quit = /<button[^>]*class="[^"]*storm__quit[^"]*"[^>]*>/.exec(
      html,
    )![0];

    expect(quit).not.toContain("aria-hidden");
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });

  it("says nothing about XP, in a run or at the end of one", () => {
    // The payout is the ending screen's line now (`StormOver`), where there is
    // room to put it beside the finger that let the storm through. Here it
    // would be a second number moving on different rules from the score beside
    // it — XP is computed once at the end and floored at zero (§8.6), and the
    // HUD is the run's own running total.
    const running = played(2);
    expect(running.ending).toBeNull();
    expect(readOut(running)).not.toContain("XP");

    const cleared = played(4, 0, only("f", { count: 2 }));
    expect(cleared.ending).toEqual({ kind: "cleared" });
    expect(stormXp(cleared)).toBeGreaterThan(0);
    expect(readOut(cleared), "not even once there is one").not.toContain("XP");
  });
});
