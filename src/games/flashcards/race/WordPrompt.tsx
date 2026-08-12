import { useEffect, useState } from "react";
import { Button } from "@/components/ui/kit";

/** How long the word stays up when it can't be spoken. */
const FLASH_MS = 1600;

/**
 * The prompt for a word card, which is the one prompt that must not be read.
 *
 * A spelling card showing its own word is a copying exercise, so the word is
 * spoken and this shows only a control to hear it again.
 *
 * When the device has no voice — Linux with no speech engine, some managed
 * Chromebooks — it falls back to flashing the word and taking it away. That's
 * weaker than hearing it, but it is still recall rather than transcription,
 * and it means the card is never unanswerable. Which fallback is in play is
 * said out loud in the hint, because a silent card with no explanation reads
 * as a broken one.
 */
export function WordPrompt({
  word,
  index,
  active,
  audible,
  onSpeak,
}: {
  word: string;
  /** Card number. Re-arms the flash and re-enables replay on a new card. */
  index: number;
  /**
   * Racing. The first card mounts during the 3·2·1 countdown, so a flash that
   * started on mount would be over before the clock began — the player would
   * simply never see the first word.
   */
  active: boolean;
  audible: boolean;
  onSpeak: () => void;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (audible || !active) {
      setShown(false);
      return;
    }
    setShown(true);
    const timer = window.setTimeout(() => setShown(false), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [index, active, audible]);

  return (
    <div className="wordprompt">
      <p className="card__prompt u-display" aria-live="polite">
        {shown ? (
          word
        ) : (
          <span className="wordprompt__hidden" aria-label="Hidden word">
            • • •
          </span>
        )}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="btn btn--ghost btn--sm wordprompt__again"
        // Nothing to replay before the race starts, and a press during the
        // countdown would hand over the first word for free.
        disabled={!active}
        onClick={() => {
          if (audible) {
            onSpeak();
            return;
          }
          setShown(true);
          window.setTimeout(() => setShown(false), FLASH_MS);
        }}
      >
        {audible ? "🔊 Hear it again" : "👀 Show it again"}
      </Button>
    </div>
  );
}
