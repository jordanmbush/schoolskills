import type { Session } from "@/engine/types";

import { typingMode } from "@/engine/decks/typing";
import { LESSONS, lessonNumbered } from "./lessons";
import { verdictFor, type Run } from "./verdict";

/**
 * How far up the ladder a child has got (docs/typing.md §6.5, §6.6).
 *
 * Everything here is **derived from the sessions the hub has already loaded**:
 * no `passedLessons` field, no new object store and no `DB_VERSION` bump, for
 * the three reasons §6.5 gives (decision 14).
 *
 * This is the same kind of function as `records.ts`'s `factStats` and
 * `tableProgress`: sessions in, an answer about a child out, nothing written
 * down. Which sessions belong to which child is the caller's to say — hand it
 * `sessionsFor(sessions, profile.id)`, exactly as the progress screens do.
 */

/**
 * What the ladder needs of a run, which is less than a whole `Session`.
 *
 * `verdictFor`'s `Run` — what the child did — plus the string the run is filed
 * under, which is what says *which* lesson they did it on. Asking for an id or
 * a `finishedAt` on top would cost something real: the badge evaluator
 * (`engine/progress.ts`) asks this about the run that has just finished,
 * before the session service has written it and given it either field. A
 * ladder that insisted would have made that caller cast, and a cast is a
 * promise nobody checks.
 */
export type LadderRun = Run & Pick<Session, "mode">;

export type LadderProgress = {
  /** Every lesson number cleared. */
  cleared: ReadonlySet<number>;
  /** The highest cleared. 0 if none. */
  best: number;
  /**
   * What the ladder points at: `best + 1`, carried past any Hailstorm level
   * standing in the way (§8.8) and capped at the top of the ladder. On a
   * profile with no runs at all it is 1.
   *
   * **It is not the whole unlock rule**, and a screen that opens a tile on
   * `n <= next` alone is wrong in the direction that locks a child out. A
   * lesson is openable when *either* `n <= next` — the storm levels the
   * pointer stepped over included — *or* it is a checkpoint: all ten are open
   * at every value of `next`, on a profile that has never run anything
   * included, which is what makes the placement test work (§6.6, decisions 16
   * and 24). Nothing else gates, and a failed attempt costs nothing.
   */
  next: number;
};

/**
 * The ladder by the string a saved run is filed under, which is what a session
 * carries: `Session.mode` is `typing:L07` for a lesson (§5.4).
 *
 * Keyed on the whole mode rather than on the id inside it, so the two
 * namespaces behind the `typing:` prefix cannot answer for each other. A run
 * of the `home-row` level is not lesson 7 and misses this map, which is the
 * right answer rather than a case to handle: a free-play level, a drill or a
 * spelling race is simply not on the ladder.
 */
const BY_MODE = new Map(
  LESSONS.map((lesson) => [typingMode(lesson.id), lesson]),
);

/** The top of the ladder — a hundred today, and read off it rather than typed. */
const LAST = LESSONS.reduce((top, lesson) => Math.max(top, lesson.n), 0);

/**
 * The first lesson above `best` that can actually hold a child up.
 *
 * A Hailstorm level never gates: lesson 46 opens when 44 is cleared, whatever
 * happened at 45 (§8.8, decision 24). The pointer is carried over them rather
 * than made to jump, so everything at or below `next` is open and a storm it
 * steps over stays playable — skippable is not the same as skipped.
 */
function carriedOverStorms(best: number): number {
  let next = best + 1;
  while (lessonNumbered(next)?.kind.type === "storm") next += 1;
  return Math.min(next, LAST);
}

function derive(sessions: readonly LadderRun[]): LadderProgress {
  const cleared = new Set<number>();

  for (const session of sessions) {
    const lesson = BY_MODE.get(session.mode);
    // `verdictFor` walks every card of the run, and there is nothing to learn
    // from a second pass at a lesson already cleared — so replaying a beaten
    // lesson is free, however many times. Runs of a lesson *not* yet cleared
    // each still pay a verdict, retries included, until one clears it.
    if (!lesson || cleared.has(lesson.n)) continue;
    // ── A lesson is cleared by a run that says it IS that lesson ───────────
    // The mode is not enough on its own. `buildDrill` files a practice deck
    // under the mode it came from, so the drill a child takes from lesson 41's
    // results — or from the finger a storm broke (§8.5) — is also
    // `typing:L41`: ten to forty words of trouble keys that would otherwise
    // clear the lesson it was offered from without the lesson ever being run.
    // `lessonId` is the discriminator §5.4 put on the config for exactly this,
    // and `progress.ts` reads the badges off it for the same reason. A run
    // from before the ladder existed carries neither, so nothing already saved
    // changes.
    if (session.config?.kind !== "typing") continue;
    if (session.config.lessonId !== lesson.id) continue;
    if (verdictFor(session, lesson).passed) cleared.add(lesson.n);
  }

  // ── Unlock is `max(cleared) + 1`, not `count(cleared)` (§6.6) ─────────────
  // Counting would be brittle in a way that only shows up years in, because
  // `MAX_SESSIONS_PER_PROFILE` prunes the *oldest* sessions. Taking the
  // maximum is also what makes the placement test a line rather than a case,
  // since passing checkpoint 40 clears 1–39 with it. Nor does the loop above
  // ask whether a lesson was unlocked when it was run: trying one is free.
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
 * progress in one build. **Callers slicing per profile must hold that slice
 * still** (a `useMemo`, as the progress screens do), or every render hands
 * over a fresh array and pays for the pass again.
 */
const MEMO = new WeakMap<readonly LadderRun[], LadderProgress>();

export function ladderProgress(sessions: readonly LadderRun[]): LadderProgress {
  const known = MEMO.get(sessions);
  if (known) return known;

  const progress = derive(sessions);
  MEMO.set(sessions, progress);
  return progress;
}
