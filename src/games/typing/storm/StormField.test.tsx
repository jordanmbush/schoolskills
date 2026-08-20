import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { RaceProvider } from "@/components/state/RaceContext";
import { FINGER_ZONES, KEYS, keyX, strokeFor } from "@/engine/keyboard";
import {
  MIN_FALL_MS,
  QUEUE_MS,
  SHIELD_FINGERS,
  buildWave,
  fire,
  startStorm,
  tick,
} from "@/engine/typing/storm";

import { StormField } from "./StormField";
import { StormOver } from "./StormOver";

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

/*
 * Every absolute moment in this file is measured from the instant the first
 * letter starts to DROP, not from the start of the wave — hence the offset.
 * A real letter hangs at the top for `QUEUE_MS` before it moves (§8.3), and
 * that beat is the same for every letter of every level, so folding it in here
 * once leaves each schedule below saying exactly what it always said.
 */
const frameOf = (spec: WaveSpec, atMs: number): StormState =>
  tick(startStorm(buildWave(spec, 7)), QUEUE_MS + atMs);

/**
 * A frame of the field, on its own. The `skyRef` is where `useStormClock`
 * writes the fall (§8.9); a still frame has no clock, so it is handed an empty
 * ref rather than the component being made to work without one.
 */
const draw = (state: StormState) =>
  renderToStaticMarkup(<StormField state={state} skyRef={{ current: null }} />);

/** Every falling letter in a rendered field, as `{ ch, lane, fallMs, drop }`. */
const stones = (state: StormState) =>
  [
    ...draw(state).matchAll(
      /class="storm__letter" style="--lane:([\d.]+);--fall-ms:(\d+);--drop:([\d.e-]+)"[^>]*>(.)</g,
    ),
  ].map(([, lane, fallMs, drop, ch]) => ({
    ch,
    lane: Number(lane),
    fallMs: Number(fallMs),
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
    // `top` is where the fall begins and nothing else; the fall itself is not
    // written there. It is the sky's whole travel minus this letter's, so a
    // stone that is capped comes into view lower — and `top + --fall` is
    // `--sky-fall` for every letter, which is the promise that a capped stone
    // still lands exactly on the shield rather than short of it.
    expect(declaration(".storm__letter", "top")).toBe(
      "calc(var(--sky-fall) - var(--fall))",
    );

    // A percentage inside a transform resolves against the element being
    // moved, so the sky's travel is its own height — which is only a length a
    // stone can read because the sky is a size container. Floored at zero,
    // because the sky minus a stone goes negative on a viewport shorter than
    // about 265px, and an unfloored travel runs the storm upwards.
    expect(declaration(".storm__sky", "container-type")).toBe("size");
    expect(
      declaration(".storm__letter", "--sky-fall").replace(/\s+/g, " "),
    ).toBe("max(0cqh, 100cqh - var(--stone))");
  });

  it("caps how fast a stone falls, in stone heights rather than pixels", () => {
    // The travel is the SHORTER of the sky and what the speed cap allows
    // (decision 65). Without the `min` the fall is whatever the viewport
    // happens to be, so the same level is faster on a bigger monitor — which
    // is how a 900ms fall came to cross about 720px a second once #197 took
    // the board off the screen, and how `i` and `l` stopped being different
    // letters at speed.
    expect(declaration(".storm__letter", "--fall").replace(/\s+/g, " ")).toBe(
      "min( var(--sky-fall), " +
        "calc(var(--fall-ms, 1000) / 1000 * var(--hail-speed) * var(--stone)) )",
    );

    // In stone heights a second, and therefore a number with no unit: what
    // blurs a moving glyph is how far it travels against its own size, so a
    // cap written in pixels would mean something different at every `--key`.
    // High enough that an ordinary screen uses the whole sky — the reading
    // time is the beat a letter hangs for first (`QUEUE_MS`), not a slower
    // fall — and low enough that a very tall one cannot run away with it.
    expect(declaration(".storm", "--hail-speed")).toBe("9");

    // And the letter's own fall time is a render's to write, not the loop's:
    // it is fixed when the wave is built, where `--drop` moves every frame.
    for (const fallMs of [900, 2600]) {
      const [stone] = stones(frameOf(only("f", 1, fallMs), 100));
      expect(stone.fallMs).toBe(fallMs);
    }
  });

  it("draws one key unit, shared with the board it is aiming at", () => {
    // The AC's "one source of truth" is the `KEY_ROWS` table for the lanes and
    // this custom property for the scale. Two declarations of it reachable
    // from THIS screen — one on the board, one on the field — is exactly how a
    // lane and a cap start disagreeing about how wide a key is. So the storm's
    // own block declares it nowhere at all: every rule under `.storm` reads
    // the root's value, and a falling letter has no second opinion available
    // to land by.
    expect(storm).not.toMatch(/--key:\s/);
    expect(/:root\s*{\s*--key:/.test(sheet)).toBe(true);

    // There is one other declaration in the stylesheet, and it is deliberately
    // not on a screen with lanes. `.race.typing` re-scales the dial to subtract
    // the chrome a passage screen carries above the board — the HUD, the bars,
    // the line you type on — because that chrome is a constant and a share of
    // the viewport cannot express it (§4.7, decision 63). It may, because the
    // board is the only thing on that screen that reads `--key` at all.
    //
    // Pinned at two rather than left open, so that a third has to be argued
    // for here first. The count is taken off `sheet` and not `css`: the prose
    // in this stylesheet quotes the property by name, and a test that counted
    // comments would be marking the explanation.
    expect(sheet.match(/--key:\s/g)).toHaveLength(2);
    expect(/\.race\.typing\s*{\s*--key:/.test(sheet)).toBe(true);
  });

  it("fills the viewport minus the ad band, and does not scroll while the storm is falling", () => {
    const field = /\.storm\s*{[^}]*}/.exec(storm)![0];

    // `height`, not `min-height`: a field that may grow is a field that
    // scrolls, and the letters would go on falling off screen.
    expect(field).toContain("height: calc(100dvh - var(--ad-h))");
    expect(field).not.toContain("min-height");
    expect(field).toContain("overflow: hidden");
  });

  it("lets the field scroll once the run is over, and only then", () => {
    // The rule above is the hazard while letters are falling; after the run it
    // is a different one, because what stands in the board's track by then is
    // the ending, and it is taller than the five rows of keycaps it replaced.
    // Measured in Chromium at 740×390 on a breached run, `.storm` wants 299px
    // of a 270px box — the sky has already given everything it has (§8.2) —
    // and the last button, which is the way off this screen for a child who is
    // not holding a mouse, is below the fold until this one declaration brings
    // it back. So it is asserted here rather than left to the comment beside
    // it: deleted, nothing else in the suite notices, and the screen keeps its
    // exit somewhere no thumb can reach.
    expect(declaration(".storm:has(.storm__over)", "overflow-y")).toBe("auto");

    // Lifted for the ending and for nothing else. Two overflow declarations in
    // the whole field: the field's own `hidden`, and this one asking `:has`. A
    // third — on the sky, on the board, or on a rule that forgot to ask — is
    // either a field that scrolls mid-run or a second opinion about when it
    // may, and both are read off this list rather than off any one selector.
    const overflows = [...storm.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(
      ([, selector, body]) =>
        [...body.matchAll(/(?:^|;)\s*(overflow[\w-]*)\s*:\s*([^;]+)/g)].map(
          ([, prop, value]) =>
            `${selector.trim()} { ${prop}: ${value.trim()} }`,
        ),
    );
    expect(overflows).toEqual([
      ".storm { overflow: hidden }",
      ".storm:has(.storm__over) { overflow-y: auto }",
    ]);

    // And it waits on a class something actually renders. `:has` is the whole
    // mechanism — a renamed panel is a selector that matches nothing, which
    // fails silently and only on the viewport where it mattered — so the
    // ending is drawn into the field it is scrolling, through the same `over`
    // slot the route fills, and the class is read back out of the markup.
    const dead: StormState = {
      ...frameOf(only("f", 3), 500),
      ending: { kind: "breached", finger: "l-index", index: 0 },
    };
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RaceProvider>
          <StormField
            state={dead}
            skyRef={{ current: null }}
            over={
              <StormOver
                state={dead}
                mode="typing:L39"
                profileId="p1"
                onRetry={() => {}}
              />
            }
          />
        </RaceProvider>
      </MemoryRouter>,
    );

    expect(html).toContain('class="storm"');
    expect(html).toContain('class="storm__over');
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
    // would be saying something was right about it. The shield and the HUD
    // borrow two, and only where they already mean what they mean everywhere
    // else on this site: `--flare` is a wrong, and damage, a hole and a wrong
    // key are the three wrongs this game has; `--lime` is a right, and both a
    // repair and a live combo are bought with a run of them (§8.5, §8.6). The
    // other three would each be a lie about what happened — nothing on this
    // screen is a ghost, a record or a badge.
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
      ".storm__miss",
      ".storm__zone[data-hole]",
    ]);
    expect(drawnWith("--lime")).toEqual([
      ".storm__combo[data-hot]",
      ".storm__mend",
    ]);
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
    // the reason a segment is allowed to overhang the DRAWN BOARD by the same
    // half gap at each end. The board, not the sky: the step-back moves the
    // whole rail left, so measured against the sky it hangs half a gap past
    // the left edge and stops half a gap short of the right. The caps are the
    // frame that matters — they are what the assertion below compares against,
    // and what a child aims at. Take the correction out and this fails by a
    // whole gap on one side.
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
    // Four letters, 300ms apart, each crossing the field in the fastest fall
    // the generator allows (`MIN_FALL_MS`, §8.10): they land at 800, 1100,
    // 1400 and 1700, so by 1150ms the first two are spent and the last two —
    // spawned at 600 and 900 — are still in the air.
    const state = frameOf(only("j", 4, MIN_FALL_MS), MIN_FALL_MS + 350);

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

  it("draws no keyboard at all, live or ended", () => {
    // A storm is the exam for the lessons that taught the layout (§8.1), so
    // the picture of the answer is the one thing this screen must not show:
    // the quickest way to shoot a falling `y` would become reading the board
    // for where `y` is, which is hunt-and-peck with a countdown on it
    // (decision 64).
    const live = draw(frameOf(only("f"), 500));
    expect(live).not.toContain("keyboard__key");
    expect(live).not.toContain('class="keyboard"');

    // Nor once the run is over, when the track it would have stood in is the
    // ending's. `KEYS` is imported for the lanes below and named here so that
    // a board creeping back in has a number to fail against.
    expect(KEYS.length).toBeGreaterThan(0);
    const dead = draw({
      ...frameOf(only("f", 3), 500),
      ending: { kind: "breached", finger: "l-index", index: 0 },
    } as StormState);
    expect(dead).not.toContain("keyboard__key");
  });

  it("hands the way out to the HUD, and says which key does it too", () => {
    // Forwarding, which is all this file does with it — where the control
    // goes and when it goes away are `StormHud`'s (§8.8, #155). What is worth
    // pinning here is that a screen which offers a destination gets one, and
    // that the key doing the same job is named for a child who cannot see the
    // button: while the gun is live, `Tab` is one of the keys it swallows.
    const live = frameOf(only("f"), 500);
    const html = renderToStaticMarkup(
      <StormField state={live} skyRef={{ current: null }} onQuit={() => {}} />,
    );

    expect(html).toContain("storm__quit");
    expect(html).toContain("press Escape to leave");
    // And a screen with nowhere to send them draws neither.
    expect(draw(live)).not.toContain("storm__quit");
  });

  it("says what the screen is, without reading out the hailstorm", () => {
    const html = draw(frameOf(only("f"), 500));

    /** The opening tag of the first element carrying a class, whole. */
    const tag = (cls: string) =>
      new RegExp(`<[a-z0-9]+[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`).exec(
        html,
      )?.[0] ?? "";

    expect(html).toContain("Hailstorm");

    // Everything that moves is hidden: the two HUD numbers, every stone and
    // the eight shield segments. None of it is an announcement anybody could
    // act on, and a live region reading out a hailstorm is a denial of service
    // rather than an accommodation (§4.4).
    for (const cls of [
      "storm__score",
      "storm__combo",
      "storm__letter",
      "storm__shield",
    ])
      expect(tag(cls), cls).toContain('aria-hidden="true"');

    // The sky itself is NOT, and that is the point of putting the attribute on
    // its parts (#155): the way out is drawn in the HUD, and a screen whose
    // only exit sat inside a hidden subtree would be a trap for the child
    // least able to get out of it.
    expect(tag("storm__sky")).not.toContain("aria-hidden");
  });
});
