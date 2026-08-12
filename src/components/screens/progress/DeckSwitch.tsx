import { Button } from "@/components/ui/kit";

export type DeckChoice = {
  mode: string;
  /** What sits in the button. A symbol for a sum, a name for a word list. */
  short: string;
  title: string;
};

/**
 * Which deck the progress panels are showing.
 *
 * It sits in the panel heading rather than above it because it changes what
 * the panel *is* — a 12×12 grid of sums or a list of words — not how it's
 * filtered. The four operations are always offered; a word list only appears
 * once the player has actually raced it, because an empty list of words is
 * nothing to look at.
 */
export function DeckSwitch({
  choices,
  current,
  onChoose,
}: {
  choices: DeckChoice[];
  current: string;
  onChoose: (mode: string) => void;
}) {
  return (
    <div className="segmented segmented--slim">
      {choices.map((choice) => (
        <Button
          key={choice.mode}
          variant="bare"
          className={`segmented__btn${current === choice.mode ? " is-on" : ""}`}
          onClick={() => onChoose(choice.mode)}
          pressed={current === choice.mode}
          title={choice.title}
        >
          <span aria-hidden="true">{choice.short}</span>
          <span className="u-sr">{choice.title}</span>
        </Button>
      ))}
    </div>
  );
}
