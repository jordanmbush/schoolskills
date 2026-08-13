import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "@/services/sound";

/** The card clock ticks audibly over its last three seconds. */
const TICK_FROM_MS = 3000;

/**
 * Every piece of time in a race: the stopwatch, the per-card clock, the fuse
 * that drains across the card, and the pause that a quit sheet imposes.
 *
 * These live together because they share mutable state that must agree to the
 * millisecond. The banked total, the current card's start mark and the pause
 * mark are read by all four; splitting them apart would mean passing three
 * refs between modules and hoping nobody writes to one without the others.
 */
export type RaceClock = {
  /** Attach to the fuse element. Written to directly — see the loop below. */
  fuseRef: React.RefObject<HTMLDivElement | null>;
  /** Total race time: banked cards plus the live one, frozen while paused. */
  elapsed: () => number;
  /** Milliseconds since the current card appeared. */
  onCard: () => number;
  /** Whole seconds left on this card, or null when there's no card clock. */
  secondsLeft: () => number | null;
  /** Bank a finished card and freeze the fuse where it stands. */
  bank: (ms: number) => void;
  /** Drain the fuse to empty — what a timeout looks like. */
  spendFuse: () => void;
  /** Start the clock on a fresh card. */
  startCard: () => void;
};

export function useRaceClock({
  limitMs,
  racing,
  resolved,
  quitting,
  index,
  onTimeout,
}: {
  /** Fixed for the whole run; null means no per-card clock. */
  limitMs: number | null;
  racing: boolean;
  /** True while a card is showing feedback, which stops its clock. */
  resolved: boolean;
  quitting: boolean;
  /** Which card is up. Re-arms the timer when it changes. */
  index: number;
  onTimeout: () => void;
}): RaceClock {
  const cardStart = useRef(0);
  const banked = useRef(0);
  /** When the quit sheet went up, or 0 while play is running. */
  const pausedAt = useRef(0);
  const fuseRef = useRef<HTMLDivElement | null>(null);
  /** Stops the animation loop from re-inflating the fuse after a card lands. */
  const fuseHeld = useRef(false);
  const [, setTick] = useState(0);

  /**
   * Held in a ref so the per-card timer effect below doesn't depend on a
   * callback identity. The clock re-renders this screen ~16×/second; an effect
   * that depended on a fresh closure would tear down and restart its timer on
   * every one of those renders and never actually fire.
   */
  const timeout = useRef(onTimeout);
  timeout.current = onTimeout;

  const elapsed = () => {
    if (!racing || resolved) return banked.current;
    // Reading the pause mark instead of the wall clock holds the time still
    // while the quit sheet is up.
    const now = pausedAt.current || performance.now();
    return banked.current + (now - cardStart.current);
  };

  /**
   * The four below touch nothing but refs, so they're pinned with an empty
   * dependency list. That isn't a micro-optimisation: `submit` in RaceTrack
   * must keep a stable identity or the per-card timer effect would tear down
   * and restart on every one of the ~16 renders a second the ticker causes,
   * and never fire. Handing it unstable callbacks would break that from here.
   */
  const onCard = useCallback(() => performance.now() - cardStart.current, []);

  const bank = useCallback((ms: number) => {
    banked.current += ms;
    fuseHeld.current = true;
  }, []);

  const spendFuse = useCallback(
    () => fuseRef.current?.style.setProperty("--left", "0"),
    [],
  );

  const startCard = useCallback(() => {
    cardStart.current = performance.now();
    fuseHeld.current = false;
  }, []);

  // Reads props, so it's rebuilt each render — only ever called during render.
  const secondsLeft = () =>
    limitMs === null || !racing || resolved
      ? null
      : Math.max(0, Math.ceil((limitMs - onCard()) / 1000));

  /* ── The ticker ────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!racing) return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last > 60) {
        last = now;
        setTick((t) => t + 1);
      }
      // The fuse is written straight to the DOM rather than rendered: it has
      // to move at full frame rate, and it has to keep draining for players
      // who've asked for reduced motion — so it can't be a CSS animation.
      if (
        limitMs !== null &&
        fuseRef.current &&
        !fuseHeld.current &&
        !pausedAt.current
      ) {
        const left = 1 - (now - cardStart.current) / limitMs;
        fuseRef.current.style.setProperty(
          "--left",
          String(Math.min(1, Math.max(0, left))),
        );
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [racing, limitMs]);

  /**
   * Putting the quit sheet up pauses the card. Resuming shifts the card's
   * start forward by however long the sheet was open, so a pause neither
   * costs time nor buys thinking time. Declared before the timer below so the
   * shift lands before that effect reschedules.
   */
  useEffect(() => {
    if (!racing) return;
    if (quitting) {
      pausedAt.current = performance.now();
    } else if (pausedAt.current) {
      cardStart.current += performance.now() - pausedAt.current;
      pausedAt.current = 0;
    }
  }, [quitting, racing]);

  /**
   * The per-card clock, plus its last-three-seconds ticks. Scheduled once per
   * card. The delay is measured from when the card actually appeared, so a
   * re-run can never hand out extra time.
   */
  useEffect(() => {
    if (limitMs === null || !racing || resolved || quitting) return;
    const left = limitMs - (performance.now() - cardStart.current);
    const timers = [
      window.setTimeout(() => timeout.current(), Math.max(0, left)),
    ];
    for (let at = 1000; at <= TICK_FROM_MS; at += 1000) {
      if (left > at)
        timers.push(window.setTimeout(() => sfx.tick(), left - at));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [limitMs, racing, resolved, index, quitting]);

  return {
    fuseRef,
    elapsed,
    onCard,
    secondsLeft,
    bank,
    spendFuse,
    startCard,
  };
}
