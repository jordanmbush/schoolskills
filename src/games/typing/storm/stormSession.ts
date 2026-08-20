import { stormXp } from "@/engine/progress";
import { bestCombo } from "@/engine/typing/storm";

import type { RunTally } from "@/engine/run";
import type { StormState, Wave } from "@/engine/typing/storm";
import type { CardResult, TypingConfig } from "@/engine/types";

/**
 * A storm, as the record book holds it (docs/typing.md §8.7, decision 23).
 *
 * A falling letter maps onto a `CardResult` with nothing forced — `prompt` and
 * `answer` are the character, `given` is what was pressed, `ms` is how long it
 * was in the air, `factId` is the character — so a Hailstorm run **is** a
 * `Session`, filed under `typing:L39` exactly as the lesson at that rung is.
 * Everything downstream then works with no new code at all: the record book
 * lists it, `sessionService.record` pays its XP into the profile, the badge
 * evaluator asks it the same questions it asks a race, and `troubleFacts`
 * ranks its characters for the drill builder.
 *
 * ── Here rather than in the engine ───────────────────────────────────────────
 * Beside the screen that plays a storm, exactly as `lessonRun.ts` sits beside
 * the screen that runs a lesson, and for the same two reasons. It needs
 * `stormXp`, which lives in `progress.ts`, which imports `decks/index.ts` —
 * and `storm.ts` is deliberately kept a hop clear of the deck layer, because
 * STM10 puts a `WaveSpec` on each storm lesson and `lessons.ts` is reachable
 * from `decks/index.ts` (§5.3, decision 7). And what a run of a lesson is
 * filed as is the island's answer to give: the engine is handed a config, it
 * does not compose one.
 *
 * Every function here is pure and takes a finished — or unfinished — run, so
 * `stormSession.test.ts` can ask all of it without a browser.
 */

/**
 * The config a storm run files itself under.
 *
 * `lessonId` is the identity of the run and the one field `modeOf` and
 * `configKey` prefer (§5.4), so a storm is `typing:L39` and keys as
 * `typing|L39|12`. `levelId` carries the same id for the same reason
 * `lessonConfig` does: both fields are read through `lessonId` on a ladder run,
 * and putting anything else in the level would only invite a screen to read it.
 *
 * **`wordCount` is the WAVE's length, never the letters that were faced.**
 * That is the whole of the acceptance criterion about ghosts: `configKey` has
 * to key on the lesson so that retries of a level compare with each other, and
 * a count that moved with how far a child got would file every attempt in a
 * bucket of one — the same failure §5.4 keeps a lesson's generated passage out
 * of the key to avoid. It is also what `survived` reads back off a saved run
 * (`verdict.ts`): "you faced every letter the wave had" is `cards.length >=
 * wordCount`, which only means anything if the second number is the wave's.
 *
 * A storm lesson's own `wordCount` is that same figure (§8.3) but is `0` on
 * every row until STM10 writes the `WaveSpec`s, so the wave in hand is the
 * only place the length can honestly be read from today.
 *
 * **`storm: true` is what keeps it out of the record book's ranking**
 * (decision 50). The key above is deliberately the lesson's, so retries
 * compare with each other — and that is exactly what makes the flag necessary:
 * a group of runs sharing a key is what `bestRun` ranks, and it ranks on time,
 * so without the flag the run that died first would hold the record. It is the
 * only thing here a `lessonConfig` does not also write, and it is inert in
 * `configKey`, so the two configs still key identically — which they must, or
 * STM10 would orphan every storm already saved.
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
 * ── `resolved`, and never `hasLanded` ────────────────────────────────────────
 * The list is walked over `state.resolved` because that is the only honest
 * account of what a run faced. After a breach the clock stops at the fatal
 * `landMs` rather than at the end of the tick that found it, so a letter from a
 * higher index tying that exact millisecond is left unresolved while
 * `hasLanded(letter, state.timeMs)` reads true of it (`tick`). Counting the
 * clock would put a card in a child's record book for a letter the run ended
 * before — the same over-count `zoneTally` refuses on the ending screen.
 *
 * ── A card per letter, and not per keystroke ─────────────────────────────────
 * A wrong key resolves no letter, so it is not a card. That is decision 13's
 * bargain — per-key stats come from cards and not from keystrokes — kept for
 * the storm, and it is what makes `cards.length` mean "letters faced" for
 * `survived`. What a wrong key cost is still in the saved run: it broke the
 * streak, and `bestStreak` is the longest one that survived (`stormTally`).
 *
 * ── The four fields, and why each is what it is ──────────────────────────────
 *   - `prompt`, `answer`, `factId` — the character. One character is one fact,
 *     so `troubleFacts` ranks per key and the drill `buildDrill` returns is a
 *     passage of exactly the keys a child keeps losing letters on.
 *   - `given` — the character for a letter that was shot, and `null` for one
 *     that got through, because nothing was pressed at it. `fire` compares
 *     `code` alone (decision 2), so a capital shot without the shift held
 *     still records the character its key was struck for.
 *   - `ms` — `atMs - spawnMs`: how long the letter was in the air. `atMs` is
 *     the letter's own moment (`LetterOutcome`) — the press for a letter that
 *     was shot and its own `landMs` for one that landed — never the tick that
 *     noticed it, so a run played through a stalled frame is timed by the fall
 *     rather than by the stall.
 *   - `timedOut` — set on a letter that reached the shield. It is what the
 *     flag has always meant: the clock ran out before an answer arrived, and
 *     the clock here is the fall. `troubleFacts` weights a timeout above a
 *     wrong answer, which is the right order for a key whose letter a child
 *     never touched at all. It cannot reach `beat-the-clock`, whose gate is a
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
 * at, folded over the hits and floored at zero (§8.6), so a Hailstorm level
 * and a times-table race pay into one profile on one scale. It is not
 * accumulated here: `resolved` already says which letters were shot, when, and
 * on what streak.
 *
 * `bestStreak` is `bestCombo`, which is the run's own streak and the place a
 * wrong key's cost survives into the record book: the combo it broke is a
 * combo the maximum never saw.
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
