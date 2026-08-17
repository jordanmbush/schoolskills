/**
 * The three ways into a sheet that is already about something (§14).
 *
 * Three buttons and not a wizard, because each one is a source a parent
 * already has: the record book knows what their child keeps missing, the word
 * lists they typed into Word Jungle are sitting in IndexedDB, and this week's
 * spellings are on a letter they can paste. None of the three is a new kind of
 * sheet — they all end at `bench.open(config, seed)` with a config the picker
 * and the panels below can then tune, which is why a bootstrap is a way to
 * start rather than a mode to be in.
 *
 * Everything here goes through a service. The missed facts come from
 * `services/practice.ts` and the saved lists from `services/decks.ts`; nothing
 * in this directory knows that IndexedDB exists, which is the boundary
 * `eslint.config.mjs` enforces and the reason the schema lives in one place.
 */
import { useEffect, useState } from "react";

import { Button, Field, Select } from "@/components/ui/kit";
import { PRACTICE_SEED, wordsSheet } from "@/engine/sheets/practice";
import type { SheetConfig } from "@/engine/sheets/types";
import type { CustomDeck } from "@/engine/types";
import * as deckService from "@/services/decks";

import { Missed } from "./Missed";
import { WordList } from "./options/parts";

type Open = (config: SheetConfig, seed: number) => void;

export function Bootstrap({ onOpen }: { onOpen: Open }) {
  return (
    <section className="bootstrap no-print">
      <h2 className="bootstrap__title u-display">Start from</h2>
      <p className="bootstrap__lead">
        A sheet about something in particular. Every one of these opens on the
        bench, so the style, the paper and the rest are still yours to change.
      </p>
      <Missed onOpen={onOpen} />
      <FromSavedList onOpen={onOpen} />
      <FromPaste onOpen={onOpen} />
    </section>
  );
}

/**
 * A word list a parent already typed in, as paper.
 *
 * Nearly free, and the reason it is here rather than in a later story: the
 * data is in IndexedDB already, parsed already, and a spelling deck is exactly
 * a spelling sheet's content. One press turns this week's list into a
 * worksheet; the style control beside it turns that into three of them.
 */
function FromSavedList({ onOpen }: { onOpen: Open }) {
  const [decks, setDecks] = useState<CustomDeck[]>([]);
  const [chosen, setChosen] = useState("");

  useEffect(() => {
    let live = true;
    deckService
      .all()
      // Silent on failure, unlike the missed-facts panel above: this is the
      // one of the three that a parent has no reason to expect, so a browser
      // with no storage simply doesn't offer it rather than explaining itself
      // twice on one screen.
      .then((loaded) => live && setDecks(loaded))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (decks.length === 0) return null;
  const deck = decks.find((d) => d.id === chosen) ?? decks[0];

  return (
    <div className="bootstrap__step">
      <h3 className="bootstrap__name">A list you saved</h3>
      <Field label="Which list">
        <Select
          value={deck.id}
          onChange={setChosen}
          options={decks.map((d) => ({
            value: d.id,
            label: `${d.emoji} ${d.name} — ${d.words.length} words`,
          }))}
        />
      </Field>
      <Button
        variant="accent"
        size="sm"
        onClick={() => onOpen(wordsSheet(deck.words), PRACTICE_SEED)}
      >
        Make a sheet
      </Button>
    </div>
  );
}

/**
 * Whatever the school letter says.
 *
 * `parseWords` has handled this paste since the day a parent could author a
 * deck — newlines, commas, tabs and semicolons are all a word boundary — so a
 * spelling list, a memory verse or a paragraph all arrive as a list of words
 * without anybody reformatting anything.
 */
function FromPaste({ onOpen }: { onOpen: Open }) {
  const [text, setText] = useState("");
  const words = deckService.parseWords(text);

  return (
    <div className="bootstrap__step">
      <h3 className="bootstrap__name">Something you paste</h3>
      <WordList
        label="Paste a list"
        text={text}
        onChange={setText}
        rows={4}
        hint={
          words.length > 0
            ? `${words.length} ${words.length === 1 ? "word" : "words"} — one a line, or separated by commas.`
            : "This week's spellings, a verse, a paragraph. One a line, or separated by commas."
        }
      />
      <Button
        variant="accent"
        size="sm"
        disabled={words.length === 0}
        onClick={() => onOpen(wordsSheet(words), PRACTICE_SEED)}
      >
        Make a sheet
      </Button>
    </div>
  );
}
