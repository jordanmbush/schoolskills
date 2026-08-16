import { useState } from "react";
import { Button, FilePicker } from "@/components/ui/kit";
import { useHub } from "@/components/state/HubContext";
import { WORD_LISTS } from "@/engine/decks/wordlists";
import { wordsOf } from "@/engine/decks/words";
import { readDeckFile } from "@/services/decks";
import { sfx } from "@/services/sound";
import { canSpeak } from "@/services/speech";
import { DeckEditor } from "./DeckEditor";
import type { CustomDeck, WordConfig } from "@/engine/types";

/**
 * Which words end up on the cards.
 *
 * A list, not a grid: the lists are graded, and picking one is the whole
 * decision. The counterpart to `MathsSettings`.
 *
 * A parent's own lists sit above the shipped ones, because someone who has
 * typed in this week's spellings is here for those and not for Dolch. They
 * carry an Edit button; the shipped lists don't, and can't be deleted.
 *
 * A drill arrives with its words already chosen, so it replaces the list
 * exactly as an arithmetic drill replaces the number grids.
 */
export function WordSettings({
  config,
  onChange,
}: {
  config: WordConfig;
  onChange: (next: WordConfig) => void;
}) {
  const { decks, saveDeck, notify } = useHub();
  const [editing, setEditing] = useState<CustomDeck | null | "new">(null);
  const drill = config.words?.length ? config.words : null;
  const audible = canSpeak();

  if (drill) {
    return (
      <div className="control">
        <span className="control__label">Practice set</span>
        <p className="drill__lead">
          The {drill.length} words you&apos;ve been missing most. Each one
          twice.
        </p>
        <ul className="factchips">
          {drill.map((word) => (
            <li key={word} className="factchip">
              {word}
            </li>
          ))}
        </ul>
        <div className="control__row">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              sfx.tap();
              onChange({ ...config, words: undefined });
            }}
          >
            Pick a list instead
          </Button>
        </div>
      </div>
    );
  }

  async function readShared(file: File) {
    try {
      // Through `saveDeck` like every other write, so the picker updates.
      const deck = await saveDeck(
        null,
        readDeckFile(JSON.parse(await file.text())),
      );
      sfx.record();
      notify(`Added ${deck.name} — ${deck.words.length} words`);
      onChange({ ...config, listId: deck.id });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not read that file",
        "bad",
      );
    }
  }

  const row = (
    // Only what a row actually renders, so a shipped list (which carries
    // entries) and a parent's deck (which carries plain words) both fit.
    list: { id: string; name: string; emoji: string },
    meta: string,
    blurb: string | null,
    own: CustomDeck | null,
  ) => (
    <li key={list.id} className="wordlists__row">
      <Button
        variant="bare"
        className={`wordlists__item${config.listId === list.id ? " is-on" : ""}`}
        pressed={config.listId === list.id}
        onClick={() => {
          sfx.tap();
          onChange({ ...config, listId: list.id });
        }}
      >
        <span className="wordlists__emoji" aria-hidden="true">
          {list.emoji}
        </span>
        <span className="wordlists__body">
          <span className="wordlists__name">{list.name}</span>
          <span className="wordlists__meta">{meta}</span>
          {blurb && <span className="wordlists__blurb">{blurb}</span>}
        </span>
      </Button>
      {own && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            sfx.tap();
            setEditing(own);
          }}
        >
          Edit
        </Button>
      )}
    </li>
  );

  return (
    <div className="control">
      <span className="control__label">Word list</span>
      <ul className="wordlists">
        {decks.map((deck) =>
          row(deck, `Yours · ${deck.words.length} words`, null, deck),
        )}
        {WORD_LISTS.map((list) =>
          row(
            list,
            `${list.group} · ${list.entries.length} words`,
            list.blurb,
            null,
          ),
        )}
      </ul>

      <div className="control__row">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            sfx.tap();
            setEditing("new");
          }}
        >
          ＋ New list
        </Button>
        <FilePicker onFile={readShared}>Open a shared list</FilePicker>
      </div>

      <p className="numbers__preview">
        e.g. {wordsOf(config).slice(0, 4).join(" · ") || "—"}
      </p>
      <p className="numbers__note">
        {audible
          ? "Each word is read out — nothing is shown, so it's spelling rather than copying."
          : "This device has no voice installed, so each word flashes up briefly and then hides."}
      </p>

      {editing !== null && (
        <DeckEditor
          deck={editing === "new" ? null : editing}
          onClose={(saved) => {
            setEditing(null);
            // A saved list becomes the selection; a deleted one leaves the
            // config pointing at an id that's gone, so fall back to a shipped
            // list rather than leaving an empty deck armed.
            if (saved) onChange({ ...config, listId: saved.id });
            else if (
              editing !== "new" &&
              config.listId === editing.id &&
              !decks.some((d) => d.id === editing.id)
            ) {
              onChange({ ...config, listId: WORD_LISTS[0].id });
            }
          }}
        />
      )}
    </div>
  );
}
