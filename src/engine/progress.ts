import { comboMultiplier } from "@/engine/combo";
import { OPERATION_ORDER } from "@/engine/decks/flashcards";
import { isFlash, isTyping, isWords } from "@/engine/decks";
import { ladderProgress } from "@/engine/typing/ladder";
import { forcedKeyboard, lessonById } from "@/engine/typing/lessons";
import { verdictFor } from "@/engine/typing/verdict";
import type { StormState } from "@/engine/typing/storm";
import type { Session } from "@/engine/types";

/* ── Levels ──────────────────────────────────────────────────────────────
   Cumulative XP to reach level n is 125·n·(n−1), so early levels come fast
   and later ones stretch out.                                             */

const xpToReach = (level: number) => 125 * level * (level - 1);

export type LevelInfo = {
  level: number;
  intoLevel: number;
  levelSpan: number;
  /** 0 – 1, for the ring around the avatar. */
  progress: number;
  toNext: number;
};

export function levelFromXp(xp: number): LevelInfo {
  const safe = Math.max(0, xp);
  let level = 1;
  while (xpToReach(level + 1) <= safe) level++;
  const floor = xpToReach(level);
  const ceiling = xpToReach(level + 1);
  const span = ceiling - floor;
  const into = safe - floor;
  return {
    level,
    intoLevel: into,
    levelSpan: span,
    progress: span === 0 ? 0 : into / span,
    toNext: ceiling - safe,
  };
}

/* ── Race scoring ───────────────────────────────────────────────────────── */

const SPEED_TARGET_MS = 4000;

/** XP for one correct card. Wrong cards score nothing but cost no XP either. */
export function cardXp(ms: number, streakAfter: number) {
  const speed = Math.max(
    0,
    Math.min(15, Math.round((SPEED_TARGET_MS - ms) / 200)),
  );
  return Math.round((10 + speed) * comboMultiplier(streakAfter));
}

/**
 * What a Hailstorm run pays into the profile (docs/typing.md §8.6).
 *
 * ── Score can fall; XP cannot ────────────────────────────────────────────
 * The storm's own score goes DOWN on a wrong key, because losing points has
 * to be visible and immediate or it is not a consequence. This number is the
 * other one, and it is floored at zero on purpose: XP is cumulative across
 * years and across four games, and it is what a child's level ring is drawn
 * from. A mechanic that could take XP away would mean a level going BACKWARDS
 * because they had a bad five minutes in a shooter — a punishment that
 * outlives the run it was earned in, aimed at the youngest player on the site.
 * So the run's misses cost score and nothing else, and the two numbers are
 * kept apart at exactly this line.
 *
 * **The `max(0, …)` is deliberate and must not be removed.** It cannot bite as
 * the sum stands — every term below is a `cardXp`, which is never negative —
 * so no input can drive it, no test can pin it, and deleting it leaves the
 * suite entirely green. That is the reason it is written down here rather than
 * left to be rediscovered: it guards the NEXT term somebody adds, not today's.
 * A penalty per miss, or a charge for a letter that got through, would look
 * local and correct at the fold below and would be a child's level ring
 * running backwards on their profile. Nothing in the tooling can say that to
 * whoever adds one, so this paragraph does; unreachable is not unnecessary.
 *
 * ── Computed once, at the end, from the run's hits ───────────────────────
 * Not accumulated frame by frame: `resolved` already says which letters were
 * shot, when, and on what streak, so this is a fold over a finished run rather
 * than a second tally kept in step with the reducer sixty times a second.
 *
 * `cardXp` is reused UNCHANGED, and that is the point of it. It already
 * rewards a hit under four seconds and a streak up to ×2, which is the shape a
 * shooter wants — and using it means a Hailstorm level and a flash-card race
 * pay out on the same scale, which they must, because it is one profile and
 * one level ring. `ms` is how long the letter was in the air (§8.7) and the
 * streak is the combo the shot landed on, so both arguments mean here what
 * they mean on a card.
 */
export function stormXp(state: StormState): number {
  return Math.max(
    0,
    state.resolved.reduce<number>(
      (sum, outcome, index) =>
        outcome?.outcome === "shot"
          ? sum +
            cardXp(
              outcome.atMs - state.wave.letters[index].spawnMs,
              outcome.combo,
            )
          : sum,
      0,
    ),
  );
}

export type FinishBonuses = {
  perfect: boolean;
  personalRecord: boolean;
  beatGhost: boolean;
  cardCount: number;
};

export function finishBonuses({
  perfect,
  personalRecord,
  beatGhost,
  cardCount,
}: FinishBonuses) {
  const parts: Array<{ label: string; xp: number }> = [];
  if (perfect) parts.push({ label: "No mistakes", xp: 50 + cardCount * 5 });
  if (personalRecord) parts.push({ label: "Personal best", xp: 150 });
  if (beatGhost) parts.push({ label: "Beat your rival", xp: 100 });
  return parts;
}

/* ── Badges ─────────────────────────────────────────────────────────────── */

export type BadgeDef = {
  id: string;
  name: string;
  icon: string;
  how: string;
};

export const BADGES: BadgeDef[] = [
  {
    id: "green-light",
    name: "Green Light",
    icon: "🚦",
    how: "Finish your first race",
  },
  {
    id: "clean-sheet",
    name: "Clean Sheet",
    icon: "✨",
    how: "Finish a race with zero mistakes",
  },
  {
    id: "record-setter",
    name: "Record Setter",
    icon: "⏱️",
    how: "Set a personal best time",
  },
  {
    id: "ghost-buster",
    name: "Ghost Buster",
    icon: "👻",
    how: "Beat a rival ghost",
  },
  {
    id: "comeback",
    name: "Comeback",
    icon: "🔄",
    how: "Win after trailing by 3 seconds",
  },
  {
    id: "hot-streak",
    name: "Hot Streak",
    icon: "🔥",
    how: "15 correct in a row",
  },
  { id: "inferno", name: "Inferno", icon: "🌋", how: "30 correct in a row" },
  {
    id: "quick-draw",
    name: "Quick Draw",
    icon: "⚡",
    how: "Average under 3 seconds a card",
  },
  {
    id: "lightning",
    name: "Lightning",
    icon: "🌩️",
    how: "Average under 1.5 seconds a card",
  },
  { id: "century", name: "Century", icon: "💯", how: "Answer 100 cards" },
  {
    id: "five-hundred",
    name: "Long Haul",
    icon: "🎖️",
    how: "Answer 500 cards",
  },
  {
    id: "gauntlet",
    name: "Gauntlet Runner",
    icon: "🛡️",
    how: "Race every table at once",
  },
  {
    id: "marathon",
    name: "Marathon",
    icon: "🏃",
    how: "Finish a 30-card race",
  },
  {
    id: "all-rounder",
    name: "All-Rounder",
    icon: "🎛️",
    how: "Race all four operations",
  },
  { id: "level-10", name: "Double Digits", icon: "🌟", how: "Reach level 10" },
  {
    id: "beat-the-clock",
    name: "Beat the Clock",
    icon: "⏳",
    how: "Finish a timed race without running out once",
  },
  {
    id: "nemesis",
    name: "Nemesis",
    icon: "🎯",
    how: "Clear a drill of your tricky facts with no mistakes",
  },

  /* ── Frost Keys, the typing course (docs/typing.md §6.7) ───────────────────
     Appended, and only ever appended. A badge id is written into
     `Profile.badges` the moment it is earned and that list is the only copy
     there is, so adding to this table is free and renaming or removing an
     entry takes a badge off a child who has it — the row would simply stop
     resolving in `BADGES_BY_ID` and the tile would vanish from their shelf.
     Five, and no more (§6.7). */
  {
    id: "home-keys",
    name: "Home Keys",
    icon: "🏠",
    how: "Clear checkpoint 10",
  },
  {
    id: "touch-typist",
    name: "Touch Typist",
    icon: "✋",
    how: "Clear checkpoint 50",
  },
  { id: "ice-exam", name: "Ice Exam", icon: "🧊", how: "Clear lesson 100" },
  {
    id: "eyes-up",
    name: "Eyes Up",
    icon: "👀",
    how: "Pass a lesson with the keyboard hidden",
  },
  {
    id: "unbroken",
    name: "Unbroken",
    icon: "🛡️",
    how: "Clear a Hailstorm wave with the shield untouched",
  },
];

export const BADGES_BY_ID = new Map(BADGES.map((b) => [b.id, b]));

export type BadgeContext = {
  session: Omit<Session, "id" | "finishedAt">;
  /** Every earlier session for this player. */
  history: Session[];
  personalRecord: boolean;
  maxDeficitMs: number;
  xpAfter: number;
};

/** Returns badge ids earned by this race (including ones already held). */
export function evaluateBadges({
  session,
  history,
  personalRecord,
  maxDeficitMs,
  xpAfter,
}: BadgeContext): string[] {
  const earned = new Set<string>();
  const cardsThisRace = session.cards.length;
  const lifetimeCards =
    history.reduce((sum, s) => sum + s.cards.length, 0) + cardsThisRace;
  const perfect = session.incorrect === 0 && session.correct > 0;
  const avgMs =
    cardsThisRace > 0 ? session.durationMs / cardsThisRace : Infinity;

  earned.add("green-light");
  if (perfect) earned.add("clean-sheet");
  if (personalRecord && history.some((s) => s.configKey === session.configKey))
    earned.add("record-setter");
  if (session.beatGhost) earned.add("ghost-buster");
  if (session.beatGhost && maxDeficitMs >= 3000) earned.add("comeback");
  if (session.bestStreak >= 15) earned.add("hot-streak");
  if (session.bestStreak >= 30) earned.add("inferno");
  if (perfect && avgMs < 3000) earned.add("quick-draw");
  if (perfect && avgMs < 1500) earned.add("lightning");
  if (lifetimeCards >= 100) earned.add("century");
  if (lifetimeCards >= 500) earned.add("five-hundred");
  if (isFlash(session.config) && session.config.tables.length >= 12)
    earned.add("gauntlet");
  if (cardsThisRace >= 30) earned.add("marathon");
  if (xpAfter >= xpToReach(10)) earned.add("level-10");

  const timedOut = session.cards.some((c) => c.timedOut);
  if (session.config.timeLimitMs && cardsThisRace >= 10 && !timedOut)
    earned.add("beat-the-clock");
  // A drill is a named set of things to practise, whichever deck it came from.
  const config = session.config;
  const drilled = isFlash(config)
    ? config.facts?.length
    : isWords(config) || isTyping(config)
      ? config.words?.length
      : 0;
  if (drilled && perfect) earned.add("nemesis");

  // Named outright rather than counted to four: `mode` also holds word-list
  // ids now, and four spelling decks are not "all four operations".
  const raced = new Set([session.mode, ...history.map((s) => s.mode)]);
  if (OPERATION_ORDER.every((op) => raced.has(op))) earned.add("all-rounder");

  for (const id of courseBadges(session, history)) earned.add(id);

  return [...earned];
}

/* ── The typing course's five (docs/typing.md §6.7) ───────────────────────────
   Split out rather than added to the list above because they are asked in a
   different tense. The seventeen above are questions about *this race* —
   perfect, fast, thirty cards, a streak of fifteen. Three of these five are
   questions about a child's whole climb, and the climb is derived from every
   run they have ever saved (§6.5). Keeping them apart is what stops the
   history pass being paid for by a badge that only needed the card count.     */

/**
 * Whichever of the five this run has just earned, plus the ladder ones the
 * child already had.
 *
 * Like `evaluateBadges` itself this returns what is *true*, not what is new —
 * `summariseRun` diffs against `Profile.badges` to find the ones worth
 * celebrating. Which is also how a child who cleared checkpoint 10 before this
 * shipped is given Home Keys: the next run of anything at all re-asks the
 * question, and the answer has been yes for months.
 */
function courseBadges(
  session: BadgeContext["session"],
  history: Session[],
): string[] {
  const earned: string[] = [];

  /* ── The three ladder badges ───────────────────────────────────────────────
     Asked of `ladderProgress` rather than of this run, because "clear
     checkpoint 10" is a fact about a child and not about a race, and the
     ladder is the only place that knows what clearing means. This run is
     handed over beside the history because it is not saved yet: a checkpoint
     cleared *by this run* has to award its badge on this run's results screen,
     not on the next one's.

     `best`, not `cleared.has(n)`, and that is the ladder's own rule rather
     than a shortcut (§6.6). Passing checkpoint 50 clears 1–49 with it — that
     is the whole of the placement test — so a nine-year-old who opens
     checkpoint 50 cold has cleared checkpoint 10, and a Touch Typist without
     Home Keys would be a shelf that disagreed with the ladder next to it.   */
  const ladder = ladderProgress([...history, session]);
  if (ladder.best >= 10) earned.push("home-keys");
  if (ladder.best >= 50) earned.push("touch-typist");
  if (ladder.best >= 100) earned.push("ice-exam");

  // Through the deck registry's own guard, as everywhere else: narrowing the
  // config union is `decks/index.ts`'s job. A run that is not a lesson — free
  // play, a spelling race, a drill — has neither of the two below to earn.
  const config = isTyping(session.config) ? session.config : null;
  const lesson = lessonById(config?.lessonId);
  if (!config || !lesson) return earned;

  const verdict = verdictFor(session, lesson);

  /* ── `eyes-up`, the one that matters ───────────────────────────────────────
     Three conditions, and "the child chose it" is deliberately not one of
     them: the lesson must not have forced the board off (`forcedKeyboard` is
     the one definition of that, shared with the island's resolver), the run
     must have been typed with it off, and it must have passed.

     What excluding the forced ones buys is *compulsion*, not authorship. Every
     checkpoint forces the board off (§4.2), so a badge that read the resolved
     mode — or `config.keyboard` on its own, the day a screen starts writing
     that field on a locked lesson — would fire on exactly the ten runs where
     being eyes-up was not optional. That is the inverse of the badge.

     Hidden rather than chosen is where the line belongs, and it is worth being
     plain about the difference. A lesson's mode only *seeds* the brief's
     control (§4.2, #145) and Start hands over whatever that control is showing,
     so on an unlocked lesson `config.keyboard` records the mode the run was
     actually typed under — touched or untouched. Twenty-three unlocked rows
     seed `off` themselves, so a child who opens lesson 46, presses Start and
     passes earns this. That is right: they typed a lesson blind. Insisting on
     authorship would mean comparing the config against the seed and refusing
     that child for doing exactly what the ladder asked — same lesson, same
     empty screen, same work — while rewarding a neighbour who flipped a pill
     the ladder had already flipped for them. "Pass a lesson with the keyboard
     hidden" is what the badge promises, and hidden is what this reads.

     A `keyboard` absent from the config is not evidence of a hidden board —
     free play, or a run started without a brief in front of it — so `=== "off"`
     refuses it rather than guessing.

     Lessons only. A Hailstorm level's ⌨ column is about the *field*, which is
     the keyboard (§8.2), so "hidden" does not mean there what it means here. */
  if (
    lesson.pass.kind === "lesson" &&
    !forcedKeyboard(lesson) &&
    config.keyboard === "off" &&
    verdict.passed
  )
    earned.push("eyes-up");

  /* ── `unbroken`, which is waiting for the waves (STM10) ─────────────────────
     Guarded on the wave rather than on the absence of a screen that could
     start one. A storm level's `wordCount` is its wave's `count` (§8.3) and
     every one of the twenty is `0` until STM10 writes the `WaveSpec`s — so
     `survived` is vacuously true, "cleared a wave" is a claim about a wave
     that does not exist, and this badge must not be given for it. Stating the
     guard as "the wave has a length" means it retires itself the day the waves
     land, rather than being a line someone has to remember to delete.

     "Shield untouched" is read as **no letter reached the bottom**, which is
     what takes a point off a segment (§8.5). A storm's cards are its falling
     letters and nothing else (§8.7, decision 48), so a run with nothing marked
     wrong is exactly a run where nothing got through: a wrong key resolves no
     letter and so costs no card, and the one letter that lands without costing
     a shield point is the fatal one, which is itself a card marked wrong. So
     this is the badge's own sentence rather than an approximation of it —
     which is worth saying out loud, because counting a storm's wrong KEYS into
     `incorrect` would quietly re-tune it from "untouched shield" to "flawless
     run" without a line of this file changing.

     `correct > 0` cannot change the answer, and is kept on purpose. A run with
     no cards at all has an accuracy of 0 (`accuracyOf` returns 0 rather than
     NaN for an empty run), which is under every storm's 0.9 bar, so
     `verdict.passed` has already refused it. It stays because it says the
     second half of what "nothing got through" means — nothing wrong *and*
     something faced — the same pair `perfect` is built from above, and because
     the thing holding it up is a bar in the criteria table that a future
     re-tune could lower. Redundant, deliberately; not a condition somebody
     forgot to finish.                                                        */
  if (
    lesson.pass.kind === "storm" &&
    lesson.wordCount > 0 &&
    verdict.passed &&
    session.incorrect === 0 &&
    session.correct > 0
  )
    earned.push("unbroken");

  return earned;
}
