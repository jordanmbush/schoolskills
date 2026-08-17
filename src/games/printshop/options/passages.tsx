/**
 * Which words are on the sheet — one picker, every source, Scripture first.
 *
 * §12 in a control. The collections come out of the library in the library's
 * own order, which puts Psalm 23 and the Gettysburg Address in the same
 * dropdown with the same two clicks between them; there is no Scripture mode to
 * switch into and no separate section to find, because a mode is the thing this
 * story exists to not build. What Scripture adds is one more question — which
 * translation — and it is asked where it applies and nowhere else.
 *
 * "Your own words" is the last entry rather than a fourth control. Pasting a
 * verse is choosing a source, the same as picking one off the shelf, and a
 * paste box sitting under a chosen passage doing nothing would be a box that
 * lies about what is on the page (`copyworkSource` prefers the library).
 *
 * Two families share it — copywork and memory work — which is why it is here
 * beside `parts.tsx` rather than inside either panel. They ask for exactly the
 * same three fields, so a second copy would be a second answer to "what does
 * clearing the passage mean".
 */
import { Field, TextArea } from "@/components/ui/kit";
import {
  PASSAGE_COLLECTIONS,
  TRANSLATION_LIST,
  listPassages,
  passage as passageById,
  type TranslationId,
} from "@/engine/sheets/passages";

import { Choice, opt } from "./parts";

/** The three fields a passage travels in, on either family's config. */
export type PassageFields = {
  passage?: string;
  translation?: TranslationId;
  text?: string;
};

/**
 * "Your own words", as a collection id that is not one.
 *
 * The empty string rather than a sentinel word, because absent is already what
 * the config means by "no passage chosen" — inventing an `"own"` to store would
 * be a second way of saying the same thing in every saved sheet.
 */
const OWN = "";

const SOURCES = [
  ...PASSAGE_COLLECTIONS.map((collection) =>
    opt(collection.id, collection.name, collection.blurb),
  ),
  opt(OWN, "Your own words", "a verse or a passage you paste"),
];

const TRANSLATIONS = TRANSLATION_LIST.map((translation) =>
  opt(translation.id, translation.name),
);

/**
 * Every passage, resolved once at module load.
 *
 * The library is static data and the picker lists all of it, so the alternative
 * to doing this here is doing it on every keystroke in the builder — a
 * debounced rebuild already runs on each of those, and this is the one list on
 * the screen that cannot have changed since the last one.
 */
const CHOICES = listPassages();

const inCollection = (collection: string) =>
  CHOICES.filter((entry) => entry.collection === collection);

/**
 * Which source is showing, read back off the passage rather than stored beside
 * it — the same bargain `RulingControls` makes with the grid pitch. A second
 * field naming the collection would be a second thing that can disagree with
 * the passage it claims to hold.
 */
const sourceOf = (chosen?: string): string =>
  (chosen ? passageById(chosen)?.collection : undefined) ?? OWN;

export function PassageControls({
  passage,
  translation,
  text,
  onChange,
}: PassageFields & { onChange: (patch: PassageFields) => void }) {
  const source = sourceOf(passage);
  const chosen = passage ? passageById(passage) : undefined;
  const scripture = chosen?.kind === "scripture";

  return (
    <>
      <Choice
        label="Where the words come from"
        value={source}
        // Moving to another shelf takes the first thing on it, so the sheet is
        // never showing a passage that belongs to a collection it isn't in.
        onChange={(next) =>
          onChange({ passage: next ? inCollection(next)[0]?.id : undefined })
        }
        options={SOURCES}
      />

      {source !== OWN && (
        <Choice
          label="Passage"
          value={passage ?? ""}
          onChange={(next) => onChange({ passage: next })}
          options={inCollection(source).map((entry) =>
            opt(entry.id, entry.title),
          )}
          // The provenance, on the screen where the passage is chosen: who
          // wrote it, and the credit the sheet will print under it (§12).
          hint={
            [chosen?.attribution, chosen?.credit].filter(Boolean).join(" · ") ||
            undefined
          }
        />
      )}

      {scripture && (
        <Choice
          label="Translation"
          value={translation ?? TRANSLATION_LIST[0].id}
          onChange={(next) => onChange({ translation: next })}
          options={TRANSLATIONS}
          hint="Both are public domain. Never a licensed translation — see the note in the engine."
        />
      )}

      {source === OWN && (
        <Field
          label="Your own passage"
          hint="Broken where the line runs out. A line break of your own is kept."
        >
          <TextArea
            value={text ?? ""}
            rows={4}
            onChange={(next) => onChange({ text: next })}
          />
        </Field>
      )}
    </>
  );
}
