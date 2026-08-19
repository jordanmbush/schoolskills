import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FINGER_ZONES, KEYS, keyX, strokeFor } from "@/engine/keyboard";
import {
  SHIELD_FINGERS,
  buildWave,
  fire,
  startStorm,
  tick,
} from "@/engine/typing/storm";

import { StormField, aimedAt } from "./StormField";

import type { FingerZone, KeyDef } from "@/engine/keyboard";
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
 * actually performs — both sides read out of the stylesheet rather than
 * restated here, for the reason `capCentre` gives. No pixels are involved on
 * either side, which is the property being defended.
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
 * The whole stylesheet with its prose taken out, so a declaration is read from
 * the rule that ships and never from a comment describing it.
 */
const sheet = css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * The one value game.css declares for `prop` on exactly `selector`.
 *
 * Exactly one, deliberately. A second declaration of the cap's width in a
 * later block is the drift this whole file is about, and read leniently it
 * would shadow the rule below without failing anything.
 */
const declaration = (selector: string, prop: string): string => {
  const found = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, list]) => list.trim() === selector)
    .map(([, , body]) =>
      new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`).exec(body),
    )
    .filter((match) => match !== null)
    .map((match) => match[1].trim());

  if (found.length !== 1)
    throw new Error(
      `expected one \`${prop}\` on \`${selector}\`, found ${found.length}`,
    );
  return found[0];
};

/**
 * `a * b - c / 2`, the way a browser reads it: multiply and divide first, then
 * add and subtract, left to right. Parentheses are already flattened out by
 * `unitsOf`, which is the only caller.
 */
const arithmetic = (expr: string): number => {
  const tokens = expr
    .trim()
    .split(/\s*([+\-*/])\s*/)
    .filter((token) => token !== "");
  if (tokens[0] === "+" || tokens[0] === "-") tokens.unshift("0");

  const terms = [Number(tokens[0])];
  const signs: string[] = [];
  for (let i = 1; i < tokens.length; i += 2) {
    const value = Number(tokens[i + 1]);
    if (tokens[i] === "*") terms[terms.length - 1] *= value;
    else if (tokens[i] === "/") terms[terms.length - 1] /= value;
    else {
      signs.push(tokens[i]);
      terms.push(value);
    }
  }

  const total = signs.reduce(
    (sum, sign, i) => (sign === "+" ? sum + terms[i + 1] : sum - terms[i + 1]),
    terms[0],
  );
  if (Number.isNaN(total))
    throw new Error(`not an expression in key units: ${expr}`);
  return total;
};

/**
 * A CSS length expression, evaluated in key units — `--key` is 1, and every
 * other custom property is supplied by the caller.
 *
 * Enough of `calc()` to run the four declarations this file reads, and no
 * more: an expression naming a property the caller did not supply throws,
 * rather than quietly evaluating as though it were nothing.
 */
const unitsOf = (expr: string, vars: Record<string, number>): number => {
  const filled = expr.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    if (!(name in vars))
      throw new Error(
        `\`${expr}\` reads ${name}, which this test does not model`,
      );
    return `(${vars[name]})`;
  });

  let flat = filled.replace(/\bcalc\b/g, "");
  while (flat.includes("("))
    flat = flat.replace(/\(([^()]*)\)/, (_, inner: string) =>
      String(arithmetic(inner)),
    );
  return arithmetic(flat);
};

/**
 * The keycap inset, as the fraction of a key unit game.css sets it to.
 *
 * Read out of the stylesheet rather than written down here, because the whole
 * point of the arithmetic below is that one number governs both the cap and
 * the lane. A test carrying its own copy could agree with neither.
 */
const GAP = unitsOf(declaration(":root", "--key-gap"), { "--key": 1 });

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

/**
 * A frame of the field, on its own. The `skyRef` is where `useStormClock`
 * writes the fall (§8.9); a still frame has no clock, so it is handed an empty
 * ref rather than the component being made to work without one.
 */
const draw = (state: StormState) =>
  renderToStaticMarkup(<StormField state={state} skyRef={{ current: null }} />);

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
 * The field's own `left` declaration, run rather than restated. `translate:
 * -50% 0` — pinned below, because this depends on it — centres the stone on
 * that point, so what comes back is the middle and not the left edge.
 */
const stoneCentre = (lane: number) =>
  unitsOf(declaration(".storm__letter", "left"), {
    "--key": 1,
    "--key-gap": GAP,
    "--lane": lane,
  });

/**
 * Where a drawn keycap's middle sits, in the same units — from the board's own
 * `left` and `width`, which is where the inset the lane compensates for is
 * actually written down.
 *
 * Both sides coming out of the sheet is the whole point. Two hand-written
 * models would each carry the half-gap term they were meant to be checking,
 * and it would cancel across the assertion: subtract half a gap from the lane,
 * fold half a gap into the cap, and the two agree for ANY gap — including
 * none, and including a board that insets its caps by twice what the field
 * compensates for. Reading the declarations means a change to either half
 * moves one side of the comparison and not the other.
 */
const capSpan = (key: KeyDef): [number, number] => {
  const vars = {
    "--key": 1,
    "--key-gap": GAP,
    "--x": key.x,
    "--w": key.width ?? 1,
  };
  const left = unitsOf(declaration(".keyboard__key", "left"), vars);
  return [left, left + unitsOf(declaration(".keyboard__key", "width"), vars)];
};

const capCentre = (key: KeyDef) => {
  const [left, right] = capSpan(key);
  return (left + right) / 2;
};

/**
 * Where a shield segment starts and ends, in the same units and out of the
 * same sheet — `FINGER_ZONES` through the field's own `left` and `width`.
 *
 * A span rather than a centre, because a zone is a group of keys and the claim
 * being checked is that it covers them: `l-index` is `f` and `g` together, and
 * a segment centred on the pair while too narrow for it would put half of `g`
 * over the right hand's shield.
 */
const zoneSpan = (zone: FingerZone): [number, number] => {
  const vars = {
    "--key": 1,
    "--key-gap": GAP,
    "--zone-x": zone.x,
    "--zone-w": zone.width,
  };
  const left = unitsOf(declaration(".storm__zone", "left"), vars);
  return [left, left + unitsOf(declaration(".storm__zone", "width"), vars)];
};

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
    // And that `left` is the letter's CENTRE rather than its left edge, which
    // is what `stoneCentre` above reads it as. Lose the translate and every
    // letter moves half a stone right of the key it names.
    expect(rule).toContain("translate: -50% 0");
    // No length in this block is absolute except a hairline border: a field
    // measured in pixels would come apart from the board the moment `--key`
    // moved, which is at every viewport width.
    expect(storm.replace(/1px solid/g, "")).not.toMatch(/\d+px/);
  });

  it("falls on a transform, down the sky rather than down itself", () => {
    // The fall is a transform and not `top`: twelve stones moving sixty times
    // a second is twelve layouts a frame written the other way (§8.9). And it
    // is `translateY`, which is what leaves `translate: -50% 0` free to hold
    // the lane centring without the two writing over each other.
    expect(declaration(".storm__letter", "transform")).toBe(
      "translateY(calc(var(--drop) * var(--fall)))",
    );
    // `top` anchors the stone at the top of the sky and nothing else; the fall
    // is not written there.
    expect(declaration(".storm__letter", "top")).toBe("0");

    // A percentage inside a transform resolves against the element being
    // moved, so the travel is the sky's own height — which is only a length a
    // stone can read because the sky is a size container. Floored at zero,
    // because the sky minus a stone goes negative on a viewport shorter than
    // about 265px, and an unfloored travel runs the storm upwards.
    expect(declaration(".storm__sky", "container-type")).toBe("size");
    expect(declaration(".storm__letter", "--fall").replace(/\s+/g, " ")).toBe(
      "max(0cqh, 100cqh - var(--stone))",
    );
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
    // Every colour is a world token or a finger hue: a hailstone with a
    // literal in it would be a stone that stayed the same in the next world.
    expect(storm).not.toMatch(/#[0-9a-f]{3}/i);
    expect(storm).not.toMatch(
      /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/,
    );

    // Notations can be listed; the named colours cannot, so they are caught
    // from the other end: strip a colour-bearing value of its tokens and its
    // plumbing and there is nothing left to read. `color: rebeccapurple`
    // leaves a word, and so would any notation the list above forgets.
    const PLUMBING =
      /var\(--[\w-]+\)|color-mix|calc|in oklab|solid|dashed|dotted|none|inherit|inset|transparent|currentcolor|[\d.]+(?:px|%|em|rem|ms|s)?|[-*,()/\s]/gi;
    const literals = [
      ...storm.matchAll(
        /(?:^|[;{])\s*([\w-]*(?:color|background|border|shadow|fill|stroke)[\w-]*)\s*:\s*([^;]+)/g,
      ),
    ].filter(([, , value]) => /[a-z]/i.test(value.replace(PLUMBING, "")));
    expect(
      literals.map(([, prop, value]) => `${prop}: ${value.trim()}`),
    ).toEqual([]);
  });

  it("borrows exactly the two telemetry colours it has something to say with", () => {
    // The field itself borrows none of the five — a hailstone in `--lime`
    // would be saying something was right about it. The shield borrows two,
    // and only where they already mean what they mean everywhere else on this
    // site: `--flare` is a wrong, and damage and a hole are the two wrongs
    // this game has; `--lime` is a right, and a repair is bought with a run of
    // them (§8.5). The other three would each be a lie about what happened —
    // nothing on this screen is a ghost, a record or a badge.
    const rules = [...storm.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
      ([, selector, body]) => ({ selector: selector.trim(), body }),
    );
    const drawnWith = (token: string) =>
      rules
        .filter((rule) => rule.body.includes(`var(${token})`))
        .map((rule) => rule.selector)
        .sort();

    expect(drawnWith("--flare")).toEqual([
      ".storm__hit",
      ".storm__zone[data-hole]",
    ]);
    expect(drawnWith("--lime")).toEqual([".storm__mend"]);
    for (const name of ["--sky", "--gold", "--grape"])
      expect(storm).not.toContain(`var(${name})`);
  });

  it("puts each shield segment over the keys of its own finger", () => {
    // The other half of §8.2's claim, for the other end of the fall: a letter
    // is over the cap that types it, and the segment it lands on is over the
    // whole column of keys that finger is responsible for. Both are read out
    // of the stylesheet in key units, so a change to the board's inset moves
    // the caps and the segments together or fails here.
    for (const finger of SHIELD_FINGERS) {
      const [left, right] = zoneSpan(FINGER_ZONES[finger]);
      const home = KEYS.filter((k) => k.row === 2 && k.finger === finger);

      expect(home.length, finger).toBeGreaterThan(0);
      for (const key of home) {
        const [capLeft, capRight] = capSpan(key);
        expect(left, `${finger} ⊃ ${key.code}`).toBeLessThanOrEqual(capLeft);
        expect(right, `${finger} ⊃ ${key.code}`).toBeGreaterThanOrEqual(
          capRight,
        );
      }
    }
  });

  it("tiles the bottom of the sky in eight, centred on the plastic", () => {
    const spans = SHIELD_FINGERS.map((finger) =>
      zoneSpan(FINGER_ZONES[finger]),
    );

    // Edge to edge, in board order: a hole has to be a gap in a wall, and a
    // wall with slack between its blocks would have holes in it already.
    expect(spans).toHaveLength(8);
    for (let i = 1; i < spans.length; i++)
      expect(spans[i][0], SHIELD_FINGERS[i]).toBeCloseTo(spans[i - 1][1], 10);

    // And the rail as a whole is centred on the DRAWN board rather than on the
    // grid of slots behind it — which is what the half-gap step-back buys, and
    // the reason a segment is allowed to overhang the sky by the same half gap
    // at each end. Take the correction out and this fails by a whole gap on
    // one side.
    const board: [number, number] = [
      capSpan(cap("CapsLock"))[0],
      capSpan(cap("Enter"))[1],
    ];
    expect((spans[0][0] + spans[7][1]) / 2).toBeCloseTo(
      (board[0] + board[1]) / 2,
      10,
    );
  });

  it("drops every letter within a quarter unit of its own segment", () => {
    // What a vertical seam can and cannot do. The rows are staggered, so a
    // finger's keys are a slanted column and no straight segment covers all of
    // it: `6` is typed by the right index and its lane is a quarter unit left
    // of where the right index's segment starts, because `6` really does sit
    // that far left of `h` and `j` (§8.5, decision 41). The home row — the row
    // the segments are drawn on, and the row the hands rest on — is always
    // strictly inside. A quarter unit is the whole of the error, and this is
    // where a change that made it worse would have to be argued for.
    const strays = [];
    for (const key of KEYS) {
      const finger = key.finger;
      // Only the keys a letter can fall from: no word legends, and no thumb —
      // the space bar has no segment to fall on (§8.3).
      if (key.cap[0].length !== 1 || finger === "thumb") continue;

      const [left, right] = zoneSpan(FINGER_ZONES[finger]);
      const centre = stoneCentre(keyX(key.code)!);
      strays.push({ key, out: Math.max(left - centre, centre - right, 0) });
    }

    for (const { key, out } of strays) expect(out, key.code).toBeLessThan(0.26);
    for (const { key, out } of strays)
      if (key.row === 2) expect(out, key.code).toBe(0);
    expect(Math.max(...strays.map((s) => s.out))).toBeCloseTo(0.25, 10);
  });

  it("keeps the shield inside a sky that has almost no height left", () => {
    // The sky is the `minmax(0, 1fr)` track and it is what gives on a short
    // viewport — about 78px at 1280×360 and about 21px at 1280×250. A shield
    // in key units alone would be a fixed slab of a field with nothing left,
    // so it is the smaller of a third of a key and a fifth of the sky. `cqh`
    // is a length only because the sky is a size container, which the fall
    // above already depends on.
    expect(declaration(".storm__shield", "height")).toBe(
      "min(calc(var(--key) * 0.34), 20cqh)",
    );
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
