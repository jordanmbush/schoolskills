import { useEffect, useState } from "react";
import { Button } from "@/components/ui/kit";
import { clueParts } from "@/engine/decks/words";

/** How long the word stays up when it can't be spoken. */
const FLASH_MS = 1600;

/**
 * The prompt for a word card, which is the one prompt that must not be read.
 *
 * A spelling card showing its own word is a copying exercise, so the word is
 * spoken. What IS shown is the sentence it was spoken in, with the word itself
 * left as a blank — which gives away the meaning and nothing about the
 * spelling. That distinction is the whole design: "their" and "there" are one
 * sound, so a card that only plays the sound has no right answer, while a card
 * reading "This is ___ house" has exactly one. It rescues the words the
 * device's voice mumbles, too.
 *
 * When the device has no voice — Linux with no speech engine, some managed
 * Chromebooks — it falls back to filling the blank in for a moment and taking
 * it away again. That's weaker than hearing it, but it is still recall rather
 * than transcription, and it means the card is never unanswerable. Which
 * fallback is in play is said out loud on the button, because a silent card
 * with no explanation reads as a broken one.
 *
 * A deck a parent typed in has no sentences, so it falls back to the row of
 * dots this screen has always shown.
 */
export function WordPrompt({
  word,
  clue,
  index,
  active,
  audible,
  onSpeak,
}: {
  word: string;
  /** The sentence, with `_` where the word goes. Absent on a custom deck. */
  clue?: string;
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

  const [before, after] = clue ? clueParts(clue) : ["", ""];

  return (
    <div className="wordprompt">
      {clue ? (
        <p className="wordprompt__clue" aria-live="polite">
          {before}
          {shown ? (
            <span className="wordprompt__filled">{word}</span>
          ) : (
            /* An empty element carrying only an aria-label is not reliably
               announced, so the gap says what it is in text instead. */
            <span className="wordprompt__blank">
              <span className="u-sr">blank</span>
            </span>
          )}
          {after}
        </p>
      ) : (
        <p className="card__prompt u-display" aria-live="polite">
          {shown ? (
            word
          ) : (
            <span className="wordprompt__hidden" aria-label="Hidden word">
              • • •
            </span>
          )}
        </p>
      )}

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
