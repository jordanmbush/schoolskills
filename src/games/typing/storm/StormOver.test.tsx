import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { RaceProvider } from "@/components/state/RaceContext";
import { FINGER_NAMES, keyX, strokeFor } from "@/engine/keyboard";
import { stormXp } from "@/engine/progress";
import { fire, startStorm, stormReport, tick } from "@/engine/typing/storm";

import { StormOver } from "./StormOver";

import type { StormLetter, StormState, WaveSpec } from "@/engine/typing/storm";

/**
 * The screen a child meets when the storm stops (docs/typing.md §8.5).
 *
 * What is on trial here is the WORDS, because the numbers are already decided:
 * `storm.test.ts` proves which finger let it through, how many it let through
 * and which keys that finger owns, and this file only asks whether the
 * sentence a five-year-old reads is the one those numbers make. Two of its
 * claims are acceptance criteria in their own right — the finger is named, and
 * nothing here is a grade.
 */

/** One letter, placed by hand, off the same board the game is played on. */
const at = (ch: string, spawnMs: number, fallMs: number): StormLetter => {
  const stroke = strokeFor(ch);
  if (!stroke || stroke.finger === "thumb")
    throw new Error(`${ch} cannot fall`);
  return {
    ch,
    code: stroke.code,
    shifted: stroke.shift !== null,
    finger: stroke.finger,
    lane: keyX(stroke.code) ?? 0,
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

const runOf = (letters: StormLetter[], over: Partial<WaveSpec> = {}) =>
  startStorm({
    spec: {
      keys: ["f", "o", "l", "j"],
      count: letters.length,
      gap: [300, 300],
      fall: [1000, 1000],
      shield: 1,
      repairAt: 0,
      ...over,
    },
    seed: 0,
    letters,
    durationMs: letters.reduce((last, l) => Math.max(last, l.landMs), 0),
  });

/**
 * The panel's markup. A router and a race context because the buttons are
 * navigation — a drill, a retry and the way out — and that is the whole of
 * what this screen does besides say what happened.
 */
const draw = (state: StormState) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <RaceProvider>
        <StormOver
          state={state}
          mode="typing:L39"
          profileId="p1"
          onRetry={() => {}}
        />
      </RaceProvider>
    </MemoryRouter>,
  );

/** The panel's text, with the markup taken out. */
const readOut = (state: StormState) =>
  draw(state)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** A run killed by the right ring finger, having let two through there. */
const BREACHED = tick(
  runOf([at("o", 0, 100), at("f", 100, 100), at("l", 200, 100)]),
  60_000,
);

/** The same wave, every letter shot, with the shield never touched. */
const CLEARED = ["KeyO", "KeyF", "KeyL"].reduce(
  (state, code) => fire(tick(state, 30), code),
  runOf([at("o", 0, 1000), at("f", 0, 1000), at("l", 0, 1000)], { shield: 2 }),
);

describe("StormOver", () => {
  it("draws nothing at all while the run is still going", () => {
    // The panel IS the ending. `StormField` only puts it where the board was
    // once the gun is dead, and this is that rule at the type level.
    const running = tick(runOf([at("f", 0, 1000)]), 400);
    expect(running.ending).toBeNull();
    expect(draw(running)).toBe("");
  });

  it("names the finger that let it through, and how many", () => {
    // The story, in one line: a child is told whose fault it was on their own
    // hand, in words they can look down at.
    expect(BREACHED.ending).toEqual({
      kind: "breached",
      finger: "r-ring",
      index: 2,
    });
    expect(readOut(BREACHED)).toContain("Your right ring finger");
    expect(readOut(BREACHED), "the o and the l").toContain("let 2 letters");
    expect(FINGER_NAMES["r-ring"], "and it is the engine's word").toBe(
      "right ring finger",
    );
  });

  it("says one letter rather than 1 letters", () => {
    const one = tick(runOf([at("f", 0, 100), at("f", 200, 100)]), 60_000);
    expect(stormReport(one)?.breach?.through).toBe(2);
    const alone = tick(runOf([at("f", 0, 100)], { shield: 0 }), 60_000);
    expect(readOut(alone)).toContain("let 1 letter through");
  });

  it("offers that finger's keys, and a way to go and practise them", () => {
    const html = draw(BREACHED);
    // `o` and `l` are the right ring finger's; `f` and `j` are not, and the
    // wave's pool has both — so this is the zone and not the whole storm.
    expect(readOut(BREACHED)).toContain("Its keys: o l");
    expect(html).toContain("Practise that finger");
  });

  it("offers the same storm again, and the way out", () => {
    // A wave is replayable from its seed (§8.3), so "again" can mean the storm
    // that beat you rather than another one.
    expect(draw(BREACHED)).toContain("Try this wave again");
    expect(draw(BREACHED)).toContain("Back to the ladder");
  });

  it("has no grade in it, on the worst run there is", () => {
    // The acceptance criterion, as the three things that would break it: a
    // word that marks the child rather than the weather, a percentage, and the
    // telemetry red that means "you got that wrong" everywhere else on this
    // site (§8.5). What is on screen instead is what the storm did.
    const html = draw(BREACHED);
    const text = readOut(BREACHED);

    expect(text).toContain("The storm got through");
    for (const shaming of ["fail", "Fail", "lost", "Lost", "%", "wrong"])
      expect(text, shaming).not.toContain(shaming);
    expect(html, "no telemetry red").not.toContain("flare");
    // The finger's own hue is the one colour here, and it is identity rather
    // than judgement — the same block that broke, the same keys under it.
    expect(html).toContain('data-finger="r-ring"');
  });

  it("shows what a losing run still earned", () => {
    // XP cannot go down (§8.6), so a run that ended early has something honest
    // to say to a child who has just lost — and it is the one figure on this
    // screen that can only ever have gone up. An `o` through the right ring
    // zone, an `f` shot clean, and then the `l` into the hole the o made.
    const paid = tick(
      fire(
        tick(
          runOf([at("o", 0, 100), at("f", 200, 1000), at("l", 400, 100)]),
          300,
        ),
        "KeyF",
      ),
      60_000,
    );

    expect(paid.ending?.kind).toBe("breached");
    expect(stormXp(paid), "the letter it did shoot").toBeGreaterThan(0);
    expect(readOut(paid)).toContain(`+${stormXp(paid)} XP earned`);
    expect(readOut(paid)).toContain(`${paid.score} Score`);
  });

  it("says a cleared wave was cleared, with the shield it came through on", () => {
    expect(CLEARED.ending).toEqual({ kind: "cleared" });
    const text = readOut(CLEARED);

    expect(text).toContain("Wave cleared");
    expect(text).toContain("Nothing got past you");
    // Eight zones of two, none of them spent — and the best streak, the score
    // and the payout beside it.
    expect(text).toContain("16 /16");
    expect(text).toContain("Shield left");
    expect(text).toContain("Best combo");
    expect(text).toContain(String(stormReport(CLEARED)?.bestCombo));
    expect(text).toContain(`+${stormXp(CLEARED)}`);

    // Nothing to practise, because no finger let anything through.
    expect(draw(CLEARED)).not.toContain("Practise that finger");
    expect(draw(CLEARED)).toContain("Try this wave again");
  });

  it("says what a shield that was hit and held came to", () => {
    // Cleared is "every letter resolved", which a run can reach with letters
    // through it — so the line has to be about what the shield took rather
    // than about a clean sheet it did not have.
    const held = tick(
      runOf([at("f", 0, 100)], { count: 1, shield: 3 }),
      60_000,
    );
    expect(held.ending).toEqual({ kind: "cleared" });
    expect(readOut(held)).toContain("Your shield took 1 letter and held");
    expect(readOut(held)).toContain("23 /24");
  });
});
