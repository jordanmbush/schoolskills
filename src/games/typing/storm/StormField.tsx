import { isAirborne, progressAt } from "@/engine/typing/storm";

import { StormHud } from "./StormHud";
import { StormShield } from "./StormShield";

import type { StormState } from "@/engine/typing/storm";
import type { CSSProperties } from "react";

/**
 * Hailstorm's field: the sky the letters fall through, and the shield they
 * land on (docs/typing.md §8.2, decision 19).
 *
 * ── A letter falls down the column of its own key ────────────────────────────
 * `f` falls onto `f`. `y` falls between `g` and `h`, because that is where `y`
 * is. That is the whole design and it is the reason `KeyDef.x` is in the
 * engine rather than in the picture of a keyboard: the horizontal position of
 * a falling letter is a spatial hint about where its key is, handed to a child
 * a second or two before they have to find it. The game is not themed around a
 * keyboard — it is teaching the layout geometrically the entire time it is
 * being played.
 *
 * Nothing here computes a lane. `StormLetter.lane` is `keyX(code)` resolved
 * once when the wave was built (§8.3), and this writes it into a custom
 * property that `game.css` multiplies by `--key`. So a lane and the finger
 * zone it lands on cannot disagree about where a key is: they read one
 * `KEY_ROWS` table and one `--key` unit, and neither of them holds a pixel.
 *
 * ── There is no board here, and that is the point ────────────────────────────
 * The lessons draw one under the passage; this does not (§8.2, decision 64).
 * A storm is the exam for the forty lessons that taught the layout, and §8.1's
 * whole claim is that it drills the one thing a passage cannot — finding a key
 * nobody told you about, at speed. A picture of the keyboard on that screen is
 * the answer sheet: the fastest way to shoot a falling `y` becomes reading the
 * board for where `y` is, which is hunt-and-peck with a countdown on it.
 *
 * What is left at the bottom is the shield, and it is a better teacher for
 * being the only thing there. Eight finger zones rather than forty-odd keys,
 * so what a child watches crumble is a FINGER — the thing that is a lesson, a
 * drill and a habit (§8.5). The lane still says which key; the zone under it
 * still says which finger; nothing that was doing work has gone.
 *
 * It buys the sky, too. The board was five rows of keycaps at real pitch
 * (§4.7) and it was taking about 45% of the screen from the only track that
 * gives — so the fall is now roughly twice as long as it was, on the screen
 * whose entire job is giving a child time to read a letter and find its key.
 *
 * ── Still a pure function of one frame ───────────────────────────────────────
 * Hand it a `StormState` and it draws that state; it holds no clock of its
 * own. What moves the stones between frames is `useStormClock`, which writes
 * `--drop` straight onto them on every animation frame and re-renders this
 * only when the picture changes — so the two writers of that property never
 * disagree: React's value is `progressAt` at the frame it is rendering, which
 * is the frame the loop just painted.
 *
 * `skyRef` is how the loop finds the stones, and `data-stone` is how it knows
 * which letter each one is. A rendered index rather than the loop counting
 * children, for the same reason the React key is the index (§8.3): a filtered
 * list renumbers itself the instant something in the middle of it is shot.
 * The HUD and the shield are in the sky beside them and carry no such
 * attribute, which is what makes the loop skip both: `Number(undefined)` is
 * `NaN`, which indexes no letter. An EMPTY one would not — `Number("")` is
 * `0` — and whichever of them held it would be written the first letter's
 * fall, sixty times a second, as though it were the stone.
 *
 * The trigger is not here either. A press has to be answered against the run
 * as the last FRAME left it, and what this component is handed is the last
 * frame whose picture changed — which can be several behind — so the gun is in
 * `useStormClock` beside the loop, and the rules it fires are in the engine
 * (§8.6, §8.9).
 */

/**
 * Is the field drawing this letter at `state.timeMs`?
 *
 * Two things have to agree about that and would drift apart written twice:
 * the sky draws exactly these, and the clock re-renders the sky when the
 * count of them changes — a letter appearing is a time crossing that no field
 * of a `StormState` records, so the loop has nothing else to notice it by.
 *
 * `resolved` first, because it is the half of the answer the clock cannot
 * give: a letter that was shot left the screen at the press, and one that
 * landed left it at the shield. `isAirborne` is the other half, and it is
 * asked rather than restated — it is the half-open `[spawnMs, landMs)` the
 * reducer damages the shield on (decision 30), and re-deciding which side of a
 * millisecond a landing falls on is how a stone becomes both shootable and
 * already spent.
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
  over,
}: {
  state: StormState;
  /** Where `useStormClock` writes the fall, frame by frame. */
  skyRef: React.RefObject<HTMLDivElement | null>;
  /**
   * Ask to leave mid-run, or absent on a screen with no way out (`StormHud`).
   *
   * Handed to the HUD rather than drawn here, because the HUD is the row that
   * already owns the top of the sky and its two corners — a way out placed by
   * this file would be a second opinion about where that row is.
   */
  onQuit?: () => void;
  /**
   * What stands under the sky once the run is over (§8.5, STM07).
   *
   * The ending takes a track of its own rather than being drawn over the sky,
   * which leaves the hail frozen where it stopped and the hole still open
   * under the finger that let it through. While the run is live that track is
   * empty and the sky has the whole field; the ending is the only thing this
   * screen ever puts below it. The panel itself is the route's, because
   * everything it offers is navigation: a drill, a retry, the way out.
   *
   * WHEN it appears is decided here and not by the caller, off the same
   * `ending` the gun dies on — one rule, in the file that draws the sky it
   * appears under.
   */
  over?: React.ReactNode;
}) {
  return (
    <main className="storm">
      {/* The screen's name and what it is, for the one visitor who cannot see
          any of it. Everything that moves is hidden one level down — see the
          sky — so this and the way out are all there is to announce, which is
          honest: the game is a physical keyboard and a reaction time, and a
          child who cannot see the letters cannot play it (§8.8). What they can
          still do is leave, and while the gun is live `Tab` is a key it
          swallows, so the key that does it is worth naming. */}
      <h1 className="u-sr">Hailstorm</h1>
      {state.ending === null && (
        <p className="u-sr">
          Letters fall down the column of the key that types them. Press that
          key to shoot the lowest one, or press Escape to leave.
        </p>
      )}

      {/*
        Not `aria-hidden` itself, though nearly everything in it is: the way
        out lives in the HUD (`StormHud`), and a screen whose only exit was
        inside a hidden subtree would be a trap for exactly the child least
        able to get out of it. So the attribute sits on each churning part —
        the two HUD numbers, every stone, the shield — for the reason the board
        carries one (§4.4): what is in here changes sixty times a second, and a
        live region reading out a hailstorm is a denial of service rather than
        an accommodation.
      */}
      <div className="storm__sky" ref={skyRef}>
        {/* First in the sky, so every stone paints over the numbers rather
            than under them: a score must never hide a letter that has to be
            shot. It is in here rather than in a row of its own because the sky
            is the only track `.storm` can take a row FROM, and on a short
            viewport it has nothing left to give (decision 45, `StormHud`). */}
        <StormHud state={state} onQuit={onQuit} />

        {state.wave.letters.map((letter, index) => {
          if (!isDrawn(state, index)) return null;

          return (
            <span
              // Hidden for the reason the sky's other churn is: a letter is on
              // screen for a second and a half and is not a thing to announce.
              aria-hidden="true"
              // The index is the letter's identity (§8.3): the wave is built
              // once and never grows, so this key cannot shift under a letter
              // mid-fall — which it would if the drawn letters were numbered
              // by their position in a filtered list. `data-stone` carries the
              // same number into the DOM, so the loop moving this element
              // knows which letter it is holding.
              key={index}
              className="storm__letter"
              style={
                {
                  "--lane": letter.lane,
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
            wall it is breaking rather than in front of it — the only place the
            two ever overlap, and the last frame of a fall is exactly where it
            should read as a stone hitting something. */}
        <StormShield state={state} />
      </div>

      {/* Nothing at all while the run is live — the sky has the whole field,
          and what a child looks at is the letters and their own hands (see
          the header). The ending is the one thing this screen ever puts below
          the sky, and it is rendered rather than overlaid so the frozen hail
          and the broken shield stay readable above it. */}
      {state.ending !== null && over}
    </main>
  );
}
