/**
 * Which sheet is on the bench, and where a sheet about something of yours
 * starts (§14).
 *
 * Shelves across the top, the families on the chosen shelf under them, and
 * under a rule the three doors that start from a child's own facts, a word
 * list or a paste. Every door ends where the shelves do, at `onOpen`, so the
 * rail and the trays are in charge of the sheet afterwards whichever way it
 * arrived.
 *
 * The shelf shown is the one the current sheet is on until a parent looks at
 * another, so opening the chooser shows the sheet in hand among its
 * neighbours rather than the first shelf.
 *
 * The names come from `SHEET_FAMILIES`, so a family added to the engine's table
 * appears without its module (§3); `shelves.ts` says which shelf it is on.
 */
import { useState } from "react";

import { SegmentedControl } from "@/components/ui/kit";
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
  kind: string;
  onFamily: (kind: string) => void;
  onOpen: (config: SheetConfig, seed: number) => void;
}) {
  const [browsing, setBrowsing] = useState<string | null>(null);
  const shelf =
    SHELVES.find((candidate) => candidate.id === browsing) ?? shelfOf(kind);

  return (
    <div className="chooser wrap">
      <p className="chooser__lead">
        Pick what kind of sheet to start from. Every other step can be changed
        afterwards, in any order.
      </p>
      <SegmentedControl
        label="Shelf"
        value={shelf.id}
        onChange={setBrowsing}
        options={SHELF_OPTIONS}
      />
      <SegmentedControl
        label="Sheet"
        value={kind}
        onChange={onFamily}
        options={shelf.families.map((family) =>
          opt(family.id, labelOf(family.id)),
        )}
        className="chooser__families"
      />
      <Bootstrap onOpen={onOpen} />
    </div>
  );
}
