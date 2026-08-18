import { useId } from "react";

/**
 * One choice out of a handful, as a row of pills.
 *
 * This is what the app reaches for instead of a dropdown, and the reason is
 * age: every option is on screen at once, so a five-year-old picks by pointing
 * at the one they want rather than opening a list, reading it and remembering
 * what was in it. `Select` exists for the long lists where that stops working.
 *
 * **Radios, not buttons.** The screens that grew this pattern each built it
 * from `<Button pressed>`, which announces as a row of unrelated toggles and
 * tabs through one stop per option. Real radios sharing a `name` are announced
 * as "one of four", move with the arrow keys and skip to the chosen one with a
 * single Tab — none of which is worth hand-rolling when the platform ships it.
 * The inputs are visually hidden (not `display: none`, which would remove them
 * from the tab order); the `<label>` around each one is the pill, and it wears
 * the focus ring on their behalf.
 *
 * The group needs a name of its own or a screen reader reads four choices
 * belonging to nothing, so `label` is required. Inside a `FieldSet` that will
 * repeat the legend, which is the right kind of redundant.
 *
 * `T` flows through to `onChange`, so a caller keyed on a union — a paper
 * size, an operation — gets that union back rather than a bare string. It is a
 * type parameter and not an import: the kit stays domain-free.
 */
export type SegmentedOption<T extends string> = {
  value: T;
  /** What sits in the pill. A word, or a symbol like "×". */
  label: string;
  /**
   * A glyph shown before the label — "×", "÷". Give one and the label becomes
   * the word that hides under 560px (`.segmented__word`), because the symbol
   * is still there to identify the pill; without one there is nothing to fall
   * back to and the label always shows. It is decorative, `aria-hidden`: what
   * gets announced is `title` if there is one, otherwise the label.
   */
  symbol?: string;
  /**
   * The full name, for when `label` is a symbol. Becomes both the hover
   * tooltip and the announced name — a "×" left to a screen reader's own
   * judgement is read differently by every one of them.
   */
  title?: string;
  /** A quiet second line under the label, for a choice that needs a word. */
  hint?: string;
  disabled?: boolean;
};

export interface SegmentedControlProps<T extends string> {
  /** Names the group. Required — see the doc block. */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** The tighter, monospaced row used where the labels are short. */
  slim?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  slim = false,
  className,
}: SegmentedControlProps<T>) {
  // One `name` per mounted control, so two segmented rows on the same panel
  // are two groups. `useId` is stable across the server render and the client
  // one, which a counter or a random string would not be.
  const name = useId();

  return (
    <div
      className={["segmented", slim ? "segmented--slim" : "", className]
        .filter(Boolean)
        .join(" ")}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <label
            key={option.value}
            className={[
              "segmented__btn",
              option.hint ? "segmented__btn--stack" : "",
              on ? "is-on" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={option.title}
          >
            <input
              className="segmented__radio"
              type="radio"
              name={name}
              value={option.value}
              checked={on}
              disabled={option.disabled}
              aria-label={option.title}
              onChange={() => onChange(option.value)}
            />
            {option.symbol ? (
              <span aria-hidden="true">{option.symbol}</span>
            ) : null}
            {/* `.segmented__word` hides under 560px, so it is worn only when a
                symbol is there to take the pill's place. A row of words that
                all vanished at once would be a row of empty pills. */}
            <span className={option.symbol ? "segmented__word" : undefined}>
              {option.label}
            </span>
            {option.hint ? (
              <span className="segmented__hint">{option.hint}</span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}
