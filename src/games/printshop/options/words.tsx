/**
 * A spelling list, and what the sheet asks a child to do with it.
 *
 * The first panel whose first control is the *content* of the sheet rather than
 * a setting on it: every other family draws its problems from a range the engine
 * owns, and this one is handed a list somebody else wrote. So the box comes
 * first, and it is the same box the bootstrap pastes into.
 *
 * Two of the steppers are conditional, and neither is a nicety. Nothing is
 * written three times on a sheet that is only numbered lines, and nothing has
 * letters taken out of it unless the gaps are the exercise — which is also why
 * the columns stepper disappears on the two styles that are a list down the page
 * rather than a grid across it (`wordsLayout` decides).
 */
import { FieldSet, NumberStepper } from "@/components/ui/kit";
import type { WordSheetStyle, WordsConfig } from "@/engine/sheets/types";
import { MAX_GAPS, MAX_TIMES } from "@/engine/sheets/words/spelling";
import { parseWords } from "@/services/decks";

import { Choice, Sizing, WordList, opt, type PanelProps } from "./parts";

/**
 * The seven exercises, in the order a week uses them: look at the word, take it
 * apart, then be tested on it.
 */
const STYLES = [
  opt<WordSheetStyle>("copy", "Write it out"),
  opt<WordSheetStyle>("shapes", "Word shapes"),
  opt<WordSheetStyle>("missing", "Missing letters"),
  opt<WordSheetStyle>("find", "Find the word"),
  opt<WordSheetStyle>("abc", "ABC order"),
  opt<WordSheetStyle>("sentence", "In a sentence"),
  opt<WordSheetStyle>("test", "Spelling test"),
];

/** The styles that put a ruled line under every word, and what to call them. */
const LINES: Partial<
  Record<WordSheetStyle, { legend: string; label: string }>
> = {
  copy: { legend: "Times each", label: "Times each word is written" },
  sentence: { legend: "Lines each", label: "Lines to write a sentence on" },
};

/** The two styles that are one word to a line whatever the config says. */
const DOWN_THE_PAGE: WordSheetStyle[] = ["missing", "find"];

export function WordsPanel({ config, set }: PanelProps<WordsConfig>) {
  const lines = LINES[config.style];

  return (
    <>
      <WordList
        label="Words"
        // Joined back out of the config rather than held as text beside it: the
        // config is the state (`useBuilder`), and a second copy of the list
        // would be the one the sheet was not built from.
        text={config.words.join("\n")}
        onChange={(text) => {
          const words = parseWords(text);
          // The count follows the list unless a parent has said otherwise —
          // "print all of them" is what a list means, and the family caps it at
          // what the page holds anyway.
          set({ words, count: words.length });
        }}
      />

      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />

      {lines && (
        <FieldSet legend={lines.legend}>
          <NumberStepper
            label={lines.label}
            value={config.times}
            min={1}
            max={MAX_TIMES}
            onChange={(times) => set({ times })}
          />
        </FieldSet>
      )}

      {config.style === "missing" && (
        <FieldSet
          legend="Letters out"
          hint="Never the first one, and never two in a row — a child needs the start of the word to work from, and one rule means one letter."
        >
          <NumberStepper
            label="Letters taken out of each word"
            value={config.gaps}
            min={1}
            max={MAX_GAPS}
            onChange={(gaps) => set({ gaps })}
          />
        </FieldSet>
      )}

      <Sizing
        label="Words"
        count={config.count}
        columns={
          DOWN_THE_PAGE.includes(config.style) ? undefined : config.columns
        }
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={3}
      />
    </>
  );
}
