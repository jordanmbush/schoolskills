import type { Session } from "@/engine/types";

import { typingMode } from "@/engine/decks/typing";
import { LESSONS } from "./lessons";
import { verdictFor } from "./verdict";

/**
 * How far up the ladder a child has got (docs/typing.md §6.5, §6.6).
 *
 * Everything here is **derived from the sessions the hub has already loaded**.
 * There is no `passedLessons` field, no new object store and no `DB_VERSION`
 * bump behind it, and three things fall out of that which are worth more than
 * the memo below costs (decision 14):
 *
 *   - **No migration, ever.** Not for this, and not when the criteria change.
 *   - **It self-heals.** Tune lesson 40's wpm down and every child who was one
 *     wpm short is through, with no backfill and nothing to re-run.
 *   - **It cannot disagree with the record book.** A stored flag and a session
 *     list are two sources of truth for one fact, and they drift the first
 *     time a save half-fails.
 *
 * This is the same kind of function as `records.ts`'s `factStats` and
 * `tableProgress`: sessions in, an answer about a child in, nothing written
 * down. Which sessions belong to which child is the caller's to say — hand it
 * `sessionsFor(sessions, profile.id)`, exactly as the progress screens do.
 */

export type LadderProgress = {
  /** Every lesson number cleared. */
  cleared: ReadonlySet<number>;
  /** The highest cleared. 0 if none. */
  best: number;
  /**
   * What the ladder points at, and the top of what is open: a lesson is
   * unlocked when its number is at or below this.
   */
  next: number;
};

/**
 * The ladder by the string a saved run is filed under, which is what a session
 * carries: `Session.mode` is `typing:L07` for a lesson (§5.4).
 *
 * Keyed on the whole mode rather than on the id inside it so that the two
 * namespaces behind the `typing:` prefix cannot answer for each other. A run
 * of the `home-row` level is not lesson 7 and misses this map, which is the
 * right answer rather than a case to handle: the ladder is the hundred, and a
 * level, a drill or a spelling race is simply not on it.
 */
const BY_MODE = new Map(
  LESSONS.map((lesson) => [typingMode(lesson.id), lesson]),
);

/** The same hundred by the number a child sees, for walking up the ladder. */
const BY_NUMBER = new Map(LESSONS.map((lesson) => [lesson.n, lesson]));

/** The top of the ladder — a hundred today, and read off it rather than typed. */
const LAST = LESSONS.reduce((top, lesson) => Math.max(top, lesson.n), 0);

/**
 * The first lesson above `best` that can actually hold a child up (§8.8).
 *
 * A Hailstorm level never gates: lesson 46 opens when 44 is cleared, whatever
 * happened at 45. Two reasons and either alone is sufficient (decision 24) —
 * **a tablet has no keys to press**, so a child on an iPad who can do the whole
 * course cannot play the game and would be locked out at lesson 4; and **a
 * reward that blocks you is not a reward**, which is the opposite of what the
 * storm levels were put on the ladder for.
 *
 * So the pointer is carried over them. It is carried rather than made to jump:
 * everything at or below `next` is open, so a storm it steps over stays
 * playable — skippable is not the same as skipped.
 */
function carriedOverStorms(best: number): number {
  let next = best + 1;
  while (BY_NUMBER.get(next)?.kind.type === "storm") next += 1;
  return Math.min(next, LAST);
}

function derive(sessions: Session[]): LadderProgress {
  const cleared = new Set<number>();

  for (const session of sessions) {
    const lesson = BY_MODE.get(session.mode);
    // Nothing to learn from a second pass at a lesson already cleared, and
    // `verdictFor` walks every card of the run — so the pass over 2000
    // sessions costs one verdict per lesson, not one per run.
    if (!lesson || cleared.has(lesson.n)) continue;
    // A `Session` is a `Run`: what passes a lesson is what the child did, not
    // which profile did it or when.
    if (verdictFor(session, lesson).passed) cleared.add(lesson.n);
  }

  // ── Unlock is `max(cleared) + 1`, not `count(cleared)` (§6.6) ─────────────
  // Counting would be brittle in a way that only shows up years in:
  // `MAX_SESSIONS_PER_PROFILE` prunes the *oldest* sessions, so a child 2000
  // runs in loses the proof that they ever passed lesson 1 and would be sent
  // back to `fff jjj` by a tally. Taking the maximum means losing old proof
  // costs nothing as long as one later run survives.
  //
  // It is also the whole of the placement test. **Any checkpoint may be
  // attempted at any time** (decision 16), and passing one sets `best` to its
  // number, which clears everything below it by this same line — a
  // nine-year-old who already types opens checkpoint 40, passes it and starts
  // at 41. That is a skip-ahead, a placement test and the ordering rule in one
  // sentence, and it is one sentence precisely because nothing here treats a
  // checkpoint specially. Nor does the loop above ask whether a lesson was
  // unlocked when it was run: failing costs nothing, so trying one is free.
  let best = 0;
  for (const n of cleared) best = Math.max(best, n);

  return { cleared, best, next: carriedOverStorms(best) };
}

/**
 * Remembered per sessions array (§6.5).
 *
 * The pass is over up to `MAX_SESSIONS_PER_PROFILE` (2000) runs and this is
 * called from render, so the answer is kept against the array it was derived
 * from — weakly, so a profile switch or a reload drops it with the sessions
 * themselves. The array is the whole key: the ladder and its criteria are
 * fixed at module load, so the same sessions can only ever mean the same
 * progress in one build. Callers slicing per profile should hold that slice
 * still (a `useMemo`, as the progress screens already do), or every render
 * hands over a fresh array and pays for the pass again.
 */
const MEMO = new WeakMap<Session[], LadderProgress>();

export function ladderProgress(sessions: Session[]): LadderProgress {
  const known = MEMO.get(sessions);
  if (known) return known;

  const progress = derive(sessions);
  MEMO.set(sessions, progress);
  return progress;
}
