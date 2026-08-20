import { describe, expect, it } from "vitest";

import { buildDrill, configKey, deckSpec, modeOf } from "@/engine/decks";
import { keyX, strokeFor } from "@/engine/keyboard";
import { stormXp } from "@/engine/progress";
import { troubleFacts } from "@/engine/records";
import { summariseRun } from "@/engine/run";
import { lessonById } from "@/engine/typing/lessons";
import { fire, startStorm, stormReport, tick } from "@/engine/typing/storm";
import { verdictFor } from "@/engine/typing/verdict";

import { stormCards, stormConfig, stormTally } from "./stormSession";

import type { StormLetter, StormState, WaveSpec } from "@/engine/typing/storm";
import type { Profile, Session } from "@/engine/types";

/**
 * A storm, as a `Session` (docs/typing.md §8.7, decision 23).
 *
 * What is on trial here is the MAPPING, because the run itself is already
 * decided: `storm.test.ts` proves what was shot, what got through and on what
 * streak, and this file asks only whether the record book is told the truth
 * about it. Four of its claims are acceptance criteria in their own right —
 * a letter is a `CardResult`, a run that ends early saves honestly, `configKey`
 * keys on the lesson rather than on how far a child got, and nothing
 * downstream needs a line of new code.
 */

const LESSON = "L39";
const MODE = modeOf({
  kind: "typing",
  levelId: LESSON,
  lessonId: LESSON,
  wordCount: 1,
});

/** One letter, placed by hand, off the same board the game is played on. */
const at = (ch: string, spawnMs: number, fallMs: number): StormLetter => {
  const stroke = strokeFor(ch);
  if (!stroke || stroke.finger === "thumb")
    throw new Error(`${ch} cannot fall`);
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

const runOf = (letters: StormLetter[], over: Partial<WaveSpec> = {}) =>
  startStorm({
    spec: {
      keys: ["f", "o", "l", "j"],
      count: letters.length,
      gap: [100, 100],
      fall: [1000, 1000],
      shield: 3,
      repairAt: 0,
      ...over,
    },
    seed: 353,
    letters,
    durationMs: letters.reduce((last, l) => Math.max(last, l.landMs), 0),
  });

/** `n` letters of `f`, one every 100ms, each a second in the air. */
const drumbeat = (n: number, over: Partial<WaveSpec> = {}) =>
  runOf(
    Array.from({ length: n }, (_, i) => at("f", i * 100, 1000)),
    over,
  );

const PLAYER: Profile = {
  id: "p1",
  name: "Smoke",
  emoji: "🐢",
  color: "#4ade80",
  age: 8,
  soundOn: false,
  xp: 0,
  badges: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

/** The run as `useRaceFinish` would hand it to the session service. */
const draftOf = (state: StormState, history: Session[] = []) =>
  summariseRun({
    profile: PLAYER,
    config: stormConfig(LESSON, state.wave),
    seed: state.wave.seed,
    ghost: null,
    history,
    previousBest: null,
    tally: stormTally(state),
  });

/** A draft, given the id and time the session service would give it. */
const asSaved = (state: StormState): Session => ({
  ...draftOf(state).draft,
  id: "s1",
  finishedAt: "2026-08-19T10:00:00.000Z",
});

describe("a falling letter is a CardResult", () => {
  it("is its own character, and what was pressed at it", () => {
    // Shot 300ms into a one-second fall.
    const shot = fire(tick(runOf([at("f", 0, 1000)]), 300), "KeyF");
    const [card] = stormCards(shot);

    expect(card).toEqual({
      prompt: "f",
      answer: "f",
      given: "f",
      ok: true,
      ms: 300,
      factId: "f",
    });
    // A letter that was hit is not a timeout, and carries no such field at all
    // — `toEqual` above would pass on an explicit `undefined`.
    expect("timedOut" in card).toBe(false);
  });

  it("is a timeout with nothing pressed at it when it gets through", () => {
    const through = tick(runOf([at("f", 0, 1000)]), 60_000);
    const [card] = stormCards(through);

    expect(card).toEqual({
      prompt: "f",
      answer: "f",
      given: null,
      ok: false,
      // The fall, not the sixty seconds the tick was handed.
      ms: 1000,
      factId: "f",
      // The clock a falling letter runs out is its own fall (§8.7), which is
      // what puts it above a wrong answer in `troubleFacts`.
      timedOut: true,
    });
  });

  it("times the fall, not the tick that noticed it", () => {
    // A backgrounded tab hands back seconds, and `tick` resolves every landing
    // inside the interval it is given (decision 35). A card timed off the
    // clock would put nine seconds in a child's record book for a letter that
    // was in the air for one.
    const stalled = tick(runOf([at("f", 0, 1000)]), 9_000);
    expect(stalled.timeMs).toBe(9_000);
    expect(stormCards(stalled)[0].ms).toBe(1000);
  });

  it("counts what `resolved` says, and never what `hasLanded` does", () => {
    // The letter at index 2 lands on the same millisecond as the one that
    // breaches, so the clock reads it as landed while the run ended before it.
    // Counting the clock would put a card in the record book for a letter this
    // child never faced.
    const state = tick(
      runOf([at("f", 0, 1000), at("f", 0, 2000), at("f", 0, 2000)], {
        shield: 1,
      }),
      60_000,
    );

    expect(state.ending).toEqual({
      kind: "breached",
      finger: "l-index",
      index: 1,
    });
    expect(state.timeMs).toBe(2000);
    expect(state.resolved[2]).toBeNull();
    expect(stormCards(state)).toHaveLength(2);
  });
});

describe("a run that ends early", () => {
  /**
   * §8.7's own example: dying at letter 18 of 40 saves a session with 18
   * cards, `correct`, `incorrect` and `durationMs` all honest, and the
   * `survive` criterion simply not met.
   *
   * Four shot at the front, then thirteen landings empty the zone and the
   * fourteenth is the one nothing was left to stop.
   */
  const died = (() => {
    let state = drumbeat(40, { shield: 13 });
    for (let i = 0; i < 4; i++) state = fire(tick(state, 100), "KeyF");
    return tick(state, 60_000);
  })();

  it("saves the letters it faced and no more", () => {
    expect(died.ending).toMatchObject({ kind: "breached", index: 17 });
    expect(stormCards(died)).toHaveLength(18);
  });

  it("is honest about all four numbers", () => {
    const { draft } = draftOf(died);

    expect(draft.cards).toHaveLength(18);
    expect(draft.correct).toBe(4);
    expect(draft.incorrect).toBe(14);
    // Four shots a tenth of a second in, and fourteen full falls.
    expect(draft.durationMs).toBe(4 * 100 + 14 * 1000);
  });

  it("does not pass the lesson it did not survive", () => {
    const lesson = lessonById(LESSON);
    if (!lesson) throw new Error("lesson 39 is missing");

    const verdict = verdictFor(asSaved(died), lesson);
    expect(lesson.pass.kind).toBe("storm");
    expect(verdict.passed).toBe(false);
  });

  it("passes the same lesson on a wave it cleared", () => {
    const lesson = lessonById(LESSON);
    if (!lesson) throw new Error("lesson 39 is missing");

    // Every letter shot, so the wave is cleared and the accuracy bar is full.
    let state = drumbeat(6);
    for (let i = 0; i < 6; i++) state = fire(tick(state, 100), "KeyF");

    expect(state.ending).toEqual({ kind: "cleared" });
    expect(verdictFor(asSaved(state), lesson).passed).toBe(true);
  });
});

describe("what a storm files itself as", () => {
  it("keys on the lesson, not on how many letters were survived", () => {
    // The acceptance criterion, as two runs of one wave: a child who cleared
    // it and a child who died at letter four have to land in the same bucket,
    // or a retry could never be compared with the run it is a retry of.
    let cleared = drumbeat(6);
    for (let i = 0; i < 6; i++) cleared = fire(tick(cleared, 100), "KeyF");
    const died = tick(drumbeat(6, { shield: 3 }), 60_000);

    expect(stormCards(cleared)).toHaveLength(6);
    expect(stormCards(died)).toHaveLength(4);

    const key = configKey(stormConfig(LESSON, cleared.wave));
    expect(key).toBe(configKey(stormConfig(LESSON, died.wave)));
    // The wave's own length, and the lesson's id. Neither moves with the run.
    expect(key).toBe("typing|L39|6");
  });

  it("carries the wave's length rather than the ladder's placeholder", () => {
    const config = stormConfig(LESSON, drumbeat(12).wave);

    expect(config).toEqual({
      kind: "typing",
      levelId: LESSON,
      lessonId: LESSON,
      wordCount: 12,
    });
    // The rung itself still says 0 — a storm level's `wordCount` is its wave's
    // `count` (§8.3) and the twenty `WaveSpec`s land in STM10 — so the wave in
    // hand is the only honest place to read a run's length from today.
    expect(lessonById(LESSON)?.wordCount).toBe(0);
  });

  it("names itself in a record book years later", () => {
    expect(modeOf(stormConfig(LESSON, drumbeat(3).wave))).toBe("typing:L39");
    expect(deckSpec(MODE).label).toBe(
      "Lesson 39 · Hailstorm · Shift under fire",
    );
    expect(deckSpec(MODE).world).toBe("ice");
  });
});

describe("what `incorrect` counts", () => {
  /**
   * **Letters that got through, and not keys that missed** (decision 48).
   *
   * A wrong key resolves no letter, so it is not a card — the same bargain
   * decision 13 struck for the lessons, where a keystroke backspaced away
   * costs nothing because what ended up on the line is right. Two things hang
   * on it, and both would break if a miss were given a card of its own:
   * `survived` is `cards.length >= wordCount`, so a run that died at letter
   * three and sprayed forty wrong keys would read as having faced the whole
   * wave; and the `unbroken` badge reads "nothing marked wrong" as "nothing
   * got through", which is the sentence its own description makes.
   */
  it("is not moved by a wrong key", () => {
    let state = drumbeat(3);
    // Three hits, with two wrong keys in the middle of them. `j` is on the
    // board and on no letter in this wave.
    state = fire(tick(state, 100), "KeyF");
    state = fire(state, "KeyJ");
    state = fire(state, "KeyJ");
    state = fire(tick(state, 100), "KeyF");
    state = fire(tick(state, 100), "KeyF");

    expect(state.misses).toBe(2);
    expect(state.ending).toEqual({ kind: "cleared" });

    const { draft } = draftOf(state);
    expect(draft.cards).toHaveLength(3);
    expect(draft.correct).toBe(3);
    expect(draft.incorrect).toBe(0);
  });

  it("is exactly what the ending screen calls got through", () => {
    // `stormReport.through` is the number the panel says out loud, and "the
    // shield came through untouched" is that number being zero (§8.5). So a
    // saved run's `incorrect` and the sentence a child just read are the same
    // fact, which is what keeps the `unbroken` badge's promise honest.
    const runs = [
      tick(drumbeat(6, { shield: 3 }), 60_000),
      tick(drumbeat(3), 60_000),
      // Every letter shot, so nothing got through and nothing is marked wrong.
      ["KeyF", "KeyF"].reduce(
        (state) => fire(tick(state, 100), "KeyF"),
        drumbeat(2),
      ),
    ];

    for (const state of runs) {
      const report = stormReport(state);
      if (!report) throw new Error("a finished run has a report");
      expect(draftOf(state).draft.incorrect).toBe(report.through);
    }
  });

  it("keeps a wrong key's cost in the streak it broke", () => {
    // Nothing about a miss is thrown away: the combo it cost is a combo
    // `bestStreak` never sees, which is how a saved run remembers it.
    let clean = drumbeat(4);
    for (let i = 0; i < 4; i++) clean = fire(tick(clean, 100), "KeyF");

    let broken = drumbeat(4);
    broken = fire(tick(broken, 100), "KeyF");
    broken = fire(tick(broken, 100), "KeyF");
    broken = fire(broken, "KeyJ");
    broken = fire(tick(broken, 100), "KeyF");
    broken = fire(tick(broken, 100), "KeyF");

    expect(stormTally(clean).bestStreak).toBe(4);
    expect(stormTally(broken).bestStreak).toBe(2);
    expect(draftOf(broken).draft.bestStreak).toBe(2);
  });
});

describe("the `unbroken` badge, over a wave the reducer really played", () => {
  /**
   * "Clear a Hailstorm wave with the shield untouched" is read in
   * `progress.ts` as `incorrect === 0`, and the mapping above is what decides
   * which of two badges that sentence describes. Counting wrong keys into
   * `incorrect` would have re-tuned it from **untouched shield** to
   * **flawless run** — a behaviour change invisible in a diff that never
   * touches `progress.ts`. These two pin the meaning that shipped.
   *
   * The rung's own `wordCount` is lent for the length of the test, exactly as
   * `progress.test.ts` does: the badge is guarded on the wave having a length
   * (decision 29) and the twenty `WaveSpec`s land in STM10, so nothing can
   * earn it today.
   */
  const withWave = (count: number, body: () => void) => {
    const of = lessonById(LESSON);
    if (!of) throw new Error("lesson 39 is missing");
    const was = of.wordCount;
    of.wordCount = count;
    try {
      body();
    } finally {
      of.wordCount = was;
    }
  };

  /** Ten letters, all shot, with three wrong keys scattered through them. */
  const sprayed = (() => {
    let state = drumbeat(10);
    for (let i = 0; i < 10; i++) {
      state = fire(tick(state, 100), "KeyF");
      if (i % 4 === 0) state = fire(state, "KeyJ");
    }
    return state;
  })();

  /** The same ten with the first one let through, and the rest shot. */
  const holed = (() => {
    let state = tick(drumbeat(10), 1000);
    for (let i = 1; i < 10; i++) state = fire(state, "KeyF");
    return state;
  })();

  it("is earned by a run full of wrong keys that let nothing through", () => {
    expect(sprayed.misses).toBe(3);
    expect(sprayed.ending).toEqual({ kind: "cleared" });
    expect(draftOf(sprayed).draft.incorrect).toBe(0);

    withWave(10, () => {
      expect(draftOf(sprayed).earnedBadges).toContain("unbroken");
    });
  });

  it("is refused by a clean run that let one letter through", () => {
    // Nine of ten is exactly the storm accuracy bar, so this run passes the
    // lesson and is refused the badge on the letter alone — which is the half
    // of the rule the mapping decides.
    expect(holed.ending).toEqual({ kind: "cleared" });
    expect(draftOf(holed).draft.incorrect).toBe(1);

    withWave(10, () => {
      const lesson = lessonById(LESSON);
      if (!lesson) throw new Error("lesson 39 is missing");
      expect(verdictFor(asSaved(holed), lesson).passed).toBe(true);
      expect(draftOf(holed).earnedBadges).not.toContain("unbroken");
    });
  });
});

describe("nothing downstream needs a line of new code", () => {
  it("scores through `summariseRun` like any other run", () => {
    let state = drumbeat(5);
    for (let i = 0; i < 5; i++) state = fire(tick(state, 100), "KeyF");

    const summary = draftOf(state);
    expect(summary.draft.mode).toBe("typing:L39");
    expect(summary.draft.configKey).toBe("typing|L39|5");
    expect(summary.draft.seed).toBe(353);
    expect(summary.draft.ghostSessionId).toBeNull();
    expect(summary.draft.beatGhost).toBeNull();
    // A storm is never a personal best (decision 50): `previousBest` is null,
    // so a run that ended at letter three can never be ranked above one that
    // cleared the wave on the strength of having taken less time.
    expect(summary.personalRecord).toBe(false);
  });

  it("pays the run's own XP, plus whatever a flawless run is worth", () => {
    let state = drumbeat(5);
    for (let i = 0; i < 5; i++) state = fire(tick(state, 100), "KeyF");

    const summary = draftOf(state);
    const bonus = summary.bonuses.reduce((sum, b) => sum + b.xp, 0);

    expect(stormXp(state)).toBeGreaterThan(0);
    expect(summary.draft.xpEarned).toBe(stormXp(state) + bonus);
    // The one bonus a storm can reach, and only by letting nothing through.
    expect(summary.bonuses.map((b) => b.label)).toEqual(["No mistakes"]);
  });

  it("earns badges through the evaluator every race goes through", () => {
    let state = drumbeat(5);
    for (let i = 0; i < 5; i++) state = fire(tick(state, 100), "KeyF");

    expect(draftOf(state).earnedBadges).toContain("green-light");
    expect(draftOf(state).earnedBadges).toContain("clean-sheet");
  });

  it("feeds the drill builder one trouble spot per character", () => {
    // The letters that got through, ranked worst-first and handed to the same
    // front door the record book's drill button uses. A fact id in a typing
    // deck is a character, so the drill comes back as a passage of the keys a
    // child keeps losing letters on.
    const state = tick(
      runOf([at("o", 0, 1000), at("l", 100, 1000), at("f", 200, 1000)]),
      60_000,
    );
    const trouble = troubleFacts([asSaved(state)], MODE);

    expect(trouble.map((fact) => fact.factId).sort()).toEqual(["f", "l", "o"]);
    expect(trouble.every((fact) => fact.timeouts === 1)).toBe(true);

    const drill = buildDrill(
      trouble.map((fact) => fact.factId),
      MODE,
      { inputMode: "type", timeLimitMs: null },
    );
    expect(drill.kind).toBe("typing");
    expect(drill.kind === "typing" && drill.words?.sort()).toEqual([
      "f",
      "l",
      "o",
    ]);
  });
});
