import { Button } from "@/components/ui/kit";
import { WORD_LISTS } from "@/engine/decks/wordlists";
import { wordsOf } from "@/engine/decks/words";
import { sfx } from "@/services/sound";
import { canSpeak } from "@/services/speech";
import type { WordConfig } from "@/engine/types";

/**
 * Which words end up on the cards.
 *
 * A list, not a grid: the lists are graded, and picking one is the whole
 * decision. The counterpart to `MathsSettings`.
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

  return (
    <div className="control">
      <span className="control__label">Word list</span>
      <ul className="wordlists">
        {WORD_LISTS.map((list) => (
          <li key={list.id}>
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
                <span className="wordlists__meta">
                  {list.group} · {list.words.length} words
                </span>
                <span className="wordlists__blurb">{list.blurb}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <p className="numbers__preview">
        e.g. {wordsOf(config).slice(0, 4).join(" · ")}
      </p>
      <p className="numbers__note">
        {audible
          ? "Each word is read out — nothing is shown, so it's spelling rather than copying."
          : "This device has no voice installed, so each word flashes up briefly and then hides."}
      </p>
    </div>
  );
}
