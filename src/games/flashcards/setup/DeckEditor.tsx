import { useEffect, useRef, useState } from "react";
import { Button, Field, Input, Scrim, TextArea } from "@/components/ui/kit";
import { useHub } from "@/components/state/HubContext";
import { MAX_WORDS, MIN_WORDS, parseWords, toFile } from "@/services/decks";
import { sfx } from "@/services/sound";
import type { CustomDeck } from "@/engine/types";

const EMOJI = ["✏️", "📚", "🐝", "🦉", "🚀", "🌟", "🧩", "🐙"];

/**
 * Typing in this week's spellings.
 *
 * One textarea rather than a row of fields, because the list is being copied
 * off a school letter or a phone screenshot and retyping it into twelve inputs
 * is how a parent decides not to bother. Anything separated by a newline, a
 * comma, a semicolon or a tab is a word — see `parseWords`.
 *
 * Editing an existing list doesn't disturb races already run on it: they're
 * filed under the deck's id, not its contents. Removing a word stops it being
 * asked; it stays in the record book, which is right — it was practised.
 */
export function DeckEditor({
  deck,
  onClose,
}: {
  /** The list being edited, or null to start a new one. */
  deck: CustomDeck | null;
  onClose: (saved: CustomDeck | null) => void;
}) {
  const { saveDeck, deleteDeck, notify } = useHub();
  const [name, setName] = useState(deck?.name ?? "");
  const [emoji, setEmoji] = useState(deck?.emoji ?? EMOJI[0]);
  const [text, setText] = useState((deck?.words ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const nameField = useRef<HTMLInputElement>(null);

  // Focused here rather than with `autoFocus`, which the a11y rule bans and
  // rightly: on page load it steals focus from the document. In a sheet the
  // parent just opened, landing in the first field is what they expect.
  useEffect(() => {
    nameField.current?.focus();
  }, []);

  const words = parseWords(text);
  const tooMany = words.length > MAX_WORDS;
  const ready = name.trim() !== "" && words.length >= MIN_WORDS && !tooMany;

  async function save() {
    setBusy(true);
    try {
      const saved = await saveDeck(deck?.id ?? null, { name, emoji, words });
      sfx.record();
      notify(`Saved ${saved.name} — ${saved.words.length} words`);
      onClose(saved);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not save that list",
        "bad",
      );
      setBusy(false);
    }
  }

  function share() {
    if (!deck) return;
    sfx.tap();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(toFile(deck), null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `schoolskills-${deck.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify("Saved the list — send that file to another family");
  }

  return (
    <div className="sheet">
      <Scrim onClose={() => onClose(null)} label="Close" />
      <div className="sheet__panel">
        <h2 className="sheet__title u-display">
          {deck ? "Edit list" : "New word list"}
        </h2>

        <Field label="Name">
          <Input
            ref={nameField}
            value={name}
            onChange={setName}
            placeholder="Week 12 spellings"
            maxLength={40}
          />
        </Field>

        <span className="control__label">Icon</span>
        <div className="emojirow">
          {EMOJI.map((choice) => (
            <Button
              key={choice}
              variant="bare"
              className={`emojirow__pick${emoji === choice ? " is-on" : ""}`}
              pressed={emoji === choice}
              onClick={() => {
                sfx.tap();
                setEmoji(choice);
              }}
            >
              <span aria-hidden="true">{choice}</span>
              <span className="u-sr">Icon {choice}</span>
            </Button>
          ))}
        </div>

        <Field
          label="Words"
          hint="One per line, or separated by commas. Duplicates are dropped."
        >
          <TextArea
            className="field__input deckeditor__words"
            value={text}
            onChange={setText}
            rows={8}
            spellCheck={false}
            autoCapitalize="off"
            placeholder={"because\nthought\nfriend"}
          />
        </Field>

        <p className={`deckeditor__count${tooMany ? " is-bad" : ""}`}>
          {words.length} word{words.length === 1 ? "" : "s"}
          {tooMany && ` — that's more than ${MAX_WORDS}`}
          {!tooMany &&
            words.length < MIN_WORDS &&
            ` — a list needs at least ${MIN_WORDS}`}
        </p>

        <div className="sheet__actions">
          <Button variant="ghost" onClick={() => onClose(null)} disabled={busy}>
            Cancel
          </Button>
          {deck && (
            <Button variant="ghost" onClick={share} disabled={busy}>
              Share as a file
            </Button>
          )}
          {deck && !confirming && (
            <Button
              variant="danger"
              onClick={() => setConfirming(true)}
              disabled={busy}
            >
              Delete
            </Button>
          )}
          {deck && confirming && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await deleteDeck(deck.id);
                // Deliberately not "…and its races". Deleting a list must not
                // delete the practice done on it, and saying so here is the
                // only place a parent finds that out before clicking.
                notify(`Deleted ${deck.name}. Past races are kept.`);
                onClose(null);
              }}
            >
              Really delete?
            </Button>
          )}
          <Button variant="go" onClick={save} disabled={!ready || busy}>
            {deck ? "Save list" : "Create list"}
          </Button>
        </div>
      </div>
    </div>
  );
}
