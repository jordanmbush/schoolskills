/**
 * The three ways into a sheet that is already about something (§14) — the
 * lower half of the chooser.
 *
 * None of them is a new kind of sheet: all three end at `onOpen(config, seed)`
 * with a config the rail and the trays can then tune, which is what makes a
 * door a way to start rather than a mode to be in. They sit under the shelves
 * rather than above them because they are the second answer to the chooser's
 * one question — the bench already opens on a finished sheet, so nobody has
 * to start from anything.
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
    <div className="doors">
      <p className="doors__lead">
        Or make a sheet from something of yours. Each one opens here, so the
        paper and the lettering are still yours to change.
      </p>
      <Missed onOpen={onOpen} />
      <FromWordList onOpen={onOpen} />
      <FromPaste onOpen={onOpen} />
    </div>
  );
}

/** A list to print, whoever wrote it: the id, how it reads, and the words. */
type Listed = { id: string; label: string; words: string[] };

/**
 * A word list, as paper — every list this build ships and every list a parent
 * has typed in, in one control.
 *
 * One picker rather than two steps, because a parent picking this week's words
 * is not choosing a subject, they are choosing a list — the same arrangement the
 * passage picker makes with Scripture and the Gettysburg Address (§12). The
 * shipped ones come first and exist whether or not a browser has storage, which
 * is why this step never disappears: all IndexedDB decides is whether a parent's
 * own lists join them.
 */
function FromWordList({ onOpen }: { onOpen: Open }) {
  const [decks, setDecks] = useState<CustomDeck[]>([]);
  const [chosen, setChosen] = useState("");

  useEffect(() => {
    let live = true;
    deckService
      .all()
      // Silent on failure, unlike the missed-facts panel above: a browser with
      // no storage simply offers the shipped lists rather than explaining
      // itself twice on one screen.
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
    <div className="door">
      <h3 className="door__name">A word list</h3>
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
 * Whatever the school letter says. `parseWords` treats newlines, commas, tabs
 * and semicolons all as a word boundary, so a spelling list, a memory verse or a
 * paragraph arrives as a list of words with nobody reformatting anything.
 */
function FromPaste({ onOpen }: { onOpen: Open }) {
  const [text, setText] = useState("");
  const words = deckService.parseWords(text);

  return (
    <div className="door">
      <h3 className="door__name">Something you paste</h3>
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
