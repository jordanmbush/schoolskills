/**
 * Dice and spinners: how many sides, and what is on them. The sector count is
 * conditional because a die has six faces and always will.
 *
 * There is no control for how big either is drawn. That is what fits on the
 * paper, and the line under the picker says what it came to — a cube two inches
 * on a side, or six sectors of sixty degrees.
 */
import { FieldSet, NumberStepper } from "@/components/ui/kit";
import { SECTORS } from "@/engine/sheets/templates/nets";
import type { NetConfig, NetStyle } from "@/engine/sheets/types";

import { Choice, TextLines, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<NetStyle>("dice", "Dice"),
  opt<NetStyle>("spinner", "Spinner"),
];

export function NetsPanel({ config, set }: PanelProps<NetConfig>) {
  const spinner = config.style === "spinner";

  return (
    <>
      <Choice
        label="What to make"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />

      {spinner && (
        <FieldSet
          legend="Sectors"
          hint="Always equal, whatever is written in them — which is what makes “is it fair?” a question worth asking."
        >
          <NumberStepper
            label="Sectors"
            value={config.sectors ?? 6}
            min={SECTORS.min}
            max={SECTORS.max}
            onChange={(sectors) => set({ sectors })}
          />
        </FieldSet>
      )}

      <TextLines
        label={spinner ? "What is in each sector" : "What is on each face"}
        lines={config.labels ?? []}
        placeholder={spinner ? "red\nblue\ngreen" : "jump\nclap\nspin"}
        rows={3}
        onChange={(labels) => set({ labels })}
        hint={
          spinner
            ? "One a sector, in order from the top. Leave it empty for numbers."
            : "One a face, in the order a die counts. Leave it empty for spots."
        }
      />
    </>
  );
}
