import { stormXp } from "@/engine/progress";
import { bestCombo } from "@/engine/typing/storm";

import type { RunTally } from "@/engine/run";
import type { StormState, Wave } from "@/engine/typing/storm";
import type { CardResult, TypingConfig } from "@/engine/types";

/**
 * A storm, as the record book holds it (docs/typing.md §8.7, decision 23).
 *
 * A falling letter is a `CardResult`, so a run **is** a `Session` and nothing
 * downstream needs new code — the record book, the XP, the badges and the
 * drill builder all read it as they read a race (§8.7).
 *
 * It sits beside the screen that plays a storm, as `lessonRun.ts` does for
 * the one that runs a lesson: it needs `stormXp`, which reaches the deck layer
 * `storm.ts` is kept clear of (§5.3). Every function here is pure, so
 * `stormSession.test.ts` can ask all of it without a browser.
 */

/**
 * The config a storm run files itself under.
 *
 * `lessonId` is the identity of the run and the one field `modeOf` and
 * `configKey` prefer (§5.4), so a storm is `typing:L39` and keys as
 * `typing|L39|28`. `levelId` carries the same id, as `lessonConfig` has it:
 * both are read through `lessonId` on a ladder run, and anything else in the
 * level would only invite a screen to read it.
 *
 * **`wordCount` is the wave's length, not the run's** (§8.7). A count that
 * moved with how far a child got would file every attempt in a bucket of one,
 * and it is also what `survived` reads back off a saved run (`verdict.ts`):
 * `cards.length >= wordCount` only means anything if the second number is the
 * wave's. It is read off the wave in hand, since a saved run outlives its
 * ladder (§5.4).
 *
 * **`storm: true` is what keeps it out of the record book's ranking** (§8.7,
 * decision 50). It is the only thing here a `lessonConfig` does not also
 * write, and it is inert in `configKey`, so a storm and its lesson still key
 * to one string.
 */
export function stormConfig(lessonId: string, wave: Wave): TypingConfig {
  return {
    kind: "typing",
    levelId: lessonId,
    lessonId,
    storm: true,
    wordCount: wave.spec.count,
  };
}

/**
 * The run's letters, as cards — one per letter that was resolved, in wave
 * order.
 *
 * The list is walked over `state.resolved` and never over `hasLanded`. The
 * clock stops at the fatal `landMs` after a breach rather than at the end of
 * the tick that found it, so a letter tying that millisecond from a higher
 * index is left unresolved while `hasLanded` still reads true of it (`tick`) —
 * and counting the clock would file a card for a letter the run ended before
 * (§8.5).
 *
 * A card is a letter's outcome and never a keystroke (§8.7, decision 48), so a
 * wrong key resolves nothing and is not a card — which is what makes
 * `cards.length` mean "letters faced" for `survived`.
 *
 * The four fields:
 *
 *   - `prompt`, `answer`, `factId` — the character. One character is one
 *     fact, so `troubleFacts` ranks per key and `buildDrill` hands back a
 *     passage of exactly the keys a child keeps losing letters on.
 *   - `given` — `null` for a letter that got through, because nothing was
 *     pressed at it. There is no third case: a shot resolves a letter only
 *     when it matched the key AND the shift (decision 70), so a capital can
 *     never be recorded as cleared by the bare letter.
 *   - `ms` — `atMs - spawnMs`. `atMs` is the letter's own moment
 *     (`LetterOutcome`) and never the tick that noticed it, so a run played
 *     through a stalled frame is timed by the fall rather than by the stall.
 *   - `timedOut` — set on a letter that reached the shield (§8.7,
 *     decision 49). It cannot reach `beat-the-clock`, whose gate is a
 *     `timeLimitMs` that a typing config never carries.
 */
export function stormCards(state: StormState): CardResult[] {
  const cards: CardResult[] = [];

  state.resolved.forEach((outcome, index) => {
    if (outcome === null) return;
    const letter = state.wave.letters[index];
    const shot = outcome.outcome === "shot";
    cards.push({
      prompt: letter.ch,
      answer: letter.ch,
      given: shot ? letter.ch : null,
      ok: shot,
      ms: outcome.atMs - letter.spawnMs,
      factId: letter.ch,
      ...(shot ? {} : { timedOut: true }),
    });
  });

  return cards;
}

/**
 * What the run was worth, in the shape `summariseRun` scores every run on.
 *
 * `cardXp` is `stormXp` — the same `cardXp(ms, streak)` a flash card is paid
 * at, folded over the hits and floored at zero (§8.6). It is not accumulated
 * here: `resolved` already says which letters were shot, when, and on what
 * streak.
 *
 * `bestStreak` is `bestCombo`, which is where a wrong key's cost survives into
 * the record book: the combo it broke is a combo the maximum never saw.
 *
 * `maxDeficitMs` is 0 because a storm has no ghost to fall behind. It feeds
 * the `comeback` badge, which also wants `beatGhost`, so nothing reads it.
 */
export function stormTally(state: StormState): RunTally {
  return {
    cards: stormCards(state),
    cardXp: stormXp(state),
    bestStreak: bestCombo(state),
    maxDeficitMs: 0,
  };
}
