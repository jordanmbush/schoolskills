/**
 * The race, minus the game.
 *
 * Everything in here is true of any timed run against a ghost: the stopwatch
 * and its pause, the 3·2·1, the rival's position on the lane, the HUD, the
 * quit sheet, and scoring-and-saving at the end. None of it knows what a card
 * asks.
 *
 * It lived in `src/games/flashcards/race/` until the typing game needed it.
 * The alternative was one island importing from another, which would have made
 * the flash-card game a dependency of every game after it — and the timing
 * code in `useRaceClock` is the last thing that should acquire callers by
 * accident.
 *
 * **What belongs here:** anything a second game would otherwise copy. What
 * doesn't: how an answer is entered, marked or displayed. Those stay with the
 * game — `AnswerPad`, `CardFace` and `useCardSubmit` are still flash-cards
 * only, and typing has its own.
 *
 * `SplitsTable` sits on the right side of that line even though it prints
 * answers, because it reads a finished `Session` and nothing else: prompt,
 * answer, what was given, how long it took. It is the record of a run, not the
 * surface a run is played on.
 */

export { Hud } from "./Hud";
export { Lane } from "./Lane";
export { QuitSheet } from "./QuitSheet";
export { Rewards } from "./Rewards";
export { RivalList } from "./RivalList";
export { SaveFailed } from "./SaveFailed";
export { SplitsTable } from "./SplitsTable";
export { useCountdown } from "./useCountdown";
export { useGhostGap } from "./useGhostGap";
export { useRaceClock, type RaceClock } from "./useRaceClock";
export { useRaceFinish } from "./useRaceFinish";
export type { Feedback } from "./types";
