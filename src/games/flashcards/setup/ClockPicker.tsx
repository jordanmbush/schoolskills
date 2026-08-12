import { Button, Input } from "@/components/ui/kit";
import {
  TIME_LIMITS,
  TIME_MAX_MS,
  TIME_MIN_MS,
  TIME_STEP_MS,
} from "@/engine/decks/flashcards";

/**
 * How long a player gets per card, or nothing at all.
 *
 * Two ways in, deliberately: presets for the common answers, and an exact
 * field for the parent who knows their kid needs 3.75 seconds. The field keeps
 * the raw text while it has focus and only snaps to the quarter-second grid on
 * commit — otherwise typing "3.3" on the way to "3.35" would fight the caret.
 */
export function ClockPicker({
  limitMs,
  shownSeconds,
  onPreset,
  onStep,
  onType,
  onDraftEnd,
}: {
  limitMs: number | null;
  /** Raw draft text while focused, otherwise the stored value. */
  shownSeconds: string;
  onPreset: (ms: number | null) => void;
  onStep: (deltaMs: number) => void;
  onType: (text: string) => void;
  onDraftEnd: () => void;
}) {
  return (
    <div className="control">
      <span className="control__label">Time per card</span>
      <div className="segmented">
        {TIME_LIMITS.map(({ ms, label }) => {
          const on = (limitMs ?? null) === ms;
          return (
            <Button
              key={label}
              variant="bare"
              className={`segmented__btn u-mono${on ? " is-on" : ""}`}
              onClick={() => onPreset(ms)}
              pressed={on}
            >
              {label}
            </Button>
          );
        })}
      </div>

      <div className="timelimit">
        <Button
          variant="bare"
          className="timelimit__step u-mono"
          onClick={() => onStep(-TIME_STEP_MS)}
          aria-label="Quarter of a second less"
        >
          −
        </Button>
        <span className="timelimit__field">
          <Input
            className="timelimit__input u-mono"
            type="number"
            inputMode="decimal"
            step={TIME_STEP_MS / 1000}
            min={TIME_MIN_MS / 1000}
            max={TIME_MAX_MS / 1000}
            value={shownSeconds}
            placeholder="off"
            aria-label="Seconds per card"
            blurOnEnter
            onChange={onType}
            onBlur={onDraftEnd}
          />
          <span className="timelimit__unit u-mono">s</span>
        </span>
        <Button
          variant="bare"
          className="timelimit__step u-mono"
          onClick={() => onStep(TIME_STEP_MS)}
          aria-label="Quarter of a second more"
        >
          +
        </Button>
        <span className="timelimit__hint">
          Or set it exactly — quarter-second steps, down to {TIME_MIN_MS / 1000}
          s. Clear the box for no clock.
        </span>
      </div>

      <p className="numbers__note">
        {limitMs
          ? "Run out of time and the answer is shown, then the next card comes up. Anything you miss lands on your practice list."
          : "No card clock. The whole race is timed instead — take as long as you need on any one card."}
      </p>
    </div>
  );
}
