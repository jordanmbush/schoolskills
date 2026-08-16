import type { BlockProps } from "./block";

/** A, B, C … and then numbers, so a long list never runs out of labels. */
const label = (index: number): string =>
  index < 26 ? String.fromCharCode(65 + index) : String(index + 1);

/**
 * Multiple choice.
 *
 * The correct option is marked on the key by a rule under it, not by a filled
 * or tinted box. Ink-saving is a feature rather than an accident (§5) — and a
 * background is the one kind of mark a browser drops when printing, so a key
 * that used one would print identical to the sheet it answers.
 */
export function Choice({ block, metrics }: BlockProps<"choice">) {
  return (
    <ol className="sheet__questions">
      {block.questions.map((question, index) => (
        <li className="sheet__question" key={`${index}-${question.prompt}`}>
          <p className="sheet__ask">
            <span className="sheet__number">{index + 1}.</span>
            {question.prompt}
          </p>
          <ol className="sheet__options">
            {question.options.map((option, choice) => (
              <li
                className={`sheet__option${
                  metrics.answers && choice === question.answer
                    ? " sheet__option--answer"
                    : ""
                }`}
                key={`${choice}-${option}`}
              >
                <span className="sheet__mark">{label(choice)}</span>
                {option}
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
