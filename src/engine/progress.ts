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
 * What a Hailstorm run pays into the profile: a fold over the finished run's
 * hits at `cardXp`, so a storm and a race pay on one scale (docs/typing.md
 * §8.6). `ms` is how long the letter was in the air (§8.7) and the streak is
 * the combo the shot landed on, so both arguments mean here what they mean on
 * a card.
 *
 * **The `max(0, …)` is deliberate and must not be removed.** It cannot bite as
 * the sum stands — every term below is a `cardXp`, which is never negative —
 * so no input can drive it, no test can pin it, and deleting it leaves the
 * suite entirely green. It guards the NEXT term somebody adds, not today's: a
 * penalty per miss, or a charge for a letter that got through, would look
 * local and correct at the fold below, and would be a child's level ring
 * running backwards on their profile. Score can fall; XP cannot, and this is
 * the line the two are kept apart at.
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
     there is, so adding to this table is free while renaming or removing an
     entry takes a badge off a child who has it — the row stops resolving in
     `BADGES_BY_ID` and the tile vanishes from their shelf. */
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
   questions about a child's whole climb, derived from every run they have ever
   saved (§6.5). Keeping them apart is what stops the history pass being paid
   for by a badge that only needed the card count.                             */

/**
 * Whichever of the five this run has just earned, plus the ladder ones the
 * child already had.
 *
 * Like `evaluateBadges` itself this returns what is *true*, not what is new —
 * `summariseRun` diffs against `Profile.badges` to find the ones worth
 * celebrating. That is also what backfills: a child who cleared checkpoint 10
 * long before the badge existed is handed it by their next run of anything.
 */
function courseBadges(
  session: BadgeContext["session"],
  history: Session[],
): string[] {
  const earned: string[] = [];

  /* ── The three ladder badges ───────────────────────────────────────────────
     Asked of `ladderProgress` rather than of this run, and read off `best`
     rather than `cleared.has(n)`, which is the ladder's own rule (§6.6, §6.7).

     This run is handed over beside the history because it is not saved yet: a
     checkpoint cleared *by this run* has to award its badge on this run's
     results screen, not on the next one's.                                  */
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
     Hidden, not chosen: three conditions, and "the child chose it" is
     deliberately not one of them (§6.7). `forcedKeyboard` is the one definition
     of a lesson that insists, shared with the island's resolver. The test is
     `=== "off"` rather than anything looser, because a `keyboard` absent from
     the config is not evidence of a hidden board — free play, or a run started
     without a brief in front of it.

     Lessons only. A Hailstorm level's ⌨ column is about the *field*, which is
     the keyboard (§8.2), so "hidden" does not mean there what it means here. */
  if (
    lesson.pass.kind === "lesson" &&
    !forcedKeyboard(lesson) &&
    config.keyboard === "off" &&
    verdict.passed
  )
    earned.push("eyes-up");

  /* ── `unbroken` ────────────────────────────────────────────────────────────
     "Shield untouched" is read as nothing marked wrong, which is the badge's
     own sentence rather than an approximation of it (§6.7, §8.5). The wave
     guard is a guard and not a line to delete: with no wave, `survived` is
     vacuously true (§6.7, decision 29).

     `correct > 0` cannot change the answer and is kept on purpose. A run with
     no cards has an accuracy of 0 (`accuracyOf` returns 0 rather than NaN for
     an empty run), which is under every storm's 0.9 bar, so `verdict.passed`
     has already refused it. It stays because it says the second half of what
     "nothing got through" means — nothing wrong *and* something faced — and
     because the thing holding it up is a bar a future re-tune could lower.
     Redundant, deliberately; not a condition somebody forgot to finish.      */
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
