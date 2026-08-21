import { describe, expect, it } from "vitest";

import type { CardResult, KeyboardMode, Session } from "@/engine/types";

import { typingMode } from "@/engine/decks/typing";
import { BADGES, evaluateBadges } from "./progress";
import { LESSONS, type Lesson } from "./typing/lessons";

/**
 * What the badge shelf has to prove (docs/typing.md §6.7).
 *
 * Two jobs, and the first one is the reason this file exists at all:
 *
 *   - **Nothing that shipped may move.** A badge id is written into
 *     `Profile.badges` the moment it is earned, in IndexedDB on a child's own
 *     device, and that is the only copy there is. Renaming `ghost-buster` does
 *     not rename anyone's badge — it deletes it, silently, on a shelf nobody is
 *     watching. So the whole table is frozen below, and the triggers that were
 *     here before the typing course are re-run underneath it.
 *   - **The five new ones fire on what they say they fire on.** `eyes-up`
 *     carries the epic's argument — it is the only badge on the site that
 *     rewards doing the work the harder way — and the way to get it wrong is
 *     to award it for the ten checkpoints, which force the keyboard off
 *     whatever the child wanted. That inversion has a test of its own.
 */

/* ── The runs ────────────────────────────────────────────────────────────── */

const card = (answer: string, given: string | null, ms = 400): CardResult => ({
  prompt: answer,
  answer,
  given,
  ok: given === answer,
  ms,
  factId: answer,
});

let saved = 0;

/** A flash-card race, filed as the flash-card island files one. */
function race(
  cards: CardResult[],
  extra: Partial<Session> = {},
): Omit<Session, "id" | "finishedAt"> {
  const correct = cards.filter((c) => c.ok).length;
  return {
    profileId: "p1",
    game: "flashcards",
    mode: "multiply",
    configKey: "multiply|2|1-12|type",
    config: {
      operation: "multiply",
      tables: [2],
      others: [1, 2, 3, 4, 5],
      cardCount: cards.length,
      inputMode: "type",
    },
    seed: 7,
    durationMs: cards.reduce((sum, c) => sum + c.ms, 0),
    correct,
    incorrect: cards.length - correct,
    bestStreak: correct,
    xpEarned: 0,
    ghostSessionId: null,
    beatGhost: null,
    cards,
    ...extra,
  };
}

/** The same, saved — history is sessions that already have an id and a date. */
const asSaved = (draft: Omit<Session, "id" | "finishedAt">): Session => ({
  ...draft,
  id: `s${(saved += 1)}`,
  finishedAt: "2026-08-19T10:00:00.000Z",
});

const byN = new Map(LESSONS.map((l) => [l.n, l]));
const lesson = (n: number): Lesson => {
  const found = byN.get(n);
  if (!found) throw new Error(`no lesson ${n}`);
  return found;
};

/**
 * A run of a lesson, filed exactly as the typing island files one: `typing:L41`
 * for its mode, the lesson's own `wordCount` in the config (that is half the
 * ghost key, §5.4), and `keyboard` present only when the brief handed a choice
 * over.
 *
 * `durationMs` is worked back from the words per minute wanted, so a test can
 * sit a run exactly on a lesson's speed bar or exactly one under it.
 */
function lessonRun(
  of: Lesson,
  cards: CardResult[],
  {
    wpm,
    keyboard,
    wordCount = of.wordCount,
  }: { wpm?: number; keyboard?: KeyboardMode; wordCount?: number } = {},
): Omit<Session, "id" | "finishedAt"> {
  const correct = cards.filter((c) => c.ok).length;
  // Five characters is a word, plus the space that committed each one — the
  // same count `wordsPerMinute` makes.
  const characters = cards.reduce((sum, c) => sum + c.answer.length + 1, 0);
  return {
    profileId: "p1",
    game: "flashcards",
    mode: typingMode(of.id),
    configKey: `typing|${of.id}|${of.wordCount}`,
    config: {
      kind: "typing",
      levelId: of.id,
      lessonId: of.id,
      wordCount,
      ...(keyboard ? { keyboard } : {}),
    },
    seed: 7,
    durationMs: wpm ? (characters / 5) * (60_000 / wpm) : 60_000,
    correct,
    incorrect: cards.length - correct,
    bestStreak: correct,
    xpEarned: 0,
    ghostSessionId: null,
    beatGhost: null,
    cards,
  };
}

/** Every word right, at exactly the speed the lesson asks for. */
const passing = (of: Lesson, keyboard?: KeyboardMode) =>
  lessonRun(
    of,
    ["all", "flask", "glad", "shall", "gall"].map((w) => card(w, w)),
    { wpm: of.pass.kind === "lesson" ? of.pass.wpm : undefined, keyboard },
  );

/** Fast enough and nowhere near accurate enough. */
const failing = (of: Lesson, keyboard?: KeyboardMode) =>
  lessonRun(
    of,
    ["all", "flask", "glad", "shall", "gall"].map((w, i) =>
      card(w, i === 0 ? w : "xx"),
    ),
    { wpm: of.pass.kind === "lesson" ? of.pass.wpm : undefined, keyboard },
  );

/** `evaluateBadges` with the knobs no course badge reads held still. */
const badgesFor = (
  session: Omit<Session, "id" | "finishedAt">,
  history: Session[] = [],
) =>
  evaluateBadges({
    session,
    history,
    personalRecord: false,
    maxDeficitMs: 0,
    xpAfter: 0,
  });

/* ── The table ───────────────────────────────────────────────────────────── */

/**
 * Every badge that has ever shipped, written out rather than derived.
 *
 * Deliberately a second copy of `BADGES`, because a test that mapped over the
 * real table would pass no matter what the real table said. This one is a
 * promise to children who already hold these: change a row here and the diff
 * makes you say out loud that you are taking a badge off a shelf.
 *
 * Adding to the end is the only edit this test is meant to permit, and it is
 * the only edit that is safe (§6.7).
 */
const FROZEN = [
  ["green-light", "Green Light", "🚦", "Finish your first race"],
  ["clean-sheet", "Clean Sheet", "✨", "Finish a race with zero mistakes"],
  ["record-setter", "Record Setter", "⏱️", "Set a personal best time"],
  ["ghost-buster", "Ghost Buster", "👻", "Beat a rival ghost"],
  ["comeback", "Comeback", "🔄", "Win after trailing by 3 seconds"],
  ["hot-streak", "Hot Streak", "🔥", "15 correct in a row"],
  ["inferno", "Inferno", "🌋", "30 correct in a row"],
  ["quick-draw", "Quick Draw", "⚡", "Average under 3 seconds a card"],
  ["lightning", "Lightning", "🌩️", "Average under 1.5 seconds a card"],
  ["century", "Century", "💯", "Answer 100 cards"],
  ["five-hundred", "Long Haul", "🎖️", "Answer 500 cards"],
  ["gauntlet", "Gauntlet Runner", "🛡️", "Race every table at once"],
  ["marathon", "Marathon", "🏃", "Finish a 30-card race"],
  ["all-rounder", "All-Rounder", "🎛️", "Race all four operations"],
  ["level-10", "Double Digits", "🌟", "Reach level 10"],
  [
    "beat-the-clock",
    "Beat the Clock",
    "⏳",
    "Finish a timed race without running out once",
  ],
  [
    "nemesis",
    "Nemesis",
    "🎯",
    "Clear a drill of your tricky facts with no mistakes",
  ],
  // ── The typing course's five (LES12, §6.7) ─────────────────────────────────
  ["home-keys", "Home Keys", "🏠", "Clear checkpoint 10"],
  ["touch-typist", "Touch Typist", "✋", "Clear checkpoint 50"],
  ["ice-exam", "Ice Exam", "🧊", "Clear lesson 100"],
  ["eyes-up", "Eyes Up", "👀", "Pass a lesson with the keyboard hidden"],
  [
    "unbroken",
    "Unbroken",
    "🛡️",
    "Clear a Hailstorm wave with the shield untouched",
  ],
];

describe("the badge table", () => {
  it("is exactly what has shipped, in order", () => {
    expect(BADGES.map((b) => [b.id, b.name, b.icon, b.how])).toEqual(FROZEN);
  });

  it("has no two badges under one id", () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});

/* ── The seventeen that were here first ──────────────────────────────────── */

/**
 * The triggers, re-run through `evaluateBadges` rather than read off `how`.
 *
 * The table above pins what a badge *says*; these pin what it *does*, which is
 * the half a refactor moves. The assertions are on the whole set and not on one
 * id, so a course badge leaking onto a flash-card race fails here too — which
 * is the direction LES12 could have got wrong.
 */
describe("the badges that shipped before the typing course", () => {
  it("gives an ordinary first race the one badge for turning up", () => {
    const ordinary = race([
      card("14", "14", 5000),
      card("16", "16", 5000),
      card("18", "9", 5000),
    ]);
    expect(badgesFor(ordinary).sort()).toEqual(["green-light"]);
  });

  it("still reads perfect, and still reads fast", () => {
    const flawless = race(
      Array.from({ length: 12 }, (_, i) => card(`${i}`, `${i}`, 1200)),
    );
    expect(badgesFor(flawless).sort()).toEqual(
      ["clean-sheet", "green-light", "lightning", "quick-draw"].sort(),
    );
  });

  it("still counts a lifetime, a streak, a clock and a drill", () => {
    const drill = race(
      Array.from({ length: 30 }, (_, i) => card(`${i}`, `${i}`, 2000)),
      {
        bestStreak: 30,
        config: {
          operation: "multiply",
          tables: [2],
          others: [1, 2, 3],
          cardCount: 30,
          inputMode: "type",
          timeLimitMs: 10_000,
          facts: [[7, 8]],
        },
      },
    );
    const history = [
      asSaved(
        race(Array.from({ length: 80 }, (_, i) => card(`${i}`, `${i}`, 2000))),
      ),
    ];
    expect(badgesFor(drill, history).sort()).toEqual(
      [
        "beat-the-clock",
        "century",
        "clean-sheet",
        "green-light",
        "hot-streak",
        "inferno",
        "marathon",
        "nemesis",
        "quick-draw",
      ].sort(),
    );
  });
});

/* ── The three ladder badges ─────────────────────────────────────────────── */

describe("clearing the course", () => {
  it("gives Home Keys the moment checkpoint 10 goes down", () => {
    expect(badgesFor(passing(lesson(10)))).toContain("home-keys");
  });

  it("gives it for the run that cleared it, not the run after", () => {
    // The run has not been saved when badges are evaluated, so a reader that
    // asked only the history would hold the badge back until the child's next
    // race — and show it on a results screen for a lesson they were not on.
    const before = badgesFor(failing(lesson(10)));
    expect(before).not.toContain("home-keys");
  });

  it("does not give it for a checkpoint that was missed", () => {
    const history = [asSaved(failing(lesson(10)))];
    expect(badgesFor(race([card("2", "2")]), history)).not.toContain(
      "home-keys",
    );
  });

  /**
   * The placement test, as a shelf (§6.6). Unlock is `max(cleared) + 1`, so a
   * nine-year-old who opens checkpoint 50 cold has cleared 1–49 with it. A
   * Touch Typist without Home Keys would be a badge shelf disagreeing with the
   * ladder next to it about the same child.
   */
  it("carries the lower checkpoints with the higher one", () => {
    const badges = badgesFor(passing(lesson(50)));
    expect(badges).toContain("home-keys");
    expect(badges).toContain("touch-typist");
    expect(badges).not.toContain("ice-exam");
  });

  it("gives Ice Exam for lesson 100, and the two below it", () => {
    const badges = badgesFor(passing(lesson(100)));
    expect(badges).toContain("ice-exam");
    expect(badges).toContain("touch-typist");
    expect(badges).toContain("home-keys");
  });

  /**
   * A child who cleared checkpoint 10 months before this story shipped has the
   * runs and not the badge. `evaluateBadges` returns what is true rather than
   * what is new, so the next run of anything at all hands it over.
   */
  it("is awarded retroactively, on a race that is not a lesson", () => {
    const history = [asSaved(passing(lesson(10)))];
    expect(badgesFor(race([card("2", "2")]), history)).toContain("home-keys");
  });

  it("is not awarded for runs that are not on the ladder", () => {
    const notALesson = asSaved({
      ...passing(lesson(10)),
      mode: "typing:home-row",
    });
    expect(badgesFor(race([card("2", "2")]), [notALesson])).not.toContain(
      "home-keys",
    );
  });
});

/* ── Eyes Up ─────────────────────────────────────────────────────────────── */

/**
 * Lesson 41 is the shape this badge is for: an ordinary rung, `keyboard: keys`
 * and no lock on it, so the brief's control is live and the run records the
 * mode it was actually typed under.
 *
 * That recorded mode is the whole question. The badge does not ask who set it:
 * a lesson's mode seeds the control and Start hands over whatever it shows, so
 * on the twenty-three unlocked rows that seed `off` themselves an untouched
 * Start earns this too, once the run passes — which is right, because the
 * child still typed the lesson blind (§6.7).
 */
describe("Eyes Up", () => {
  it("is given for a lesson passed with the board turned off", () => {
    expect(badgesFor(passing(lesson(41), "off"))).toContain("eyes-up");
  });

  it("is not given when the board was on", () => {
    expect(badgesFor(passing(lesson(41), "keys"))).not.toContain("eyes-up");
    expect(badgesFor(passing(lesson(41), "guide"))).not.toContain("eyes-up");
  });

  it("is not given when the run recorded no board at all", () => {
    // No `keyboard` on the config is the ordinary case for free play and for
    // any route that starts a run without a brief in front of it. Absent is
    // not evidence that the board was hidden, and hidden is what this reads.
    expect(badgesFor(passing(lesson(41)))).not.toContain("eyes-up");
  });

  it("is not given for a lesson that was not passed", () => {
    expect(badgesFor(failing(lesson(41), "off"))).not.toContain("eyes-up");
  });

  /**
   * The inversion this badge exists to avoid.
   *
   * Every checkpoint forces the keyboard off (§4.2) — that is what makes
   * passing one mean something. A badge that read the board on screen, or that
   * trusted a `keyboard` field a future screen might write on a locked lesson,
   * would fire on exactly the ten runs where being eyes-up was compulsory,
   * which is the one distinction this badge does draw. So the config below
   * carries `off` and is still refused: the lesson left no other way to play
   * it, and a run that could not have been typed any other way proves nothing.
   */
  it("is refused on a checkpoint, which forces the board off anyway", () => {
    const badges = badgesFor(passing(lesson(10), "off"));
    expect(badges).toContain("home-keys");
    expect(badges).not.toContain("eyes-up");
  });

  it("is refused on every locked lesson the ladder has", () => {
    for (const of of LESSONS) {
      if (!of.keyboardLocked || of.pass.kind !== "lesson") continue;
      expect(badgesFor(passing(of, "off"))).not.toContain("eyes-up");
    }
  });
});

/* ── Unbroken ────────────────────────────────────────────────────────────── */

/**
 * Run one test against a storm level whose wave is a given length.
 *
 * How a test about the badge's *guard* asks its question without becoming a
 * test about lesson 4's `count`. Three of the cases below turn on the
 * relationship between a run's cards and the wave's length, and pinning them to
 * whatever the table says today would make a difficulty pass look like a badge
 * regression.
 */
function withWave(n: number, count: number, body: () => void) {
  const of = lesson(n);
  const was = of.wordCount;
  of.wordCount = count;
  try {
    body();
  } finally {
    of.wordCount = was;
  }
}

describe("Unbroken", () => {
  /**
   * The premise of the guard (decision 29): every one of the twenty storms has
   * a wave length, and all twenty have to keep one. A storm whose `count`
   * slipped to zero would be a rung that quietly cannot earn a badge it
   * advertises, and `survived` would pass every run of it — including one that
   * died at letter one.
   */
  it("has a wave on every Hailstorm level to fire on", () => {
    const storms = LESSONS.filter((l) => l.pass.kind === "storm");
    expect(storms.length).toBe(20);
    for (const of of storms) expect(of.wordCount).toBeGreaterThan(0);
  });

  it("is not awarded for a storm level with no wave", () => {
    // The guard itself, with the wave taken away for one test: a run that met
    // three letters of a level that has none is a claim about a wave that does
    // not exist. It cannot happen off today's table and is what the line in
    // `progress.ts` is there for, so it is asked directly.
    withWave(4, 0, () => {
      const flawless = lessonRun(
        lesson(4),
        ["a", "s", "d"].map((letter) => card(letter, letter)),
      );
      expect(badgesFor(flawless)).not.toContain("unbroken");
    });
  });

  it("does not throw on a storm-shaped run", () => {
    // A storm has no words per minute and introduces no keys, so a badge
    // reader that reached for either would blow up on the first wave rather
    // than on a test. It is checked with an empty run too: dying at the first
    // letter saves a session with nothing in it (§8.7).
    const of = lesson(4);
    expect(() => badgesFor(lessonRun(of, []))).not.toThrow();
    expect(() => badgesFor(lessonRun(of, [card("a", null)]))).not.toThrow();
  });

  it("is awarded once the wave exists and nothing got through", () => {
    withWave(4, 3, () => {
      const clean = lessonRun(
        lesson(4),
        ["a", "s", "d"].map((letter) => card(letter, letter)),
        { wordCount: 3 },
      );
      expect(badgesFor(clean)).toContain("unbroken");
    });
  });

  it("is refused when a letter got past the shield", () => {
    withWave(4, 3, () => {
      const holed = lessonRun(
        lesson(4),
        [card("a", "a"), card("s", "s"), card("d", null)],
        { wordCount: 3 },
      );
      expect(badgesFor(holed)).not.toContain("unbroken");
    });
  });

  it("is refused when the wave ended early, however clean it was", () => {
    withWave(4, 40, () => {
      const died = lessonRun(
        lesson(4),
        ["a", "s", "d"].map((letter) => card(letter, letter)),
        { wordCount: 40 },
      );
      expect(badgesFor(died)).not.toContain("unbroken");
    });
  });

  it("is not awarded for a flawless run of an ordinary lesson", () => {
    expect(badgesFor(passing(lesson(41), "off"))).not.toContain("unbroken");
  });
});
