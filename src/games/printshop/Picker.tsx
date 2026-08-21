/**
 * Which kind of sheet is on the bench.
 *
 * Built from `SHEET_FAMILIES` rather than from a list here, so a family added
 * to the engine's table appears in the picker without anybody remembering to
 * come and say so — and appears without its module, which is the whole reason
 * that table names a family rather than the family naming itself (§3).
 *
 * The line underneath is the family's own `describe`, which is also what a
 * saved sheet is named after when a parent doesn't name it — one sentence,
 * written once. It is blank for as long as the chosen family is still on its
 * way, which is the only thing on this control that waits for anything.
 */
import { SHEET_FAMILIES } from "@/engine/sheets/families";
import type { SheetSpec } from "@/engine/sheets/spec";
import type { SheetConfig } from "@/engine/sheets/types";

import { Choice, opt } from "./options/parts";

const FAMILIES = SHEET_FAMILIES.map((family) => opt(family.id, family.label));

export function Picker({
  config,
  spec,
  onFamily,
}: {
  config: SheetConfig;
  /** The chosen family, once its module is here. */
  spec: SheetSpec | undefined;
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
      <p className="picker__line">{spec ? spec.describe(config) : ""}</p>
    </div>
  );
}
