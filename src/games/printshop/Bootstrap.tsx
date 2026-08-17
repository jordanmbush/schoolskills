/**
 * The three ways into a sheet that is already about something (§14).
 *
 * Three buttons and not a wizard, because each one is a source a parent
 * already has: the record book knows what their child keeps missing, the sight
 * words this build ships and the lists they typed into Word Jungle are both a
 * list already, and this week's spellings are on a letter they can paste. None
 * of the three is a new kind of sheet — they all end at
 * `bench.open(config, seed)` with a config the picker and the panels below can
 * then tune, which is why a bootstrap is a way to start rather than a mode to be
 * in.
 *
 * Everything here goes through a service. The missed facts come from
 * `services/practice.ts` and the saved lists from `services/decks.ts`; nothing
 * in this directory knows that IndexedDB exists, which is the boundary
 * `eslint.config.mjs` enforces and the reason the schema lives in one place.
 */
import { useEffect, useState } from "react";

import { Button, Field, Select } from "@/components/ui/kit";
import { SHIPPED_LISTS, listWords } from "@/engine/decks/wordlists";
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
      <FromWordList onOpen={onOpen} />
      <FromPaste onOpen={onOpen} />
    </section>
  );
}

/** A list to print, whoever wrote it: the id, how it reads, and the words. */
type Listed = { id: string; label: string; words: string[] };

/**
 * A word list, as paper — the shipped sight-word lists and every list a parent
 * has typed in, in one control.
 *
 * Nearly free, and the reason it is here rather than in a later story: both
 * sources are already parsed, and a spelling deck is exactly a spelling sheet's
 * content. One press turns this week's list into a worksheet; the style control
 * beside it turns that into seven of them.
 *
 * The two are one picker rather than two steps because a parent choosing a list
 * is not thinking about where it came from. The shipped ones are listed first
 * and are always there, which is the reason this step no longer disappears: the
 * Dolch lists exist whether or not a browser has storage, so the only thing
 * IndexedDB decides is whether a parent's own lists join them.
 *
 * Every shipped list, which since PRINT23 means the books of the Bible, the
 * names, the places and the Bible words as well as Dolch — one control with all
 * of them in it, exactly as the passage picker has Scripture and the Gettysburg
 * Address in one list (§12). A parent picking this week's words is not choosing
 * a subject; they are choosing a list.
 */
function FromWordList({ onOpen }: { onOpen: Open }) {
  const [decks, setDecks] = useState<CustomDeck[]>([]);
  const [chosen, setChosen] = useState("");

  useEffect(() => {
    let live = true;
    deckService
      .all()
      // Silent on failure, unlike the missed-facts panel above: a browser with
      // no storage simply offers the shipped lists rather than explaining itself
      // twice on one screen.
      .then((loaded) => live && setDecks(loaded))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const lists: Listed[] = [
    ...SHIPPED_LISTS.map((list) => ({
      id: list.id,
      label: `${list.emoji} ${list.name} — ${list.group}`,
      words: listWords(list),
    })),
    ...decks.map((deck) => ({
      id: deck.id,
      label: `${deck.emoji} ${deck.name} — ${deck.words.length} words`,
      words: deck.words,
    })),
  ];
  const list = lists.find((one) => one.id === chosen) ?? lists[0];
  if (!list) return null;

  return (
    <div className="bootstrap__step">
      <h3 className="bootstrap__name">A word list</h3>
      <Field label="Which list">
        <Select
          value={list.id}
          onChange={setChosen}
          options={lists.map(({ id, label }) => ({ value: id, label }))}
        />
      </Field>
      <Button
        variant="accent"
        size="sm"
        onClick={() => onOpen(wordsSheet(list.words), PRACTICE_SEED)}
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
