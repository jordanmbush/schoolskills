import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KEYS, keyX, strokeFor } from "@/engine/keyboard";
import { buildWave, fire, startStorm, tick } from "@/engine/typing/storm";

import { StormField, aimedAt } from "./StormField";

import type { KeyDef } from "@/engine/keyboard";
import type { StormState, WaveSpec } from "@/engine/typing/storm";

/**
 * The one claim this screen exists to keep: a letter falls down the column of
 * its own key (docs/typing.md §8.2, decision 19).
 *
 * It is worth testing at this altitude because it can be broken by a change to
 * either half and looks fine from both. The engine can hand over a lane it
 * measured from the wrong edge of a key; the stylesheet can multiply it by the
 * wrong unit, or forget that the keycap is drawn inset inside its slot. Every
 * one of those type-checks, renders, and teaches a child that `y` lives
 * somewhere it does not — which is worse than not drawing the hint at all,
 * because they will believe it.
 *
 * So the geometry is checked in KEY UNITS, end to end: the lane the component
 * writes, against the cap the board draws, through the arithmetic game.css
 * actually performs. No pixels are involved on either side, which is the
 * property being defended.
 */

const css = readFileSync(
  fileURLToPath(new URL("../../../styles/game.css", import.meta.url)),
  "utf8",
);

/** Where the field's own rules start in the game stylesheet. */
const STORM_BLOCK = "/* ── Hailstorm: the field";

/**
 * The field's rules with the prose taken out.
 *
 * The comments in this block quote the very things being asserted against —
 * "`height`, not `min-height`", "390px of height" — so a test reading them
 * would be marking the explanation rather than the stylesheet.
 */
const storm = css
  .slice(css.indexOf(STORM_BLOCK))
  .replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * The keycap inset, as the fraction of a key unit game.css sets it to.
 *
 * Read out of the stylesheet rather than written down here, because the whole
 * point of the arithmetic below is that one number governs both the cap and
 * the lane. A test carrying its own copy could agree with neither.
 */
const GAP = Number(
  /--key-gap:\s*calc\(var\(--key\)\s*\*\s*([\d.]+)\)/.exec(css)![1],
);

/** A wave of nothing but `ch`, so which letter falls is not left to a seed. */
const only = (ch: string, count = 1, fallMs = 1000): WaveSpec => ({
  keys: [ch],
  count,
  gap: [300, 300],
  fall: [fallMs, fallMs],
  shield: 3,
  repairAt: 0,
});

const frameOf = (spec: WaveSpec, atMs: number): StormState =>
  tick(startStorm(buildWave(spec, 7)), atMs);

const draw = (state: StormState) =>
  renderToStaticMarkup(<StormField state={state} />);

/** Every falling letter in a rendered field, as `{ ch, lane }`. */
const stones = (state: StormState) =>
  [
    ...draw(state).matchAll(
      /class="storm__letter" style="--lane:([\d.]+);--drop:([\d.e-]+)"[^>]*>(.)</g,
    ),
  ].map(([, lane, drop, ch]) => ({
    ch,
    lane: Number(lane),
    drop: Number(drop),
  }));

/**
 * Where a falling letter's middle lands, in key units.
 *
 * `left: calc(var(--lane) * var(--key) - var(--key-gap) / 2)` with
 * `translate: -50% 0` — the stylesheet's arithmetic, done in units.
 */
const stoneCentre = (lane: number) => lane - GAP / 2;

/**
 * Where a drawn keycap's middle sits, in the same units.
 *
 * `left: calc(var(--x) * var(--key))` and
 * `width: calc(var(--w) * var(--key) - var(--key-gap))` — so the cap starts at
 * its slot's left edge and is a whole gap narrower than the slot is.
 */
const capCentre = (key: KeyDef) => key.x + ((key.width ?? 1) - GAP) / 2;

const cap = (code: string) => KEYS.find((k) => k.code === code)!;

describe("StormField", () => {
  it("puts a letter over the cap that types it, to the pixel", () => {
    // The claim, at last: `f` falls onto `f`. Not "near" it and not "over its
    // slot" — the middle of the falling letter and the middle of the drawn
    // keycap are the same point on the screen, because the lane steps back by
    // exactly the half-gap the cap is inset by.
    const [f] = stones(frameOf(only("f"), 500));

    expect(f.ch).toBe("f");
    expect(stoneCentre(f.lane)).toBeCloseTo(capCentre(cap("KeyF")), 10);
  });

  it("puts `y` between `g` and `h`, because that is where `y` is", () => {
    const [y] = stones(frameOf(only("y"), 500));
    const centre = stoneCentre(y.lane);

    expect(centre).toBeGreaterThan(capCentre(cap("KeyG")));
    expect(centre).toBeLessThan(capCentre(cap("KeyH")));

    // And where between them: a quarter of a unit left of `h` and three
    // quarters right of `g`, because the top row is staggered a quarter unit
    // out from the home row rather than half. That is the plastic — `y` really
    // does sit up and slightly left of `h` — and it is the whole spatial hint:
    // a child who reaches towards `h` for a falling `y` has learnt something
    // true about where their finger has to go.
    expect(capCentre(cap("KeyH")) - centre).toBeCloseTo(0.25, 10);
    expect(centre - capCentre(cap("KeyG"))).toBeCloseTo(0.75, 10);
  });

  it("takes every lane from the engine, and computes none of its own", () => {
    // Both hands, both staggers, and a shifted character whose lane is its
    // letter's key rather than the shift's.
    for (const ch of ["a", "f", "y", "p", ";", "?", "M"]) {
      const [stone] = stones(frameOf(only(ch), 500));
      expect(stone.lane).toBe(keyX(strokeFor(ch)!.code));
    }
  });

  it("scales the lane by the key unit, and never by a pixel", () => {
    const rule = /\.storm__letter\s*{[^}]*}/.exec(storm)![0];

    expect(rule).toContain(
      "left: calc(var(--lane) * var(--key) - var(--key-gap) / 2)",
    );
    // No length in this block is absolute except a hairline border: a field
    // measured in pixels would come apart from the board the moment `--key`
    // moved, which is at every viewport width.
    expect(storm.replace(/1px solid/g, "")).not.toMatch(/\d+px/);
  });

  it("draws one key unit, shared with the board it is aiming at", () => {
    // The AC's "one source of truth" is the `KEY_ROWS` table for the lanes and
    // this custom property for the scale. Two declarations of it — one on the
    // board, one on the field — is exactly how a lane and a cap start
    // disagreeing about how wide a key is.
    expect(css.match(/--key:\s/g)).toHaveLength(1);
    expect(/:root\s*{\s*--key:/.test(css)).toBe(true);
  });

  it("fills the viewport minus the ad band, and does not scroll", () => {
    const field = /\.storm\s*{[^}]*}/.exec(storm)![0];

    // `height`, not `min-height`: a field that may grow is a field that
    // scrolls, and the letters would go on falling off screen.
    expect(field).toContain("height: calc(100dvh - var(--ad-h))");
    expect(field).not.toContain("min-height");
    expect(field).toContain("overflow: hidden");
  });

  it("is drawn out of ice tokens, with no colour of its own", () => {
    // Every colour is a world token, and none of the five is borrowed: a
    // hailstone in `--lime` would be saying something was right about it.
    expect(storm).not.toMatch(/#[0-9a-f]{3}/i);
    expect(storm).not.toMatch(/\brgba?\(/);
    for (const name of ["--lime", "--flare", "--sky", "--gold", "--grape"])
      expect(storm).not.toContain(`var(${name})`);
  });

  it("draws what is in the air, and nothing that is spent", () => {
    // Four letters, 300ms apart, each crossing the field in half a second: by
    // 950ms the first two have landed and the last two are still falling.
    const state = frameOf(only("j", 4, 500), 950);

    expect(stones(state)).toHaveLength(2);
    expect(state.resolved[0]).not.toBeNull();
    expect(state.resolved[1]).not.toBeNull();

    // And one that was shot leaves at the press rather than at its landing —
    // `resolved` is what is drawn from, not the clock alone.
    expect(stones(fire(state, "KeyJ"))).toHaveLength(1);
  });

  it("puts a stone at the top when it spawns and at the line when it lands", () => {
    expect(stones(frameOf(only("j"), 0))[0].drop).toBe(0);
    expect(stones(frameOf(only("j"), 750))[0].drop).toBeCloseTo(0.75, 10);
  });

  it("mounts the board as the gun, and lets it point at nothing", () => {
    const html = draw(frameOf(only("f"), 500));

    // The same picture the lessons put under the passage — one board, one
    // layout, one echo listener.
    expect(html.match(/class="keyboard__key/g)).toHaveLength(KEYS.length);

    // But no hint, ever. A board that pointed at the next key would be
    // playing the game for the child (§8.1).
    expect(html).not.toContain("is-next");
  });

  it("marks presses against the lowest letter, and against none once dead", () => {
    const state = frameOf(only("f", 3), 500);
    expect(aimedAt(state)).toBe("f");

    // `targetIndex` answers "which is lowest", not "is this run alive", so it
    // still names a letter on a dead run. The screen is where that has to be
    // caught, or the board goes on flaring at a child who has already lost.
    const dead: StormState = {
      ...state,
      ending: { kind: "breached", finger: "l-index", index: 0 },
    };
    expect(aimedAt(dead)).toBeNull();
  });

  it("says what the screen is, without reading out the hailstorm", () => {
    const html = draw(frameOf(only("f"), 500));

    expect(html).toContain("Hailstorm");
    // The sky churns sixty times a second once STM04 lands; the board is
    // sixty spans. Neither is an announcement anybody could act on.
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });
});
