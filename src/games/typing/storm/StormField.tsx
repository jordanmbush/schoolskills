import { isAirborne, progressAt, targetIndex } from "@/engine/typing/storm";

import { LiveKeyboard } from "../keyboard/LiveKeyboard";

import { StormHud } from "./StormHud";
import { StormShield } from "./StormShield";

import type { StormState } from "@/engine/typing/storm";
import type { CSSProperties } from "react";

/**
 * Hailstorm's field: the sky the letters fall through, and the gun under it
 * (docs/typing.md §8.2, decision 19).
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
 * property that `game.css` multiplies by `--key`. So the field and the drawn
 * board cannot disagree about where a key is: they read one `KEY_ROWS` table
 * and one `--key` unit, and neither of them holds a pixel.
 *
 * ── The board is the gun ─────────────────────────────────────────────────────
 * `LiveKeyboard` — the same component and the same `useKeyEcho` the lessons
 * put under the passage — rather than a second keyboard drawn for the game.
 * One board means one layout, one echo listener and one set of finger colours;
 * a child who has spent forty lessons learning to glance at that picture
 * should meet the same picture here.
 *
 * `mode="keys"` is doing real work. It keeps the echo's expectation — so the
 * key you fire with lights `--lime` and a wrong one flares `--flare` — while
 * withholding the next-key HINT, which the storm must never show: a board that
 * pointed at the answer would be playing the game for the child, and §8.1's
 * whole claim is that this drills the one thing a passage cannot, which is
 * finding a key you were not told about.
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
 * The character the gun is marked against, or `null` for none.
 *
 * Only the lowest letter on screen can be shot (§8.4), so it is the only one a
 * key can be right for — and the echo needs exactly that character to tell a
 * hit from a miss on the press, before anything has re-rendered (§4.3).
 *
 * The `ending` guard is the whole reason this is a function. `targetIndex`
 * deliberately does not read it: the reducer's question is "which letter is
 * lowest", not "is this run still alive", and a run that ended mid-wave still
 * has letters in the air for it to answer with — frozen where the clock
 * stopped, which is exactly what the ending screen leaves on show. So
 * anything drawn off that index has to guard for itself, and this is where
 * that guard lives for the whole screen.
 *
 * The board is no longer the caller that needs it: a run with an ending hands
 * the board's place to `over` (below), so there is no keyboard left to mark a
 * child's keys against a letter nothing can shoot. It is still the honest
 * answer to "what is the gun on", which is a question `redrawn` asks on every
 * frame and the next screen to ask will be asking of a run that may be over.
 */
export function aimedAt(state: StormState): string | null {
  if (state.ending !== null) return null;
  const index = targetIndex(state);
  return index === null ? null : state.wave.letters[index].ch;
}

/**
 * The field, as markup: the HUD, the sky, whatever is falling through it, the
 * shield they land on and the board at the bottom. A pure function of one
 * `StormState` — see the file header for why.
 */
export function StormField({
  state,
  skyRef,
  over,
}: {
  state: StormState;
  /** Where `useStormClock` writes the fall, frame by frame. */
  skyRef: React.RefObject<HTMLDivElement | null>;
  /**
   * What stands where the board does once the run is over (§8.5, STM07).
   *
   * The board is the gun, so it goes when the gun does — and the ending takes
   * its track rather than being drawn over the sky, which leaves the hail
   * frozen where it stopped and the hole still open under the finger that let
   * it through. The panel itself is the route's, because everything it offers
   * is navigation: a drill, a retry, the way out.
   *
   * WHEN it appears is decided here and not by the caller, off the same
   * `ending` the gun dies on — one rule, in the file that draws both halves of
   * it.
   */
  over?: React.ReactNode;
}) {
  return (
    <main className="storm">
      {/* The screen's name, for the one visitor who cannot see any of it. The
          field itself is hidden below — see the sky. */}
      <h1 className="u-sr">Hailstorm</h1>

      {/*
        `aria-hidden`, for the reason the board is (§4.4): what is in here
        changes sixty times a second under STM04's loop, and a live region
        reading out a hailstorm is a denial of service rather than an
        accommodation. Nothing is announced that a child could act on anyway —
        the game is a physical keyboard and a reaction time. The device with no
        keys is told so honestly, and that is STM09's story.
      */}
      <div className="storm__sky" ref={skyRef} aria-hidden="true">
        {/* First in the sky, so every stone paints over the numbers rather
            than under them: a score must never hide a letter that has to be
            shot. It is in here rather than in a row of its own because the sky
            is the only track `.storm` can take a row FROM, and on a short
            viewport it has nothing left to give (decision 45, `StormHud`). */}
        <StormHud state={state} />

        {state.wave.letters.map((letter, index) => {
          if (!isDrawn(state, index)) return null;

          return (
            <span
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

      {/*
        The board while the gun is live, and the ending in its place afterwards
        (see `over`). `emptyIsWrong` is the honest answer to firing at an empty
        sky (§8.4, decision 43): the reducer charges that stroke `MISS_POINTS`
        and breaks the streak, so the board cannot be allowed to light it
        `--lime` for "that was right" — with nothing in the air there is
        nothing that could be right, and every key flares. It is `true`
        wherever this is drawn at all, because this is drawn while the run is
        live and only then; `aimedAt` is what goes null on the last letter of a
        wave that is still being played.
      */}
      {state.ending === null ? (
        <LiveKeyboard mode="keys" next={aimedAt(state)} emptyIsWrong />
      ) : (
        over
      )}
    </main>
  );
}
