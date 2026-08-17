/**
 * A list, and which puzzle to make out of it.
 *
 * The second panel whose first control is the *content* of the sheet rather
 * than a setting on it, and it is the same box the spelling panel and the
 * bootstrap use — one `WordList`, one rule about what counts as a word.
 *
 * Four of the controls are the word search's alone, and they disappear on the
 * other two styles rather than greying out. There is no grid on a scramble
 * sheet for a direction to run in, and an option that does nothing teaches a
 * parent that the panel doesn't do what it says. The grid stepper is a request
 * either way — `searchLayout` shrinks a grid that will not fit the paper with
 * its word list under it — which is why the hint says so.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import type {
  PuzzleConfig,
  PuzzleStyle,
  SearchDirections,
} from "@/engine/sheets/types";
import { MAX_GRID, MIN_GRID } from "@/engine/sheets/words/puzzles";
import { parseWords } from "@/services/decks";

import { Choice, Sizing, WordList, opt, type PanelProps } from "./parts";

/** The three, easiest first: hunt for it, unjumble it, then work it out. */
const STYLES = [
  opt<PuzzleStyle>("search", "Word search"),
  opt<PuzzleStyle>("scramble", "Word scramble"),
  opt<PuzzleStyle>("crossword", "Crossword"),
];

const DIRECTIONS = [
  opt<SearchDirections>("across", "Across"),
  opt<SearchDirections>("across-down", "Across and down"),
  opt<SearchDirections>("all", "Diagonals too"),
];

export function PuzzlesPanel({ config, set }: PanelProps<PuzzleConfig>) {
  const search = config.style === "search";

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
          set({ words, count: words.length });
        }}
        hint="One a line, or separated by commas. Anything that isn't a letter is left out of a grid — a square holds one letter."
      />

      <Choice
        label="Puzzle"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />

      {config.style === "crossword" && (
        <p className="picker__line">
          Clued from the sentence each word already has in the sight-word lists.
          A word from your own list is clued by its letters, jumbled.
        </p>
      )}

      {search && (
        <>
          <FieldSet
            legend="Grid"
            hint="Squares across and down. Shrunk if it won't fit the page with the word list under it."
          >
            <NumberStepper
              label="Squares across and down"
              value={config.size}
              min={MIN_GRID}
              max={MAX_GRID}
              onChange={(size) => set({ size })}
            />
          </FieldSet>

          <Choice
            label="Which way words run"
            value={config.directions}
            onChange={(directions) => set({ directions })}
            options={DIRECTIONS}
          />

          <Checkbox
            label="Some words written backwards"
            checked={config.reverse}
            onChange={(reverse) => set({ reverse })}
          />

          <Checkbox
            label="Words may cross each other"
            checked={config.overlap}
            hint="Off makes a sparser grid — and the likeliest way a word ends up with nowhere to go."
            onChange={(overlap) => set({ overlap })}
          />
        </>
      )}

      {/* Only a scramble lays its words out across the page: a grid and a clue
          list are each the width of the paper. */}
      <Sizing
        label="Words"
        count={config.count}
        columns={config.style === "scramble" ? config.columns : undefined}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={3}
      />
    </>
  );
}
