import { useEffect, useRef, useState } from "react";

import { keyX } from "@/engine/keyboard";
import { fire, progressAt, startStorm, tick } from "@/engine/typing/storm";

import { HELD } from "../keyboard/useKeyEcho";

import { isDrawn } from "./StormField";

import type { StormState, Wave } from "@/engine/typing/storm";

/**
 * The clock a storm falls on: one `requestAnimationFrame` loop, `tick`, and
 * one number written straight onto each stone (docs/typing.md §8.9).
 *
 * ── The loop holds no rules ──────────────────────────────────────────────────
 * All it does per frame is measure the delta, hand it to `tick`, write each
 * drawn stone's `--drop`, and re-render when the picture — rather than the
 * clock — has changed. Which letters exist, where they are, what a landing
 * costs, what a hit is worth, what a wrong key costs and when a run is over
 * were all settled in `engine/typing/storm.ts` before the first frame. That is
 * what makes the shield's rules answerable by a unit test in a millisecond
 * instead of by somebody watching and hoping, so a rule that migrates into
 * this file is a rule that has stopped being testable. The two engine
 * predicates called here — `progressAt` for where a stone is, `isDrawn` for
 * whether it is on the field — are asked, never restated.
 *
 * ── The trigger is here because the clock is ─────────────────────────────────
 * A shot is fired at `live.current` — the run as this frame left it — and not
 * at the state React last rendered. The rendered one is the last frame whose
 * PICTURE changed, which can be a long way behind: a wave with nothing
 * spawning, landing or being shot re-renders nothing at all, and this
 * stand-in's letters are 300ms apart. Fire from it and a shot resolves against
 * a target read at a stale clock, on a state with every tick since thrown
 * away. So the keydown listener is armed and cancelled with the loop, in the
 * same effect, and hands `fire` the ref.
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
 * the moment somebody adds the eighth world, the one screen in the app that
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
 * The key that leaves a storm (§8.8, decision 55).
 *
 * `Escape` is not on the board — `keyX` says so, which is what keeps it out of
 * the `preventDefault` below — so it is the one key on a keyboard this game
 * has no use for, and therefore the one it can spend on the way out.
 *
 * It has to be known HERE and not only by the screen that acts on it. Every
 * other keydown while the gun is live is a shot, and a shot that missed costs
 * ten points and the streak: an `Escape` handled by a second listener beside
 * this one would still be fired at as a miss on the way past, so a child
 * reaching for the way out would be charged for reaching for it. One listener,
 * one decision, and the quit is taken before the trigger.
 */
export const QUIT_KEY = "Escape";

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
 * is actually a function of is every field of a run except the clock and the
 * wave — so `resolved`, `shield`, `combo`, `score`, `misses` and `ending`,
 * compared here — plus the one thing the clock alone moves: a letter appearing,
 * which no field of `StormState` records because it is a time crossing.
 *
 * The target used to be compared here as well, because two letters at
 * different speeds can cross mid-air with nothing else happening at all
 * (decision 32) and the board went on marking a child's keys against a letter
 * that was no longer the lowest. There is no board now (decision 64), and
 * nothing else on this screen is a function of which letter is the target —
 * the stones carry no target class and the HUD does not name it — so the
 * crossing changes no picture and is no longer a redraw.
 *
 * `score` and `misses` move on **every** miss; `missTintAt` moves only on the
 * ones the throttle lets light, which is `MIN_TINT_GAP_MS` apart at the most
 * (decision 57). So the stamp is covered by the other two today — a frame it
 * moves on is a frame the score moved on as well — and all three are compared
 * anyway, because "the score happens to change whenever the flash does" is a
 * coincidence of two constants in `storm.ts` rather than a property of the
 * screen. A `MISS_POINTS` of zero would leave the HUD's `--flare` flash
 * undrawn, which is a bug nobody would think to look for here — and
 * `missTintAt` is the field the HUD actually mounts that flash from, so it is
 * the one whose absence would be silent.
 *
 * `wave` is the field left out, and deliberately: a run's wave is fixed for
 * its whole life, so it cannot change under a running loop, and a screen
 * handed a different one is a different run rather than a redraw. The effect
 * below is what notices that — it starts the new storm from zero and
 * `setState`s it — so comparing `wave` here would be a second, later answer to
 * a question already settled before the frame.
 *
 * `resolved`, `shield` and `ending` are compared by identity on purpose: the
 * reducer rebuilds each of them only when it changes one, so identity is a
 * true answer for them where it is a false one for the state that holds them.
 * `useStormClock.test.ts` pins the whole shape of a `StormState` against that
 * list — an optional field included — so a story that adds one has to come
 * here and decide whether it is drawn, rather than find out from a screen that
 * stopped updating.
 */
export function redrawn(drawn: StormState, next: StormState): boolean {
  return (
    drawn.resolved !== next.resolved ||
    drawn.shield !== next.shield ||
    drawn.combo !== next.combo ||
    drawn.score !== next.score ||
    drawn.misses !== next.misses ||
    drawn.missTintAt !== next.missTintAt ||
    drawn.ending !== next.ending ||
    onField(drawn) !== onField(next)
  );
}

/**
 * Play a wave: the state a screen draws, and the sky to attach it to.
 *
 * The state handed back is the last frame whose *picture* differed, not the
 * live one — the live one advances every frame and is the loop's own business.
 * Anything that needs the clock to the millisecond is answered from inside the
 * effect against `live.current` — the trigger below is exactly that — rather
 * than from a render, which is the same reason `useRaceClock` keeps its marks
 * in refs.
 */
export function useStormClock(
  wave: Wave,
  {
    paused = false,
    onQuit,
  }: {
    /**
     * Freeze the run: no frames, no wave time, no gun (§8.8, decision 54).
     *
     * This file's cleanup used to say that a quit which kept the field on
     * screen would be a pause, and that a pause is an input rather than an
     * omission. This is that input. A storm with the quit sheet up must not go
     * on falling behind it — a child reading "this won't be saved" while their
     * shield breaks is being charged for asking the question — and it must not
     * go on shooting either, because `Space` and `Enter` are the keys the
     * sheet's own buttons answer to.
     *
     * Both come free from tearing the effect down. rAF is what moves wave
     * time, and `last` starts over at `null` when the loop re-arms, so however
     * long the sheet is up is worth exactly zero to the storm. Nothing here
     * holds a paused-at timestamp for a resume to get wrong.
     */
    paused?: boolean;
    /**
     * What `QUIT_KEY` does, or nothing where a screen offers no way out.
     *
     * Taken here rather than by a listener of the screen's own, because the
     * gun is here: see `QUIT_KEY`.
     */
    onQuit?: () => void;
  } = {},
): {
  state: StormState;
  skyRef: React.RefObject<HTMLDivElement | null>;
} {
  const [state, setState] = useState(() => startStorm(wave));
  /** The run, this frame. Ahead of `state` by up to one frame. */
  const live = useRef(state);
  /** The frame React is showing, which is what `redrawn` compares against. */
  const drawn = useRef(state);
  const skyRef = useRef<HTMLDivElement | null>(null);

  /**
   * Through a ref for the reason `StormRun`'s finish is: a fresh closure every
   * render, and naming it as a dependency would re-arm the loop — and reset
   * `last` — on every re-render of a screen that re-renders on the picture.
   */
  const quitRef = useRef<(() => void) | undefined>(undefined);
  quitRef.current = onQuit;

  useEffect(() => {
    // A run's wave is fixed for its whole life (`StormState.wave`), so this
    // normally arms once per mount. Handed a different storm it starts that
    // one from zero rather than resuming the last one's clock under it.
    if (live.current.wave !== wave) {
      live.current = startStorm(wave);
      drawn.current = live.current;
      setState(live.current);
    }

    // Nothing is armed while the sheet is up: no frame is requested, so no
    // wave time passes, and no listener is bound, so no key fires or is
    // swallowed. Resuming re-runs this effect from the top with `last` null
    // again, which is a first frame worth zero (`stepMs`).
    if (paused) return;

    let frame = 0;
    let last: number | null = null;

    /** Show React the run, if this changed anything it draws. */
    const publish = (next: StormState) => {
      if (!redrawn(drawn.current, next)) return;
      drawn.current = next;
      setState(next);
    };

    /**
     * The gun (§8.6). Every stroke is a shot at the lowest letter for as long
     * as the run is live; the rules for what that is worth are `fire`'s, and
     * none of them are here.
     *
     * Four keydowns are not strokes even while it is, and each is left out
     * for a reason the board already agrees with:
     *
     *   - **`QUIT_KEY`** — the way out (§8.11). It is taken before the trigger
     *     rather than beside it, because a key that reached `fire` would be a
     *     miss: ten points off and the streak gone for asking to leave.
     *   - **`HELD`** — shift, ctrl, alt and the cmd keys. It is the very set
     *     `useKeyEcho` never flares, imported rather than restated: a capital
     *     is a shift and a letter (§3.3), and a game that charged a child for
     *     reaching for the far shift would be charging them for doing it
     *     right.
     *   - **`event.repeat`** — the OS repeating a key that is being held down,
     *     which is one stroke and not thirty a second (decision 44). Firing on
     *     it would let a child spray by leaning on a key, drain a score they
     *     never pressed for, and flash the HUD's miss at 30Hz, which is the
     *     strobe §8.10 forbids.
     *   - A **browser chord** — ctrl or cmd held. Reloading the page is not a
     *     shot at a hailstone, and cmd+`r` is how a child restarts a storm
     *     that is going badly. This is the one place the gun and the board
     *     part company: `useKeyEcho` judges the code alone, so that `r` still
     *     flares. A flare is 120ms and costs nothing; a shot costs ten points
     *     and a streak, and the two are not worth the same benefit of the
     *     doubt.
     *
     * The default is taken for the keys the board draws, and only those: this
     * screen has no input to swallow a space that would otherwise scroll the
     * page, or a `/` that opens Firefox's quick-find mid-run. `keyX` answers
     * "is this key on the layout" without a second list of codes — the layout
     * being the engine's table, since this screen draws no board (decision 64). Anything else
     * — F5, F12, the browser's own — is left alone, because a game screen that
     * ate the reload key would be a screen with no way out.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      // The gun dies with the run, and the listener has to know it rather than
      // leaning on `fire` refusing an ended state. What it would otherwise
      // still do is swallow the default, and by then the track under the sky
      // holds the ending's buttons (`StormField`) — three after a breach, two
      // after a cleared wave, and never none: `Tab`, `Space` and `Enter` are
      // all keys the LAYOUT carries, so all three of those keys pass the very
      // test that calls `preventDefault` below. A gun still eating them
      // after the storm has stopped would leave a child who is not holding a
      // mouse unable to focus a button, let alone press one.
      if (live.current.ending !== null) return;
      if (event.repeat || event.ctrlKey || event.metaKey) return;
      // Before the trigger, and after the chord guard: the way out is not a
      // shot (`QUIT_KEY`), but cmd+Escape is the operating system's.
      if (event.code === QUIT_KEY) {
        quitRef.current?.();
        return;
      }
      if (HELD.has(event.code)) return;
      if (!event.altKey && keyX(event.code) !== null) event.preventDefault();

      const next = fire(live.current, event.code);
      live.current = next;
      publish(next);
    };

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
          // assumed away, and there are two of them: the HUD at the top of the
          // sky and the shield at the bottom. Neither carries `data-stone`, so
          // `Number(undefined)` is `NaN` and indexes no letter.
          const letter = next.wave.letters[Number(stone.dataset.stone)];
          if (letter)
            stone.style.setProperty(
              "--drop",
              String(progressAt(letter, next.timeMs)),
            );
        }

      publish(next);

      // Death and the last letter both stop the clock here, in the frame that
      // ended the run, rather than one render later: `tick` on an ended run is
      // a no-op, so a frame scheduled past the ending would do nothing at all
      // and still be a frame this screen owes the browser.
      if (next.ending === null) frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    // Capture, and on the window, exactly as `useKeyEcho` binds: this screen
    // has no focused element for a stroke to land on, and capture runs ahead
    // of anything that might stop propagation on the way up.
    window.addEventListener("keydown", onKeyDown, true);

    // Every way out of a run runs this, and there are three: the route being
    // left, the run ending, and the pause above. Quitting is now the first of
    // them by way of the third — the sheet pauses the storm, and confirming it
    // navigates — which is why `paused` is an input to this effect rather than
    // something it could have been left to infer.
    //
    // The listener goes with the frame, for a plainer reason than the loop's:
    // one left on the window outlives the screen. It would hold this run's
    // state alive, call `setState` on a component that has gone, and stack a
    // second copy of itself the next time the route is entered. What it would
    // not do is move a score — `fire` refuses an ended run — so the leak would
    // be invisible until the third or fourth storm.
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [wave, paused]);

  return { state, skyRef };
}
