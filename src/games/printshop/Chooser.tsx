/**
 * Which sheet is on the bench, and where a sheet about something of yours
 * starts (§14).
 *
 * The shelves across the top, called subjects on screen because that is the
 * word a parent has for them; the families on the chosen shelf under them;
 * and under a rule the doors that belong to that shelf. Every door ends where
 * the shelves do, at `onOpen`, so the rail and the trays are in charge of the
 * sheet afterwards whichever way it arrived.
 *
 * One question at a time. Before a subject is chosen the sheet types are not
 * shown, so a first visit asks one thing and nothing is pressed. Once there
 * is a sheet, the shelf showing is the one it is on; choosing another subject
 * takes the sheet off the bench, because a type from one subject cannot stand
 * under another, and the bench is back to this step until a type is picked.
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
  onClear,
}: {
  /** The kind on the bench, or nothing while there is no sheet yet. */
  kind: string | null;
  onFamily: (kind: string) => void;
  onOpen: (config: SheetConfig, seed: number) => void;
  /** Take the sheet off the bench; called when the subject changes under it. */
  onClear: () => void;
}) {
  const [browsing, setBrowsing] = useState<string | null>(null);
  const shelf =
    SHELVES.find((candidate) => candidate.id === browsing) ??
    (kind === null ? undefined : shelfOf(kind));

  const browse = (id: string) => {
    setBrowsing(id);
    if (kind !== null && shelfOf(kind).id !== id) onClear();
  };

  return (
    <div className="chooser wrap">
      <p className="chooser__lead">
        Pick a subject, then what kind of sheet to start from. Every other step
        can be changed afterwards, in any order.
      </p>
      <FieldSet legend="Subject">
        <SegmentedControl
          label="Subject"
          value={shelf?.id ?? ""}
          onChange={browse}
          options={SHELF_OPTIONS}
        />
      </FieldSet>
      {shelf && (
        <>
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
        </>
      )}
    </div>
  );
}
