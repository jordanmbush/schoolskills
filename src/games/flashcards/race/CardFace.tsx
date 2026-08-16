import { comboMultiplier } from "@/engine/progress";
import type { Card, InputMode } from "@/engine/types";
import { WordPrompt } from "./WordPrompt";
import type { Feedback } from "@/games/race/types";

/**
 * The card itself: the fuse draining across the top, the prompt, whatever the
 * player has entered so far, and the combo badge.
 *
 * `fuseRef` belongs to the race clock, which writes the drain position
 * straight to the DOM every frame rather than through React.
 */
export function CardFace({
  card,
  index,
  feedback,
  entry,
  inputMode,
  limitMs,
  secondsLeft,
  streak,
  fuseRef,
  racing,
  audible,
  onSpeak,
}: {
  card: Card;
  index: number;
  feedback: Feedback;
  entry: string;
  inputMode: InputMode;
  limitMs: number | null;
  secondsLeft: number | null;
  streak: number;
  fuseRef: React.RefObject<HTMLDivElement | null>;
  /** Past the countdown. A word card must not give itself away before then. */
  racing: boolean;
  /** Whether this device can say a word out loud. See `WordPrompt`. */
  audible: boolean;
  onSpeak: () => void;
}) {
  const combo = comboMultiplier(streak);
  return (
    <section className={`card${feedback ? ` card--${feedback.kind}` : ""}`}>
      {limitMs !== null && (
        // Keyed on the card so a new card remounts it with a full bar. The
        // prefix keeps it from colliding with the combo badge's key.
        <div
          key={`fuse-${index}`}
          ref={fuseRef}
          className={`fuse${secondsLeft !== null && secondsLeft <= 3 ? " is-urgent" : ""}${feedback?.kind === "timeout" ? " is-spent" : ""}`}
        >
          <span className="fuse__track">
            <span className="fuse__fill" />
          </span>
          <span className="fuse__num u-mono" aria-hidden="true">
            {secondsLeft ?? 0}
          </span>
        </div>
      )}
      {card.speak ? (
        <WordPrompt
          // `prompt`, not `speak`: what's spoken is now the word AND the
          // sentence it sits in, and the no-voice fallback flashes the word.
          word={card.prompt}
          clue={card.clue}
          index={index}
          active={racing}
          audible={audible}
          onSpeak={onSpeak}
        />
      ) : (
        <p className="card__prompt u-display" aria-live="polite">
          {card.prompt}
        </p>
      )}
      <div className="card__answer">
        {feedback?.kind === "timeout" ? (
          <span className="card__truth u-mono">
            <span className="card__late">Out of time</span> {card.answer}
          </span>
        ) : feedback?.kind === "wrong" ? (
          <span className="card__truth u-mono">
            <s>{feedback.given}</s> {card.answer}
          </span>
        ) : card.speak ? (
          // Nothing: a word card types into a real field, which already shows
          // what's been entered. Echoing it here would be the same text twice.
          <></>
        ) : inputMode === "type" ? (
          <span className={`card__entry u-mono${entry ? "" : " is-empty"}`}>
            {entry || "?"}
          </span>
        ) : (
          <span className="card__entry u-mono is-empty">?</span>
        )}
      </div>
      {streak >= 3 && (
        <span key={streak} className="combo anim-pop">
          🔥 {streak} in a row · ×{combo.toFixed(1)} XP
        </span>
      )}
    </section>
  );
}
