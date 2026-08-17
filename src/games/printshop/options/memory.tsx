/**
 * Memory work: which passage, and how many times over.
 *
 * Two questions, and the first of them is the same picker copywork uses — the
 * whole point of §12 being that choosing a verse is not a different kind of
 * interaction from choosing a poem. What this family adds is one dial: how many
 * times the passage is written out, which is the progression from the whole
 * thing to none of it.
 *
 * There is no control for *which* words go, and there should not be. That is
 * the seed's job — "another sheet like this one" is `seed + 1` (§7) — and a
 * parent choosing them by hand would be choosing the exercise away.
 */
import { MAX_ROUNDS } from "@/engine/sheets/writing/memory";
import type { MemoryConfig } from "@/engine/sheets/types";

import { FieldSet, NumberStepper } from "@/components/ui/kit";

import { PassageControls } from "./passages";
import type { PanelProps } from "./parts";

export function MemoryPanel({ config, set }: PanelProps<MemoryConfig>) {
  return (
    <>
      <PassageControls
        passage={config.passage}
        translation={config.translation}
        text={config.text}
        onChange={set}
      />

      <FieldSet
        legend="Times written out"
        hint="The whole passage first, none of it last, and more gone each time. Capped at what the page holds."
      >
        <NumberStepper
          label="Times written out"
          value={config.rounds}
          min={1}
          max={MAX_ROUNDS}
          onChange={(rounds) => set({ rounds })}
        />
      </FieldSet>
    </>
  );
}
