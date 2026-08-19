import { useEffect, useRef, useState } from "react";

import { progressAt, startStorm, tick } from "@/engine/typing/storm";

import { aimedAt, isDrawn } from "./StormField";

import type { StormState, Wave } from "@/engine/typing/storm";

/**
 * The clock a storm falls on: one `requestAnimationFrame` loop, `tick`, and
 * one number written straight onto each stone (docs/typing.md §8.9).
 *
 * ── The loop holds no rules ──────────────────────────────────────────────────
 * All it does per frame is measure the delta, hand it to `tick`, write each
 * drawn stone's `--drop`, and re-render when the picture — rather than the
 * clock — has changed. Which letters exist, where they are, what a landing
 * costs and when a run is over were all settled in `engine/typing/storm.ts`
 * before the first frame. That is what makes the shield's rules answerable by
 * a unit test in a millisecond instead of by somebody watching and hoping, so
 * a rule that migrates into this file is a rule that has stopped being
 * testable. The two engine predicates called here — `progressAt` for where a
 * stone is, `isDrawn` for whether it is on the field — are asked, never
 * restated.
 *
 * ── DOM, not canvas ──────────────────────────────────────────────────────────
 * Twelve absolutely-positioned `<span>`s moved with a transform, not a canvas,
 * and the reason is specific to this site rather than a preference about
 * rendering. The whole app changes biome by swapping one `[data-world]` block
 * of custom properties in `src/styles/worlds.css`: every colour on this screen
 * — the stone's `--ink-800` fill, its `--accent` rim and glow, the `--chalk`
 * glyph, the `--hairline` it lands on — is inherited from that block, which is
 * why the field sits in the glacier without a single `[data-world="ice"]` rule
 * written under it.
 *
 * A canvas is a hole in exactly that. Nothing inside a bitmap inherits, so
 * every one of those colours would have to be read back out with
 * `getComputedStyle` and re-plumbed by hand into fill and stroke calls — and
 * the moment somebody adds the twelfth world, the one screen in the app that
 * is *most* about scenery would be the one screen that silently kept the old
 * one. The cost of the DOM here is a style recalculation on twelve small
 * elements per frame; the cost of the canvas is a biome that stops being one
 * declaration.
 *
 * It is also the pattern the race already uses. `useRaceClock`'s fuse writes
 * `--left` straight to an element and lets `transform: scaleX(var(--left))` in
 * the stylesheet do the moving, for the same two reasons this does: it has to
 * move at full frame rate, and it has to keep moving for a player who asked
 * for reduced motion, so it cannot be a CSS animation.
 *
 * ── `--drop`, not a `translateY` computed here ───────────────────────────────
 * The loop writes the fraction the engine computed and nothing else; the
 * stylesheet multiplies it by the height of the sky (§8.2). That keeps the one
 * property this file has no business holding — geometry — where the lanes and
 * the keycaps already are, off a single `--key` and the sky's own size. A loop
 * that wrote pixels would have to learn how tall the field is, and would be a
 * second opinion about it at every viewport width.
 */

/**
 * The longest step the storm accepts from one frame, in ms.
 *
 * `tick` is deliberately honest about any interval it is handed and resolves
 * every landing inside it, however long — so clamping is the clock's call and
 * not the rule's (decision 35). This is that call, and it is what stops a
 * backgrounded tab from fast-forwarding the wave: `requestAnimationFrame` is
 * suspended while a tab is hidden, so coming back is a single frame carrying
 * however many seconds the child was away, and an unclamped one would teleport
 * a dozen letters through the shield before the screen had repainted once.
 *
 * 100ms is six frames at 60Hz and three at 30Hz, so a step longer than this is
 * not a slow frame — it is a gap: a hidden tab, a laptop resumed from sleep, a
 * long stall. Below ten frames a second the storm therefore runs slow rather
 * than skipping, which is the right way round for a game whose whole demand is
 * a reaction time. Above it the wall clock is authoritative, so the storm is
 * not quietly easier on a slower machine.
 *
 * Pausing on `visibilitychange` is the other half of the option `storm.ts`
 * leaves open, and it is not taken: rAF is already suspended for a hidden tab,
 * so the clamp is the thing that has to be right on the way back — and unlike
 * a visibility listener it also covers the stalls that are not tab switches.
 */
export const MAX_STEP_MS = 100;

/**
 * How much wave time one frame is worth, given the two rAF timestamps around
 * it. `last` is `null` on the first frame of a run, which is worth nothing.
 *
 * Non-finite and negative deltas are floored to zero rather than passed on.
 * The engine floors negatives too, but it cannot defend itself against a
 * `NaN`: `timeMs + NaN` is `NaN` for the rest of the run, no letter ever lands
 * again, and the run has no ending to leave by — an unrecoverable state, from
 * a clock that only has to be wrong once. Two subtractions of real
 * `performance.now()` readings do not produce one, which is exactly why this
 * belongs at the boundary where a reading first becomes a number the rules
 * trust.
 */
export function stepMs(now: number, last: number | null): number {
  if (last === null) return 0;
  const delta = now - last;
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  return Math.min(delta, MAX_STEP_MS);
}

/** How many stones the field is drawing. See `redrawn`. */
function onField(state: StormState): number {
  let count = 0;
  for (let index = 0; index < state.wave.letters.length; index++)
    if (isDrawn(state, index)) count++;
  return count;
}

/**
 * Would React draw a different picture than the one it is already showing?
 *
 * The loop needs this because neither `tick` nor `fire` can answer it:
 * an empty tick and a missed shot both return a fresh object, so `===` on the
 * state says "changed" sixty times a second and means nothing. What the screen
 * is actually a function of is every field of a run except the clock — plus
 * the two things the clock alone moves: a letter appearing (no field of
 * `StormState` records a spawn; it is a time crossing) and the target
 * changing, which two letters at different speeds can do mid-air with nothing
 * else happening at all (decision 32). Miss that one and the board goes on
 * marking a child's keys against a letter that is no longer the lowest.
 *
 * `resolved`, `shield` and `ending` are compared by identity on purpose: the
 * reducer rebuilds each of them only when it changes one, so identity is a
 * true answer for them where it is a false one for the state that holds them.
 * `useStormClock.test.ts` pins the field list against the real shape of a
 * `StormState`, so a story that adds one has to decide here whether it is
 * drawn rather than find out from a screen that stopped updating.
 */
export function redrawn(drawn: StormState, next: StormState): boolean {
  return (
    drawn.resolved !== next.resolved ||
    drawn.shield !== next.shield ||
    drawn.combo !== next.combo ||
    drawn.ending !== next.ending ||
    aimedAt(drawn) !== aimedAt(next) ||
    onField(drawn) !== onField(next)
  );
}

/**
 * Play a wave: the state a screen draws, and the sky to attach it to.
 *
 * The state handed back is the last frame whose *picture* differed, not the
 * live one — the live one advances every frame and is the loop's own business.
 * Anything that needs the clock to the millisecond (a press, when STM06 gives
 * the storm a trigger) has to be answered from inside the loop rather than
 * from a render, which is the same reason `useRaceClock` keeps its marks in
 * refs.
 */
export function useStormClock(wave: Wave): {
  state: StormState;
  skyRef: React.RefObject<HTMLDivElement | null>;
} {
  const [state, setState] = useState(() => startStorm(wave));
  /** The run, this frame. Ahead of `state` by up to one frame. */
  const live = useRef(state);
  /** The frame React is showing, which is what `redrawn` compares against. */
  const drawn = useRef(state);
  const skyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // A run's wave is fixed for its whole life (`StormState.wave`), so this
    // normally arms once per mount. Handed a different storm it starts that
    // one from zero rather than resuming the last one's clock under it.
    if (live.current.wave !== wave) {
      live.current = startStorm(wave);
      drawn.current = live.current;
      setState(live.current);
    }

    let frame = 0;
    let last: number | null = null;

    const loop = (now: number) => {
      // Cleared before anything else, so `frame` never holds a handle that has
      // already been delivered. It is what the cleanup cancels, and on the
      // frame that ends a run nothing is re-requested below — so this is the
      // difference between "nothing is pending" and a stale number that only
      // looks like it was cancelled. (`cancelAnimationFrame` of an unknown
      // handle is a no-op, which is why the lie would never show.)
      frame = 0;
      const next = tick(live.current, stepMs(now, last));
      last = now;
      live.current = next;

      const sky = skyRef.current;
      if (sky)
        for (let i = 0; i < sky.children.length; i++) {
          const stone = sky.children[i] as HTMLElement;
          // Anything in the sky that is not a stone is skipped rather than
          // assumed away — the shield lands on this line in STM05.
          const letter = next.wave.letters[Number(stone.dataset.stone)];
          if (letter)
            stone.style.setProperty(
              "--drop",
              String(progressAt(letter, next.timeMs)),
            );
        }

      if (redrawn(drawn.current, next)) {
        drawn.current = next;
        setState(next);
      }

      // Death and the last letter both stop the clock here, in the frame that
      // ended the run, rather than one render later: `tick` on an ended run is
      // a no-op, so a frame scheduled past the ending would do nothing at all
      // and still be a frame this screen owes the browser.
      if (next.ending === null) frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    // The only exit there is, and every way out runs it. Quitting is one of
    // them today: this screen has no quit control (STM06), so leaving it is a
    // navigation, and a navigation unmounts the route. A quit that instead
    // kept the field on screen would be a pause, and a pause is a thing this
    // effect has to be told about — an input, not an omission.
    return () => cancelAnimationFrame(frame);
  }, [wave]);

  return { state, skyRef };
}
