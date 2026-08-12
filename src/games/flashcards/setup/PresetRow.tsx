import { Button } from "@/components/ui/kit";
import { PRESETS, configKey } from "@/engine/decks/flashcards";
import type { FlashConfig } from "@/engine/types";

/**
 * The one-tap answers, for the player who doesn't want to configure anything.
 *
 * A preset reads as chosen when the CURRENT config matches it exactly —
 * compared by `configKey`, the same identity the record book uses to decide
 * whether two runs are comparable. So tweaking any dial below silently
 * un-chooses the preset, which is the honest thing for it to do.
 */
export function PresetRow({
  currentKey,
  onChoose,
}: {
  currentKey: string;
  onChoose: (config: FlashConfig) => void;
}) {
  return (
    <section className="panel anim-rise">
      <div className="panel__head">
        <h2 className="panel__title">Pick a race</h2>
      </div>
      <div className="preset-row">
        {PRESETS.map((preset) => {
          const chosen = configKey(preset.config) === currentKey;
          return (
            <Button
              key={preset.id}
              variant="bare"
              className={`preset${chosen ? " is-chosen" : ""}`}
              onClick={() => onChoose(preset.config)}
              pressed={chosen}
            >
              <span className="preset__emoji" aria-hidden="true">
                {preset.emoji}
              </span>
              <span className="preset__name u-display">{preset.name}</span>
              <span className="preset__tag">{preset.tagline}</span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
