import { useEffect, useRef, useState } from "react";

import { keyX } from "@/engine/keyboard";
import { fire, progressAt, startStorm, tick } from "@/engine/typing/storm";

import { HELD } from "../keyboard/useKeyEcho";

import { isDrawn } from "./StormField";
import { playStormSounds } from "./stormSounds";

import type { StormState, Wave } from "@/engine/typing/storm";

/**
 * The clock a storm falls on: one `requestAnimationFrame` loop, `tick`, and
 * one number written straight onto each stone (§8.9).
 *
 * The loop holds no rules. Per frame it measures the delta, hands it to
 * `tick`, writes each drawn stone's `--drop`, plays whatever the frame turned
 * out to sound like, and re-renders only when the picture — rather than the
 * clock — has changed. `progressAt` and `isDrawn` are asked, never restated,
 * and a rule that migrates into this file is a rule that has stopped being
 * answerable by a unit test in a millisecond.
 *
 * `playStormSounds` is called beside `tick` and `fire` rather than from a hook
 * watching the rendered state: those two are the only things that move a run,
 * and a state that never reaches a render is still a state something happened
 * in (§8.12).
 *
 * **The trigger is here because the clock is.** A shot is fired at
 * `live.current` — the run as this frame left it — and never at the state
 * React last rendered, which is the last frame whose PICTURE changed and can
 * be a long way behind: a wave with nothing spawning, landing or being shot
 * re-renders nothing at all. Fire from that and a shot resolves against a
 * target read at a stale clock, on a state with every tick since thrown away.
 * So the keydown listener is armed and cancelled with the loop, in the same
 * effect, and hands `fire` the ref.
 *
 * The stones are DOM elements moved by a custom property rather than a
 * canvas, and the loop writes only the fraction the engine computed — the
 * geometry is the stylesheet's (§8.9, §8.2).
 */

/**
 * The longest step the storm accepts from one frame, in ms (§8.9,
 * decision 38).
 *
 * `tick` resolves every landing inside whatever interval it is handed, however
 * long, so clamping is the clock's call and not the rule's. Without it a
 * backgrounded tab — where rAF is suspended, so coming back is a single frame
 * carrying however many seconds the child was away — would teleport a dozen
 * letters through the shield before the screen had repainted once.
 *
 * No `visibilitychange` listener goes with it: rAF is already suspended for a
 * hidden tab, and the clamp covers the stalls that are not tab switches as
 * well (§8.9).
 */
export const MAX_STEP_MS = 100;

/**
 * The key that leaves a storm (§8.11, decision 55).
 *
 * The `Quit` button in the HUD cannot be reached by tabbing, because `Tab` is
 * one of the keys the live gun swallows — so the keyboard needs its own way
 * out. One listener takes it, and takes it before the trigger: answered
 * anywhere else on this screen it would be charged as a miss first — ten
 * points and the streak for reaching for the door (§8.11).
 *
 * `Escape` is not on the layout (`keyX`), which is what excludes it from the
 * `preventDefault` below as well.
 */
export const QUIT_KEY = "Escape";

/**
 * How much wave time one frame is worth, given the two rAF timestamps around
 * it. `last` is `null` on the first frame of a run, which is worth nothing.
 *
 * Non-finite and negative deltas are floored to zero rather than passed on.
 * The engine floors negatives too, but it cannot defend itself against a
 * `NaN`: one poisons `timeMs` permanently, no letter ever lands again, and a
 * run with no ending has no way out of it.
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
 * Neither `tick` nor `fire` can answer it: an empty tick and a missed shot
 * both return a fresh object, so identity reads as "changed" on every frame
 * and means nothing. What the screen is a function of is every field of a run
 * except the clock and the wave, plus a letter appearing — a time crossing
 * that `StormState` does not record (§8.9).
 *
 * `score` and `misses` move on every miss and `missTintAt` only on the ones
 * the throttle lets light, so the stamp is covered by the other two today. It
 * is compared anyway: that cover is a coincidence of two constants in
 * `storm.ts`, and a `MISS_POINTS` of zero would leave the HUD's `--flare`
 * flash — which mounts from `missTintAt` — silently undrawn.
 *
 * `wave` is the field left out: the effect below is what notices a different
 * one, and it starts that storm from zero.
 *
 * `resolved`, `shield` and `ending` are compared by identity on purpose: the
 * reducer rebuilds each only when it changes one, so identity is a true answer
 * for them where it is a false one for the state that holds them.
 * `useStormClock.test.ts` pins the whole shape of a `StormState` against this
 * list — optional fields included — so a story that adds one has to come here
 * and decide whether it is drawn.
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
 * Anything that needs the clock to the millisecond is answered inside the
 * effect against `live.current`, which is where the trigger is.
 */
export function useStormClock(
  wave: Wave,
  {
    paused = false,
    started = true,
    onStart,
    onQuit,
  }: {
    /**
     * Freeze the run: no frames, no wave time, no gun (§8.11, decision 54).
     *
     * The effect is torn down rather than skipped, so a paused storm neither
     * falls nor listens — `Space` and `Enter` are the keys the quit sheet's
     * own buttons answer to. Resuming re-arms with `last` at `null`, a first
     * frame worth zero, so nothing here holds a paused-at timestamp for a
     * resume to get wrong.
     */
    paused?: boolean;
    /**
     * Has the child said they are ready? (§8.13, decision 71.)
     *
     * The wave hangs at zero — no frames, no wave time — until a key says go.
     * The screen owns the flag; what is owned here is the key that flips it,
     * because while the gun is live every stroke is a shot, so a second window
     * listener beside this one is a way for one press to be answered twice.
     *
     * It defaults to started, which is what a caller with no ready screen — a
     * test, a story that renders a wave to look at it — should get.
     *
     * Distinct from `paused`: pausing is a run held mid-fall with a sheet over
     * it, this is a run that has not had its first frame. Both stop the clock,
     * and only this one is waiting for a key to end it.
     */
    started?: boolean;
    /**
     * Start the run: what the first key press does while `started` is false.
     * Absent on a screen that begins by itself, which never asks for it.
     */
    onStart?: () => void;
    /**
     * What `QUIT_KEY` does, or nothing where a screen offers no way out.
     * Taken here rather than by a listener of the screen's own: see
     * `QUIT_KEY`.
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
   * Through a ref because a fresh closure every render, named as a dependency,
   * would re-arm the loop — and reset `last` — on every re-render of a screen
   * that re-renders on the picture.
   */
  const quitRef = useRef<(() => void) | undefined>(undefined);
  quitRef.current = onQuit;
  const startRef = useRef<(() => void) | undefined>(undefined);
  startRef.current = onStart;

  useEffect(() => {
    // A run's wave is fixed for its whole life (`StormState.wave`), so this
    // normally arms once per mount. Handed a different storm it starts that
    // one from zero rather than resuming the last one's clock under it.
    if (live.current.wave !== wave) {
      live.current = startStorm(wave);
      drawn.current = live.current;
      setState(live.current);
    }

    // Nothing is armed while the sheet is up — see `paused`.
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
     * as the run is live; what that is worth is `fire`'s to say, and a stroke
     * is a code and a shift together because that is what a character is
     * (§8.4, decision 70).
     *
     * Four keydowns are not strokes even while the run is live. `QUIT_KEY` is
     * taken before the trigger, so the way out is not a miss (§8.11). `HELD`
     * is imported from `useKeyEcho` rather than listed again, so one list
     * covers both the keys that never flare and the keys that never cost.
     * `event.repeat` is one stroke and not thirty (§8.6, decision 44). And a
     * browser chord is the one place the gun and the board part company —
     * `useKeyEcho` judges the code alone, so cmd+`r` still flares — because a
     * flare is 120ms and costs nothing, while a shot costs ten points and a
     * streak.
     *
     * The default is taken for the keys the layout carries and only those —
     * `keyX` answers that without a second list of codes. This screen has no
     * input to swallow a space that would otherwise scroll the page or a `/`
     * that opens Firefox's quick-find mid-run, and anything else (F5, F12, the
     * browser's own) is left alone: a game screen that ate the reload key
     * would be a screen with no way out.
     *
     * Before the run starts one press does one thing: it starts it, and `fire`
     * is not called, so the key that says "I'm ready" cannot also be the first
     * miss (§8.13). All four guards hold there, and `Tab` is left out on top
     * of them because it is how the HUD's way out is reached without a mouse.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      // The gun dies with the run rather than leaning on `fire` refusing an
      // ended state, because what it would still do is swallow the default —
      // and by then the track under the sky holds the ending's buttons.
      // `Tab`, `Space` and `Enter` all pass the test that calls
      // `preventDefault` below, so a live gun would leave a child who is not
      // holding a mouse unable to focus one, let alone press it (§8.5).
      if (live.current.ending !== null) return;
      if (event.repeat || event.ctrlKey || event.metaKey) return;
      // Before the trigger, and after the chord guard: the way out is not a
      // shot (`QUIT_KEY`), but cmd+Escape is the operating system's.
      if (event.code === QUIT_KEY) {
        quitRef.current?.();
        return;
      }
      if (HELD.has(event.code)) return;

      // Asked once and read by both branches below: it is what decides the
      // `preventDefault`, and it is also what "any key" means before the run
      // starts.
      const onBoard = keyX(event.code) !== null;

      // The run has not begun: this press begins it, and is spent doing so.
      // `Tab` is the exception — see the block above.
      if (!started) {
        if (!onBoard || event.code === "Tab") return;
        if (!event.altKey) event.preventDefault();
        startRef.current?.();
        return;
      }

      if (!event.altKey && onBoard) event.preventDefault();

      const next = fire(live.current, event.code, event.shiftKey);
      playStormSounds(live.current, next);
      live.current = next;
      publish(next);
    };

    const loop = (now: number) => {
      // Cleared before anything else, so `frame` never holds a handle that
      // has already been delivered: on the frame that ends a run nothing is
      // re-requested below, and this is the difference between "nothing is
      // pending" and a stale number that only looks like it was cancelled.
      frame = 0;
      const next = tick(live.current, stepMs(now, last));
      last = now;
      playStormSounds(live.current, next);
      live.current = next;

      const sky = skyRef.current;
      if (sky)
        for (let i = 0; i < sky.children.length; i++) {
          const stone = sky.children[i] as HTMLElement;
          // Anything in the sky that is not a stone is skipped rather than
          // assumed away — the HUD and the shield carry no `data-stone`, so
          // `Number(undefined)` is `NaN` and indexes no letter.
          const letter = next.wave.letters[Number(stone.dataset.stone)];
          if (letter)
            stone.style.setProperty(
              "--drop",
              String(progressAt(letter, next.timeMs)),
            );
        }

      publish(next);

      // The clock stops in the frame that ended the run rather than a render
      // later: `tick` on an ended run is a no-op, so a frame scheduled past
      // the ending is one this screen owes the browser for nothing.
      if (next.ending === null) frame = requestAnimationFrame(loop);
    };

    // No frame until a child says go, so a waiting wave stays at zero for as
    // long as it waits. The listener is bound either way — it is what does the
    // saying.
    if (started) frame = requestAnimationFrame(loop);
    // Capture, and on the window, exactly as `useKeyEcho` binds: this screen
    // has no focused element for a stroke to land on, and capture runs ahead
    // of anything that might stop propagation on the way up.
    window.addEventListener("keydown", onKeyDown, true);

    // Every way in or out of a run runs this, and there are four: the route
    // being left, the run ending, a pause, and a waiting wave being started.
    // Quitting is the first by way of the third — the sheet pauses the storm,
    // and confirming it navigates.
    //
    // The listener goes with the frame for a plainer reason than the loop's:
    // one left on the window would hold this run's state alive, `setState` on
    // a component that has gone, and stack a second copy of itself the next
    // time the route is entered. What it would not do is move a score — `fire`
    // refuses an ended run — so the leak stays invisible for two or three
    // storms.
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [wave, paused, started]);

  return { state, skyRef };
}
