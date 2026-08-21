import { isAirborne, progressAt } from "@/engine/typing/storm";

import { StormHud } from "./StormHud";
import { StormShield } from "./StormShield";

import type { StormState } from "@/engine/typing/storm";
import type { CSSProperties } from "react";

/**
 * Hailstorm's field: the sky the letters fall through, and the shield they
 * land on (§8.2, decision 19).
 *
 * Each letter falls down its own key's column, and no keyboard is drawn under
 * it (§8.2, decision 64). Nothing here computes a lane: `StormLetter.lane` was
 * resolved when the wave was built (§8.3), and this writes it into a custom
 * property `storm.css` multiplies by `--key`, so a lane and the finger zone it
 * lands on cannot disagree about where a key is.
 *
 * **A pure function of one frame.** Hand it a `StormState` and it draws that
 * state; it holds no clock of its own. What moves the stones between frames is
 * `useStormClock`, which writes `--drop` straight onto them on every animation
 * frame and re-renders this only when the picture changes — so the two writers
 * of that property never disagree: React's value is `progressAt` at the frame
 * it is rendering, which is the frame the loop just painted.
 *
 * `skyRef` is how the loop finds the stones, and `data-stone` is how it knows
 * which letter each one is. The HUD and the shield are in the sky beside them
 * and carry no such attribute, which is what makes the loop skip both:
 * `Number(undefined)` is `NaN`, which indexes no letter. An EMPTY one would
 * not — `Number("")` is `0` — and whichever of them held it would be written
 * the first letter's fall, sixty times a second, as though it were the stone.
 *
 * The trigger is not here either. A press has to be answered against the run
 * as the last FRAME left it, and what this component is handed is the last
 * frame whose picture changed — which can be several behind — so the gun is in
 * `useStormClock` beside the loop (§8.9).
 */

/**
 * Is the field drawing this letter at `state.timeMs`?
 *
 * Two things have to agree about that and would drift apart written twice: the
 * sky draws exactly these, and the clock re-renders the sky when the count of
 * them changes — a letter appearing is a time crossing that no field of a
 * `StormState` records, so the loop has nothing else to notice it by.
 *
 * `resolved` first, because it is the half of the answer the clock cannot
 * give: a letter that was shot left the screen at the press, and one that
 * landed left it at the shield. `isAirborne` is the other half, asked rather
 * than restated — re-deciding which side of a millisecond a landing falls on
 * is how a stone becomes both shootable and already spent (decision 30).
 *
 * It is `isAirborne` and never `isFalling`, because a queued letter is on the
 * field and shootable (§8.3): drawing only what falls would hide a letter
 * exactly while a child was meant to be reading it, and would still let them
 * shoot it.
 */
export function isDrawn(state: StormState, index: number): boolean {
  return (
    state.resolved[index] === null &&
    isAirborne(state.wave.letters[index], state.timeMs)
  );
}

/**
 * The field, as markup: the HUD, the sky, whatever is falling through it and
 * the shield they land on. A pure function of one `StormState` — see the file
 * header for why.
 */
export function StormField({
  state,
  skyRef,
  onQuit,
  ready,
  over,
}: {
  state: StormState;
  /** Where `useStormClock` writes the fall, frame by frame. */
  skyRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Ask to leave mid-run, or absent on a screen with no way out (`StormHud`).
   *
   * Handed to the HUD rather than drawn here, because the HUD already owns the
   * top of the sky and its two corners.
   */
  onQuit?: () => void;
  /**
   * What stands in the sky while the wave is waiting to be started, or absent
   * once it is running (§8.13, decision 71).
   *
   * **Its presence is what says the run has not begun**, and that is why it is
   * one prop and not a node beside a boolean: a waiting storm draws no stones,
   * and two props could disagree about that where one cannot.
   *
   * The rest of the field is drawn as it always is — the HUD at nothing, the
   * shield whole — because that is the picture a child is about to have to
   * read.
   */
  ready?: React.ReactNode;
  /**
   * What stands under the sky once the run is over (§8.5).
   *
   * WHEN it appears is decided here and not by the caller, off the same
   * `ending` the gun dies on — one rule, in the file that draws the sky it
   * appears under. The panel itself is the route's, because everything it
   * offers is navigation: a drill, a retry, the way out.
   */
  over?: React.ReactNode;
}) {
  return (
    <main className="storm">
      {/* The screen's name and what it is, for the one visitor who cannot see
          any of it. Everything that moves is hidden one level down, so this
          and the way out are all there is to announce (§8.8) — and while the
          gun is live `Tab` is a key it swallows, so the key that leaves is
          worth naming. */}
      <h1 className="u-sr">Hailstorm</h1>
      {state.ending === null && (
        <p className="u-sr">
          Letters fall down the column of the key that types them. Press that
          key to shoot the lowest one — a capital needs a shift, exactly as it
          would anywhere else — or press Escape to leave.
        </p>
      )}

      {/* Not `aria-hidden` itself, though nearly everything in it is: the
          way out lives in the HUD, so the attribute sits on each churning
          part instead (§8.11, §4.4). */}
      <div className="storm__sky" ref={skyRef}>
        {/* First in the sky, so every stone paints over the numbers rather
            than under them: a score must never hide a letter that has to be
            shot. */}
        <StormHud state={state} onQuit={onQuit} />

        {/* Either the wave, or the beat before it — never both (`ready`). */}
        {ready}

        {state.wave.letters.map((letter, index) => {
          if (ready || !isDrawn(state, index)) return null;

          return (
            <span
              // Hidden for the reason the sky's other churn is: a letter is on
              // screen for a second and a half and is not a thing to announce.
              aria-hidden="true"
              // The index is the letter's identity (§8.3): the wave never
              // grows, so this key cannot shift under a letter mid-fall — as
              // it would if the drawn letters were numbered by their position
              // in a filtered list. `data-stone` carries it into the DOM.
              key={index}
              className="storm__letter"
              style={
                {
                  "--lane": letter.lane,
                  // How long this letter falls for, which the stylesheet
                  // turns into how FAR (§8.2, decision 65). Written here
                  // beside the lane because it is fixed when the wave is
                  // built; the loop writes `--drop` and nothing else.
                  "--fall-ms": letter.fallMs,
                  "--drop": progressAt(letter, state.timeMs),
                } as CSSProperties
              }
              data-stone={index}
            >
              {letter.ch}
            </span>
          );
        })}

        {/* Last in the sky, so a letter reaching the bottom passes BEHIND the
            wall it is breaking rather than in front of it. */}
        <StormShield state={state} />
      </div>

      {/* The ending is the one thing this screen ever puts below the sky, and
          it is rendered rather than overlaid so the frozen hail and the broken
          shield stay readable above it (§8.5). */}
      {state.ending !== null && over}
    </main>
  );
}
