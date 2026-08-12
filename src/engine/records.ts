import type {
  CardResult,
  FlashConfig,
  Ghost,
  Operation,
  Profile,
  Session,
} from "@/engine/types";

export const accuracyOf = (session: Pick<Session, "correct" | "incorrect">) => {
  const total = session.correct + session.incorrect;
  return total === 0 ? 0 : session.correct / total;
};

/** The per-card clock this run was played under, or null if it was untimed. */
export const timeLimitOf = (session: { config: FlashConfig }) =>
  session.config?.timeLimitMs ?? null;

export const timedOutCount = (session: { cards: CardResult[] }) =>
  session.cards.filter((c) => c.timedOut).length;

/**
 * A wrong answer adds this to your race time. It's what stops "guess fast"
 * from beating "know it", and it's why the ghost visibly surges ahead the
 * moment you miss one.
 */
export const WRONG_ANSWER_PENALTY_MS = 3000;

/** Wall clock plus penalties — the number a race is actually decided on. */
export const raceTimeMs = (
  session: Pick<Session, "durationMs" | "incorrect">,
) => session.durationMs + session.incorrect * WRONG_ANSWER_PENALTY_MS;

/** The parts of a run that decide which of two is better. */
export type Scored = Pick<
  Session,
  "durationMs" | "correct" | "incorrect" | "config"
>;

/**
 * Returns < 0 when `a` is the better run.
 *
 * Under a per-card clock the total time can't run away — every card is capped
 * — so the run that beat the clock more often wins, and time only breaks the
 * tie. Untimed races are still decided on time alone.
 */
export function compareRuns(a: Scored, b: Scored) {
  if (timeLimitOf(a) !== null && timeLimitOf(b) !== null) {
    if (a.correct !== b.correct) return b.correct - a.correct;
  }
  return raceTimeMs(a) - raceTimeMs(b);
}

export function bestRun(sessions: Session[]): Session | null {
  if (sessions.length === 0) return null;
  return sessions.reduce((best, s) => (compareRuns(s, best) < 0 ? s : best));
}

export const sessionsFor = (
  sessions: Session[],
  profileId: string,
  configKey?: string,
) =>
  sessions.filter(
    (s) =>
      s.profileId === profileId && (!configKey || s.configKey === configKey),
  );

/** One ghost per player: their best run at this exact configuration. */
export function ghostsFor(
  sessions: Session[],
  profiles: Profile[],
  configKey: string,
  viewerId: string,
): Ghost[] {
  return profiles
    .map((profile) => {
      const best = bestRun(sessionsFor(sessions, profile.id, configKey));
      return best
        ? { session: best, profile, isSelf: profile.id === viewerId }
        : null;
    })
    .filter((g): g is Ghost => g !== null)
    .sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return compareRuns(a.session, b.session);
    });
}

/**
 * Race time after each card, including penalties, so a ghost's mistakes cost
 * it ground on the track exactly as yours do.
 */
export function cumulativeSplits(session: Session): number[] {
  let total = 0;
  return session.cards.map(
    (card) => (total += card.ms + (card.ok ? 0 : WRONG_ANSWER_PENALTY_MS)),
  );
}

export type Lifetime = {
  races: number;
  cards: number;
  correct: number;
  accuracy: number;
  bestStreak: number;
  totalMs: number;
  fastestCardMs: number | null;
};

export function lifetimeStats(sessions: Session[]): Lifetime {
  const stats: Lifetime = {
    races: sessions.length,
    cards: 0,
    correct: 0,
    accuracy: 0,
    bestStreak: 0,
    totalMs: 0,
    fastestCardMs: null,
  };
  for (const session of sessions) {
    stats.cards += session.correct + session.incorrect;
    stats.correct += session.correct;
    stats.totalMs += session.durationMs;
    stats.bestStreak = Math.max(stats.bestStreak, session.bestStreak);
    for (const card of session.cards) {
      if (
        card.ok &&
        (stats.fastestCardMs === null || card.ms < stats.fastestCardMs)
      )
        stats.fastestCardMs = card.ms;
    }
  }
  stats.accuracy = stats.cards === 0 ? 0 : stats.correct / stats.cards;
  return stats;
}

/* ── Per-fact mastery ────────────────────────────────────────────────────
   Facts are keyed by their unordered pair, so 7×8 and 8×7 feed the same
   cell of the grid.                                                       */

export type FactStat = { attempts: number; correct: number; totalMs: number };

export const factKey = (a: number, b: number) =>
  `${Math.min(a, b)}:${Math.max(a, b)}`;

/**
 * 7 × 8 and 8 × 7 are the same fact; 21 ÷ 3 and 21 ÷ 7 are not. The fact map
 * is a symmetric 12×12 grid so it folds every operation, but a practice deck
 * has to rebuild the actual problem — and for these two, order carries it.
 */
const COMMUTATIVE: Record<Operation, boolean> = {
  multiply: true,
  add: true,
  divide: false,
  subtract: false,
};

/** The pair as a drill needs it: folded only where the operation allows. */
const drillPair = (
  [a, b]: [number, number],
  operation: Operation,
): [number, number] =>
  COMMUTATIVE[operation] ? [Math.min(a, b), Math.max(a, b)] : [a, b];

/** De-duplicated facts behind a set of cards, ready to build a practice deck. */
export function factsToDrill(cards: CardResult[], operation: Operation) {
  const out = new Map<string, [number, number]>();
  for (const card of cards) {
    const pair = drillPair(card.facts, operation);
    out.set(`${pair[0]}:${pair[1]}`, pair);
  }
  return [...out.values()];
}

export function factStats(sessions: Session[], operation: Operation) {
  const grid = new Map<string, FactStat>();
  for (const session of sessions) {
    if (session.mode !== operation) continue;
    for (const card of session.cards) {
      const key = factKey(card.facts[0], card.facts[1]);
      const entry = grid.get(key) ?? { attempts: 0, correct: 0, totalMs: 0 };
      entry.attempts += 1;
      if (card.ok) entry.correct += 1;
      entry.totalMs += card.ms;
      grid.set(key, entry);
    }
  }
  return grid;
}

export type Mastery = "untried" | "learning" | "solid" | "mastered";

/** Above this, an answer was worked out rather than recalled. */
export const MASTERY_PACE_MS = 4000;

/** A fact is mastered once it's reliable *and* fast — recall, not counting. */
export function masteryOf(stat: FactStat | undefined): Mastery {
  if (!stat || stat.attempts === 0) return "untried";
  const accuracy = stat.correct / stat.attempts;
  const avg = stat.totalMs / stat.attempts;
  if (stat.attempts >= 3 && accuracy >= 0.9 && avg < MASTERY_PACE_MS)
    return "mastered";
  if (accuracy >= 0.7) return "solid";
  return "learning";
}

/* ── Trouble spots ───────────────────────────────────────────────────────
   The facts worth drilling: ones the clock beat, ones answered wrong, and
   ones that were right but visibly counted out.                           */

export type TroubleFact = {
  key: string;
  facts: [number, number];
  attempts: number;
  /** The per-card clock ran out. */
  timeouts: number;
  wrong: number;
  /** Right, but slower than recall. */
  slow: number;
  avgMs: number;
  slowestMs: number;
  score: number;
};

/**
 * Ranks facts worst-first. Fast, correct answers subtract from the score, so a
 * fact drops off this list as it gets learned instead of sitting there on the
 * strength of one bad night.
 */
export function troubleFacts(
  sessions: Session[],
  operation: Operation,
  take = 8,
): TroubleFact[] {
  const seen = new Map<string, TroubleFact>();

  for (const session of sessions) {
    if (session.mode !== operation) continue;
    for (const card of session.cards) {
      const facts = drillPair(card.facts, operation);
      const key = `${facts[0]}:${facts[1]}`;
      const entry = seen.get(key) ?? {
        key,
        facts,
        attempts: 0,
        timeouts: 0,
        wrong: 0,
        slow: 0,
        avgMs: 0,
        slowestMs: 0,
        score: 0,
      };
      entry.attempts += 1;
      // avgMs accumulates the total here and is divided out below.
      entry.avgMs += card.ms;
      entry.slowestMs = Math.max(entry.slowestMs, card.ms);
      if (card.timedOut) entry.timeouts += 1;
      else if (!card.ok) entry.wrong += 1;
      else if (card.ms >= MASTERY_PACE_MS) entry.slow += 1;
      else entry.score -= 1;
      seen.set(key, entry);
    }
  }

  return [...seen.values()]
    .map((entry) => ({
      ...entry,
      avgMs: entry.avgMs / entry.attempts,
      score: entry.score + entry.timeouts * 3 + entry.wrong * 2 + entry.slow,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.avgMs - a.avgMs)
    .slice(0, take);
}

export type TableProgress = {
  table: number;
  mastered: number;
  total: number;
  complete: boolean;
};

export function tableProgress(
  grid: Map<string, FactStat>,
  range = 12,
): TableProgress[] {
  const tables: TableProgress[] = [];
  for (let table = 1; table <= range; table++) {
    let mastered = 0;
    for (let other = 1; other <= range; other++) {
      if (masteryOf(grid.get(factKey(table, other))) === "mastered")
        mastered += 1;
    }
    tables.push({
      table,
      mastered,
      total: range,
      complete: mastered === range,
    });
  }
  return tables;
}
