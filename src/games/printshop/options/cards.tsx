/**
 * The paper that gets cut up: which card, how many to a page, and what is on
 * them.
 *
 * The count is a `Choice` rather than a stepper, and that is the one thing in
 * this panel worth reading twice. How many cards fit *across* is a fact about
 * the shape of a card — four bookmarks to a page is four columns of one, four
 * flashcards is two by two — so a free number would be a control offering
 * layouts the family would then quietly move somebody off. The list comes out
 * of the family's own table (`layoutsFor`), so a style that gains a twelve-up
 * gains it here with nothing to remember.
 *
 * The size of a card is not a control at all. It is what fits, rounded down to
 * an eighth of an inch, and it is printed in the line under the picker — which
 * is `describeSheet` and is the same sentence a saved sheet is named after.
 */
import { Checkbox, Field, Input } from "@/components/ui/kit";
import { canFold, layoutsFor } from "@/engine/sheets/templates/cards";
import { MAX_TITLE } from "@/engine/sheets/share";
import type { CardStyle, CardsConfig } from "@/engine/sheets/types";

import { PassageControls } from "./passages";
import { Choice, WordList, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<CardStyle>("flashcard", "Flashcards"),
  opt<CardStyle>("name-tag", "Name tags"),
  opt<CardStyle>("bookmark", "Bookmarks"),
  opt<CardStyle>("verse-card", "Memory verse cards"),
  opt<CardStyle>("certificate", "Certificate"),
];

/** The two styles whose faces are a list of words somebody typed. */
const WORDED: CardStyle[] = ["flashcard", "name-tag"];

/** And the two that carry a passage — a verse on a card, or on a bookmark. */
const VERSED: CardStyle[] = ["bookmark", "verse-card"];

export function CardsPanel({ config, set }: PanelProps<CardsConfig>) {
  const layouts = layoutsFor(config.style).map((layout) =>
    opt(String(layout.up), `${layout.up} up`),
  );

  return (
    <>
      <Choice
        label="What to cut out"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />

      <Choice
        label="To a page"
        value={String(config.up ?? layoutsFor(config.style)[0].up)}
        onChange={(up) => set({ up: Number(up) })}
        options={layouts}
        hint="The cards are as large as the page allows, to the nearest eighth of an inch."
      />

      {canFold(config.style) && (
        <Checkbox
          label="Fold in half to stand up"
          hint="A tent. The top half prints upside down, so it reads from both sides once it is folded."
          checked={config.fold === true}
          onChange={(fold) => set({ fold })}
        />
      )}

      {WORDED.includes(config.style) && (
        <WordList
          label={config.style === "name-tag" ? "Names" : "Words"}
          // Joined back out of the config rather than held beside it, for the
          // reason the spelling panel gives: the config is the state, and a
          // second copy of the list would be the one the sheet was not built
          // from. Leaving it empty is what "blank flashcards" means.
          text={(config.words ?? []).join("\n")}
          onChange={(text) =>
            set({
              words: text
                .split(/[\n,;\t]+/)
                .map((word) => word.trim())
                .filter((word) => word !== ""),
            })
          }
          hint="One a line. Leave it empty for blank cards."
        />
      )}

      {VERSED.includes(config.style) && (
        <PassageControls
          passage={config.passage}
          translation={config.translation}
          text={config.text}
          onChange={set}
        />
      )}

      {config.style === "certificate" && (
        <>
          <Field
            label="What the award is called"
            hint="Printed across the top. The name and the date are lines to fill in by hand."
          >
            <Input
              value={config.title ?? ""}
              maxLength={MAX_TITLE}
              placeholder="Certificate of Achievement"
              onChange={(title) => set({ title })}
            />
          </Field>
          <Field
            label="What it is for"
            hint="Leave it empty and the sheet rules a line to write it on instead."
          >
            <Input
              value={config.reason ?? ""}
              maxLength={MAX_TITLE}
              placeholder="for finishing the twelve times tables"
              onChange={(reason) => set({ reason })}
            />
          </Field>
        </>
      )}
    </>
  );
}
