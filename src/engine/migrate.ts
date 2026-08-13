import type {
  CardResult,
  LegacyCardResult,
  LegacySession,
  Session,
} from "./types";

/**
 * Reading runs that were saved before answers became text.
 *
 * Every race played up to 2026-08-13 stored a numeric `answer`/`given` and an
 * ordered `facts` pair. Widening the card (see `Card` in `types.ts`) left that
 * data on disk in a shape the engine no longer types.
 *
 * This runs on the way out of storage rather than as an IndexedDB upgrade, and
 * that is a deliberate trade. An upgrade would retire the legacy branch for
 * good, but it rewrites the only copy of data that by design exists nowhere
 * else — there is no server holding a spare. A read-time widening is
 * idempotent, costs one pass over a list already being deserialised, and
 * cannot corrupt anything: the worst case is that it does nothing.
 *
 * So the branch below is permanent. Deleting it deletes years of a child's
 * record book.
 */

/** Already-widened cards pass straight through, so a normal load allocates nothing. */
const isCurrent = (card: LegacyCardResult | CardResult): card is CardResult =>
  typeof card.answer === "string" && typeof card.factId === "string";

export function readCard(card: LegacyCardResult | CardResult): CardResult {
  if (isCurrent(card)) return card;
  const { facts, ...rest } = card as LegacyCardResult;
  return {
    ...rest,
    answer: String(card.answer),
    // A timeout genuinely has no answer, and `String(null)` is "null".
    given:
      card.given === null || card.given === undefined
        ? null
        : String(card.given),
    // Ordered as it was built, exactly as `arithmeticFactId` writes it, so a
    // migrated run folds onto the same grid square as a fresh one.
    factId: card.factId ?? (facts ? `${facts[0]}:${facts[1]}` : ""),
  };
}

export function readSession(session: LegacySession | Session): Session {
  if (session.cards.every(isCurrent)) return session as Session;
  return { ...session, cards: session.cards.map(readCard) };
}

export const readSessions = (sessions: Array<LegacySession | Session>) =>
  sessions.map(readSession);
