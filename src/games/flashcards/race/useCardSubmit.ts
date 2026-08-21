import { useCallback, useEffect, useRef } from "react";
import { cardXp } from "@/engine/progress";
import { sfx } from "@/services/sound";
import type { Card, CardResult } from "@/engine/types";
import type { DeckSpec } from "@/engine/decks";
import type { Feedback } from "@/games/race/types";

const RIGHT_PAUSE_MS = 320;
const WRONG_PAUSE_MS = 1500;
/** Long enough to actually read an answer you never got to attempt. */
const TIMEOUT_PAUSE_MS = 1900;

/** What the race is counting while it runs. Owned by the caller, which saves it. */
export type TallyRefs = {
  results: React.RefObject<CardResult[]>;
  misses: React.RefObject<number>;
  bestStreak: React.RefObject<number>;
  earnedXp: React.RefObject<number>;
};

/**
 * What happens when an answer arrives: mark it, bank the time, score it, show
 * the verdict, and move on.
 *
 * `submit` must keep a stable identity. The race re-renders roughly sixteen
 * times a second and the per-card clock holds a reference to this callback to
 * call on a timeout — a fresh function every tick would rebind that timer
 * endlessly and it would never fire. So every changing value it reads comes
 * from `live`, and every dependency in the list below is itself pinned.
 */
export function useCardSubmit({
  spec,
  card,
  phase,
  feedback,
  streak,
  total,
  limitMs,
  tally,
  bank,
  spendFuse,
  onCard,
  startCard,
  hasFinished,
  onLastCard,
  setStreak,
  setFeedback,
  setIndex,
  clearEntry,
}: {
  spec: DeckSpec;
  card: Card;
  phase: "countdown" | "racing" | "saving";
  feedback: Feedback;
  streak: number;
  total: number;
  limitMs: number | null;
  tally: TallyRefs;
  bank: (ms: number) => void;
  spendFuse: () => void;
  onCard: () => number;
  startCard: () => void;
  hasFinished: () => boolean;
  onLastCard: () => void;
  setStreak: (streak: number) => void;
  setFeedback: (feedback: Feedback) => void;
  setIndex: (next: (index: number) => number) => void;
  clearEntry: () => void;
}) {
  const advanceTimer = useRef<number | null>(null);
  const live = useRef({ phase, feedback, card, streak, total, limitMs });
  live.current = { phase, feedback, card, streak, total, limitMs };
  // Through a ref rather than a dependency. The four refs inside never change
  // identity, but the object holding them is rebuilt on every render at the
  // call site, and one unstable dependency here un-pins `submit` — which is
  // not a subtle degradation: the keyboard's 90ms auto-submit timer would be
  // cleared and restarted faster than it could ever fire.
  const tallyRef = useRef(tally);
  tallyRef.current = tally;

  /** `null` means the card's clock ran out before an answer arrived. */
  const submit = useCallback(
    (value: string | null) => {
      const { phase, feedback, card, streak, total, limitMs } = live.current;
      if (phase !== "racing" || feedback !== null || hasFinished()) return;
      const tally = tallyRef.current;
      const lateOut = value === null;
      // A timeout banks exactly the limit, so the stopwatch, the fuse and the
      // saved split all agree even if the timer fires a frame or two late.
      // Whole milliseconds keep the saved file readable and the totals exact.
      const ms = lateOut ? limitMs! : Math.round(onCard());
      // Both sides through `normalise`, so "07" marks the same as "7" and
      // "Because" spells "because" — a deck can forgive more without this
      // line changing.
      const ok =
        !lateOut && spec.normalise(value) === spec.normalise(card.answer);
      bank(ms);
      if (lateOut) spendFuse();
      tally.results.current.push({
        prompt: card.prompt,
        answer: card.answer,
        given: value,
        ok,
        ms,
        factId: card.factId,
        ...(lateOut && { timedOut: true }),
      });

      if (ok) {
        const next = streak + 1;
        setStreak(next);
        tally.bestStreak.current = Math.max(tally.bestStreak.current, next);
        tally.earnedXp.current += cardXp(ms, next);
        sfx.correct(next);
      } else {
        setStreak(0);
        tally.misses.current += 1;
        if (lateOut) sfx.timeout();
        else sfx.wrong();
      }

      setFeedback({
        kind: lateOut ? "timeout" : ok ? "right" : "wrong",
        given: value,
      });
      advanceTimer.current = window.setTimeout(
        () => {
          setFeedback(null);
          clearEntry();
          if (tally.results.current.length >= total) {
            onLastCard();
          } else {
            setIndex((i) => i + 1);
            startCard();
          }
        },
        ok ? RIGHT_PAUSE_MS : lateOut ? TIMEOUT_PAUSE_MS : WRONG_PAUSE_MS,
      );
    },
    [
      spec,
      bank,
      spendFuse,
      onCard,
      startCard,
      hasFinished,
      onLastCard,
      setStreak,
      setFeedback,
      setIndex,
      clearEntry,
    ],
  );

  // The pause between a verdict and the next card is this hook's timer, so
  // unmounting mid-pause is this hook's problem: without the clear, leaving
  // the race advances a card that is no longer on screen.
  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  return { submit };
}
