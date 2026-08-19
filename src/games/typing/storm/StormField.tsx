import { isAirborne, progressAt, targetIndex } from "@/engine/typing/storm";

import { LiveKeyboard } from "../keyboard/LiveKeyboard";

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
 * ── What this story does not do ──────────────────────────────────────────────
 * The field is a pure function of a `StormState`: hand it a frame and it draws
 * that frame. It holds no clock, so nothing here moves — STM04 drives `--drop`
 * from a `requestAnimationFrame` loop, and `transform` is deliberately left
 * unused so that loop can write it without disturbing the lane centring (the
 * CSS uses the `translate` property instead). The shield is STM05, and the
 * eight segments belong on the line the letters land on; firing and its
 * reticle are STM06.
 */

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
 * has letters in the air for it to answer with. So a screen that draws
 * anything off that index has to guard for itself, and this is the screen —
 * without it, the board would go on flaring `--flare` at a child whose run was
 * already over, marking their keys against a letter nothing can shoot.
 */
export function aimedAt(state: StormState): string | null {
  if (state.ending !== null) return null;
  const index = targetIndex(state);
  return index === null ? null : state.wave.letters[index].ch;
}

/**
 * The field, as markup: the sky, whatever is falling through it, and the board
 * at the bottom. A pure function of one `StormState` — see the file header for
 * why, and for what the next four stories hang off it.
 */
export function StormField({ state }: { state: StormState }) {
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
      <div className="storm__sky" aria-hidden="true">
        {state.wave.letters.map((letter, index) => {
          // Resolved is gone: a letter that was shot leaves the screen at the
          // press, and one that landed left it at the shield. `isAirborne` is
          // the half-open `[spawnMs, landMs)` the reducer damages the shield
          // on (decision 30) — asking it here rather than re-deciding which
          // side of the millisecond a landing falls on.
          if (state.resolved[index] !== null) return null;
          if (!isAirborne(letter, state.timeMs)) return null;

          return (
            <span
              // The index is the letter's identity (§8.3): the wave is built
              // once and never grows, so this key cannot shift under a letter
              // mid-fall — which it would if the drawn letters were numbered
              // by their position in a filtered list.
              key={index}
              className="storm__letter"
              style={
                {
                  "--lane": letter.lane,
                  "--drop": progressAt(letter, state.timeMs),
                } as CSSProperties
              }
            >
              {letter.ch}
            </span>
          );
        })}
      </div>

      <LiveKeyboard mode="keys" next={aimedAt(state)} />
    </main>
  );
}
