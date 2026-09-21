/**
 * Which sheet is on the bench, and where a sheet about something of yours
 * starts (§14).
 *
 * Shelves across the top, the families on the chosen shelf under them, and
 * under a rule the doors that belong to that shelf. Every door ends where the
 * shelves do, at `onOpen`, so the rail and the trays are in charge of the
 * sheet afterwards whichever way it arrived.
 *
 * Before anything is chosen no sheet pill is pressed and the first shelf is
 * showing. Afterwards the shelf is the one the sheet in hand is on, until a
 * parent looks at another, so reopening the chooser shows the sheet among its
 * neighbors rather than the first shelf.
 *
 * The names come from `SHEET_FAMILIES`, so a family added to the engine's table
 * appears without its module (§3); `shelves.ts` says which shelf it is on.
 */
import { useState } from "react";

import { FieldSet, SegmentedControl } from "@/components/ui/kit";
import type { SheetConfig } from "@/engine/sheets/types";

import { Bootstrap } from "./Bootstrap";
import { opt } from "./options/parts";
import { SHELVES, labelOf, shelfOf } from "./shelves";

const SHELF_OPTIONS = SHELVES.map((shelf) => opt(shelf.id, shelf.label));

export function Chooser({
  kind,
  onFamily,
  onOpen,
}: {
  /** The kind on the bench, or nothing while there is no sheet yet. */
  kind: string | null;
  onFamily: (kind: string) => void;
  onOpen: (config: SheetConfig, seed: number) => void;
}) {
  const [browsing, setBrowsing] = useState<string | null>(null);
  const shelf =
    SHELVES.find((candidate) => candidate.id === browsing) ??
    (kind === null ? SHELVES[0] : shelfOf(kind));

  return (
    <div className="chooser wrap">
      <p className="chooser__lead">
        Pick what kind of sheet to start from. Every other step can be changed
        afterwards, in any order.
      </p>
      <FieldSet legend="Shelf">
        <SegmentedControl
          label="Shelf"
          value={shelf.id}
          onChange={setBrowsing}
          options={SHELF_OPTIONS}
        />
      </FieldSet>
      <FieldSet legend="Sheet type">
        <SegmentedControl
          label="Sheet type"
          value={kind ?? ""}
          onChange={onFamily}
          options={shelf.families.map((family) =>
            opt(family.id, labelOf(family.id)),
          )}
          className="chooser__families"
        />
      </FieldSet>
      <Bootstrap shelf={shelf.id} onOpen={onOpen} />
    </div>
  );
}
