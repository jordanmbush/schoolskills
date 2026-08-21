/**
 * Which kind of sheet is on the bench.
 *
 * Built from `listSheets()` rather than from a list here, so a family added to
 * the engine's registry appears in the picker without anybody remembering to
 * come and say so.
 *
 * The line underneath is `describeSheet(config)`, which is also what a saved
 * sheet is named after when a parent doesn't name it — one sentence, written
 * once.
 */
import { describeSheet, listSheets } from "@/engine/sheets";
import type { SheetConfig } from "@/engine/sheets/types";

import { Choice, opt } from "./options/parts";

const FAMILIES = listSheets().map((spec) => opt(spec.id, spec.label));

export function Picker({
  config,
  onFamily,
}: {
  config: SheetConfig;
  onFamily: (kind: string) => void;
}) {
  return (
    <div className="picker">
      <Choice
        label="Sheet"
        value={config.kind}
        onChange={onFamily}
        options={FAMILIES}
      />
      <p className="picker__line">{describeSheet(config)}</p>
    </div>
  );
}
