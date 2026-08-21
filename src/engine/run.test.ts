import { describe, expect, it } from "vitest";

import type { CardResult, FlashConfig, Ghost, Profile, Session } from "./types";

import { levelFromXp } from "./progress";
import { summariseRun, type RunTally } from "./run";

/**
 * What a finished race is worth, decided away from the render tree.
 *
 * This was inline in `RaceTrack`, and the reason it moved is the reason it is
 * worth testing: the results screen, the record book and the badge shelf all
 * read the same summary, so a rule that only exists inside a component is a
 * rule three screens can disagree about.
 *
 * `compareRuns` and `evaluateBadges` have their own suites and are not re-tested
 * here. What is tested is the wiring: which numbers this hands them, and what it
 * does with the answers — a summary that judged badges on the XP a player had
 * *before* the race, or that read "no previous best" as "beat your best", would
 * satisfy both of those suites and still pay a seven-year-old for nothing.
 */

const ada: Profile = {
  id: "kid-1",
  name: "Ada",
  emoji: "🚀",
  color: "#7c3aed",
  age: 7,
  soundOn: true,
  xp: 340,
  badges: ["green-light"],
  createdAt: "2026-03-01T09:00:00.000Z",
};

const config: FlashConfig = {
  operation: "multiply",
  tables: [7],
  others: [8],
  cardCount: 3,
  inputMode: "type",
};

/** The key that config has always produced — transcribed, not computed. */
const CONFIG_KEY = "multiply|7|8|3|type";

const card = (ms: number, ok: boolean): CardResult => ({
  prompt: "7 × 8",
  answer: "56",
  given: ok ? "56" : "54",
  ok,
  ms,
  factId: "7:8",
});

/** Two right and one wrong, 3.7 seconds of clock between them. */
const tally = (over: Partial<RunTally> = {}): RunTally => ({
  cards: [card(1000, true), card(1200, true), card(1500, false)],
  cardXp: 120,
  bestStreak: 2,
  maxDeficitMs: 0,
  ...over,
});

/** A run already in the book, at whatever pace the case needs. */
const past = (over: Partial<Session> = {}): Session => ({
  id: "s_old",
  profileId: ada.id,
  game: "flashcards",
  mode: "multiply",
  configKey: CONFIG_KEY,
  config,
  seed: 1,
  finishedAt: "2026-03-01T09:00:00.000Z",
  durationMs: 9000,
  correct: 3,
  incorrect: 0,
  bestStreak: 3,
  xpEarned: 100,
  ghostSessionId: null,
  beatGhost: null,
  cards: [],
  ...over,
});

const ghostOf = (session: Session): Ghost => ({
  session,
  profile: ada,
  isSelf: true,
});

/** A solo, untimed, unremarkable race, with the case's own details laid over. */
const summarise = (over: Partial<Parameters<typeof summariseRun>[0]> = {}) =>
  summariseRun({
    profile: ada,
    config,
    seed: 42,
    ghost: null,
    history: [],
    previousBest: null,
    tally: tally(),
    ...over,
  });

describe("summarising a run", () => {
  it("hands the session service a draft it can save as it stands", () => {
    const { draft } = summarise();

    expect(draft).toMatchObject({
      profileId: ada.id,
      game: "flashcards",
      mode: "multiply",
      configKey: CONFIG_KEY,
      config,
      seed: 42,
    });
    // The clock is the cards added up, not a wall-clock reading: a race paused
    // for lunch is still the time it took to answer.
    expect(draft.durationMs).toBe(3700);
    // Counted off the cards rather than off `cardCount`, which is what was
    // asked for and not what was answered — a quit run has fewer.
    expect(draft.correct).toBe(2);
    expect(draft.incorrect).toBe(1);
    expect(draft.cards).toHaveLength(3);
    expect(draft.bestStreak).toBe(2);
  });

  it("pays the XP the cards earned when nothing else was won", () => {
    const { draft, bonuses } = summarise();
    expect(bonuses).toEqual([]);
    expect(draft.xpEarned).toBe(120);
  });

  it("doesn't call a player's first run at a setting a record", () => {
    // There is nothing to have beaten. Reading "no previous best" as a record
    // would pay 150 XP and a badge for every first race a child ever ran.
    const { personalRecord, bonuses, draft } = summarise({
      previousBest: null,
    });
    expect(personalRecord).toBe(false);
    expect(bonuses).toEqual([]);
    expect(draft.xpEarned).toBe(120);
  });

  it("pays for a personal best, and adds it to the XP", () => {
    const { personalRecord, bonuses, draft } = summarise({
      // 3.7s plus one 3s penalty beats nine seconds.
      previousBest: past({ durationMs: 9000 }),
    });
    expect(personalRecord).toBe(true);
    expect(bonuses).toEqual([{ label: "Personal best", xp: 150 }]);
    expect(draft.xpEarned).toBe(120 + 150);
  });

  it("doesn't pay for a slower run than the one on record", () => {
    const { personalRecord, bonuses } = summarise({
      previousBest: past({ durationMs: 5000 }),
    });
    expect(personalRecord).toBe(false);
    expect(bonuses).toEqual([]);
  });

  it("ranks a timed run on cards beaten, not on the clock", () => {
    // Under a per-card clock the total time can't run away, so the run that
    // beat the clock more often wins — `compareRuns` owns that rule, and this
    // is the case that says a summary asks it rather than comparing times
    // itself. Twice as fast, one card fewer: still not a record.
    const timed = { ...config, timeLimitMs: 5000 };
    const { personalRecord } = summarise({
      config: timed,
      previousBest: past({
        config: timed,
        durationMs: 20_000,
        correct: 3,
        incorrect: 0,
      }),
    });
    expect(personalRecord).toBe(false);
  });

  it("says there was nobody to race, rather than that they lost", () => {
    // `null`, not `false`. The record book renders the two differently, and a
    // solo run recorded as a loss is a rival a child never had.
    const { beatGhost, draft } = summarise({ ghost: null });
    expect(beatGhost).toBeNull();
    expect(draft.beatGhost).toBeNull();
    expect(draft.ghostSessionId).toBeNull();
  });

  it("records which run was raced, and whether it was beaten", () => {
    const rival = past({ id: "s_rival", durationMs: 9000 });
    const { beatGhost, bonuses, draft } = summarise({
      ghost: ghostOf(rival),
    });

    expect(beatGhost).toBe(true);
    // The id is kept so the results screen can name the run that was raced,
    // years later and after the rival's own best has moved on.
    expect(draft.ghostSessionId).toBe("s_rival");
    expect(bonuses).toEqual([{ label: "Beat your rival", xp: 100 }]);
  });

  it("pays for a clean sheet by the size of the deck", () => {
    const { bonuses, draft } = summarise({
      tally: tally({ cards: [card(900, true), card(800, true)] }),
    });
    expect(bonuses).toEqual([{ label: "No mistakes", xp: 50 + 2 * 5 }]);
    expect(draft.xpEarned).toBe(120 + 60);
  });

  it("doesn't call a race with no cards in it perfect", () => {
    // A run quit on the first card has no mistakes in it either. Paying it a
    // clean sheet would make quitting the cheapest XP in the game.
    const { bonuses } = summarise({ tally: tally({ cards: [] }) });
    expect(bonuses).toEqual([]);
  });
});

/**
 * The XP a player is holding the moment they reach level 10, asked of the
 * curve rather than transcribed: `levelFromXp` owns the formula, and a test
 * that copied the number would go on passing after the curve moved.
 *
 * `toNext` is the gap to the next level's floor, so adding it lands exactly on
 * that floor — nine steps from zero to the level-10 line.
 */
const LEVEL_10_XP = (() => {
  let xp = 0;
  while (levelFromXp(xp).level < 10) xp += levelFromXp(xp).toNext;
  return xp;
})();

describe("the badges a run earns", () => {
  it("tells the player what is new to them, and the service what they hold", () => {
    const { earnedBadges, newBadges } = summarise();
    // Ada already has "green-light", so it stays in what gets saved and drops
    // out of what the results screen crows about. Awarding it again would pop
    // a "new badge!" for something she earned months ago.
    expect(earnedBadges).toContain("green-light");
    expect(newBadges).not.toContain("green-light");
  });

  it("hands the personal best it just decided to the badge rules", () => {
    const history = [past({ id: "s_1" })];
    const beaten = past({ durationMs: 9000 });

    // "Record Setter" needs both halves: a best that was beaten, and an
    // earlier run at these exact settings to have beaten. Only this function
    // knows the first, so a summary that judged badges without passing it in
    // would silently stop awarding the badge.
    expect(summarise({ previousBest: beaten, history }).earnedBadges).toContain(
      "record-setter",
    );
    expect(
      summarise({ previousBest: past({ durationMs: 1000 }), history })
        .earnedBadges,
    ).not.toContain("record-setter");
  });

  it("hands over how far behind the player ever fell", () => {
    const rival = ghostOf(past({ id: "s_rival", durationMs: 9000 }));

    // "Comeback" is a badge about the shape of a race rather than its result,
    // and the shape is only known to the loop that counted it — nothing in the
    // saved session records the deficit.
    expect(
      summarise({ ghost: rival, tally: tally({ maxDeficitMs: 4000 }) })
        .earnedBadges,
    ).toContain("comeback");
    expect(
      summarise({ ghost: rival, tally: tally({ maxDeficitMs: 500 }) })
        .earnedBadges,
    ).not.toContain("comeback");
  });

  it("judges the level badge on the XP the player leaves with", () => {
    // `xpAfter` is the only thing "Double Digits" is decided on, and the
    // profile handed in still holds the XP from *before* this race. A summary
    // that passed `profile.xp` straight through would hold the badge back
    // until the next race — a level-up the child watched happen, paid late.
    const cardXp = 120;
    const onTheLine = { ...ada, xp: LEVEL_10_XP - cardXp };

    expect(
      summarise({ profile: onTheLine, tally: tally({ cardXp }) }).earnedBadges,
    ).toContain("level-10");
    // And one XP short of the line is still short of it, so the case above is
    // pinning the crossing rather than a threshold that is always met.
    expect(
      summarise({
        profile: { ...onTheLine, xp: onTheLine.xp - 1 },
        tally: tally({ cardXp }),
      }).earnedBadges,
    ).not.toContain("level-10");
  });

  it("counts the cards a player had answered before this race", () => {
    // The history is snapshotted before this run exists, so the lifetime count
    // has to add this race to it. Ninety-nine cards behind them and three in
    // front: the hundredth is in this race.
    const history = [
      past({
        id: "s_1",
        cards: Array.from({ length: 99 }, () => card(900, true)),
      }),
    ];
    expect(summarise({ history }).earnedBadges).toContain("century");
    expect(summarise({ history: [] }).earnedBadges).not.toContain("century");
  });
});
