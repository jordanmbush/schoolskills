/**
 * A spelling list, and what the sheet asks a child to do with it.
 *
 * The only panel whose first control is the *content* of the sheet rather than
 * a setting on it: every other family draws its problems from a range the
 * engine owns, and this one is handed a list somebody else wrote. So the box
 * comes first, and it is the same box the bootstrap pastes into — see
 * `WordList` in parts.tsx for why there is only one of them.
 *
 * Two of the four steppers are conditional, and neither is a nicety. Nothing
 * is written three times on a sheet that is only numbered lines, and nothing
 * has letters taken out of it unless the gaps are the exercise. An option that
 * does nothing teaches a parent that the panel doesn't do what it says.
 */
import { FieldSet, NumberStepper } from "@/components/ui/kit";
import type { WordSheetStyle, WordsConfig } from "@/engine/sheets/types";
import { MAX_GAPS, MAX_TIMES } from "@/engine/sheets/words/spelling";
import { parseWords } from "@/services/decks";

import { Choice, Sizing, WordList, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<WordSheetStyle>("copy", "Write it out"),
  opt<WordSheetStyle>("missing", "Missing letters"),
  opt<WordSheetStyle>("test", "Spelling test"),
];

export function WordsPanel({ config, set }: PanelProps<WordsConfig>) {
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

      {config.style === "copy" && (
        <FieldSet legend="Times each">
          <NumberStepper
            label="Times each word is written"
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

      {/* A gapped word is a line of its own, so that sheet has no columns to
          choose — see `wordsLayout`, which is the half of this that decides. */}
      <Sizing
        label="Words"
        count={config.count}
        columns={config.style === "missing" ? undefined : config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={3}
      />
    </>
  );
}
