import type { Operation, Session } from "@/engine/types";

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
const MAX_COMBO_STEPS = 10;

/** XP for one correct card. Wrong cards score nothing but cost no XP either. */
export function cardXp(ms: number, streakAfter: number) {
  const speed = Math.max(
    0,
    Math.min(15, Math.round((SPEED_TARGET_MS - ms) / 200)),
  );
  const multiplier = 1 + Math.min(streakAfter, MAX_COMBO_STEPS) / 10;
  return Math.round((10 + speed) * multiplier);
}

export function comboMultiplier(streak: number) {
  return 1 + Math.min(streak, MAX_COMBO_STEPS) / 10;
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
  if (session.config.tables.length >= 12) earned.add("gauntlet");
  if (cardsThisRace >= 30) earned.add("marathon");
  if (xpAfter >= xpToReach(10)) earned.add("level-10");

  const timedOut = session.cards.some((c) => c.timedOut);
  if (session.config.timeLimitMs && cardsThisRace >= 10 && !timedOut)
    earned.add("beat-the-clock");
  if (session.config.facts?.length && perfect) earned.add("nemesis");

  const operations = new Set<Operation>(history.map((s) => s.mode));
  operations.add(session.mode);
  if (operations.size >= 4) earned.add("all-rounder");

  return [...earned];
}
