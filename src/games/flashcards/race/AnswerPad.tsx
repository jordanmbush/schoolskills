import { Button } from "@/components/ui/kit";
import type { InputMode } from "@/engine/types";

/**
 * However the player answers: a keypad they type into, or four choices they
 * tap. Both are the same job, so the caller picks a mode rather than deciding
 * which component to render.
 *
 * The keyboard shortcuts for both live in RaceTrack — they're window-level
 * listeners tied to the race's own state, not to whatever is on screen.
 */
export function AnswerPad({
  mode,
  choices,
  disabled,
  onDigit,
  onBack,
  onEnter,
  onChoose,
}: {
  mode: InputMode;
  choices: string[] | undefined;
  disabled: boolean;
  onDigit: (digit: string) => void;
  onBack: () => void;
  onEnter: () => void;
  onChoose: (choice: string) => void;
}) {
  if (mode === "choose") {
    return (
      <div className="choices">
        {(choices ?? []).map((choice, i) => (
          <Button
            key={choice}
            variant="bare"
            className="choices__btn u-mono"
            disabled={disabled}
            onClick={() => onChoose(choice)}
          >
            <span className="choices__key">{i + 1}</span>
            {choice}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="keypad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
        <Button
          key={digit}
          variant="bare"
          className="keypad__key u-mono"
          disabled={disabled}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </Button>
      ))}
      <Button
        variant="bare"
        className="keypad__key keypad__key--util"
        disabled={disabled}
        onClick={onBack}
        aria-label="Delete"
      >
        ⌫
      </Button>
      <Button
        variant="bare"
        className="keypad__key u-mono"
        disabled={disabled}
        onClick={() => onDigit("0")}
      >
        0
      </Button>
      <Button
        variant="bare"
        className="keypad__key keypad__key--enter"
        disabled={disabled}
        onClick={onEnter}
        aria-label="Submit"
      >
        ↵
      </Button>
    </div>
  );
}
