/**
 * The guides on a model (§25), asked the same way by both families that
 * write on a ruling: which models carry the start dot, the arrow and the
 * number on each stroke.
 *
 * Three answers rather than a checkbox, because the usual answer is neither
 * all nor none. A single letter or a pair carries them and a word does not,
 * which is what a letter sheet has always printed; a parent teaching a word
 * stroke by stroke turns them on for everything, their own words included,
 * and one who finds them busy on a ⅜ rule turns them off.
 *
 * Nothing at all in a face without a hand: the outline row has no strokes
 * to mark, so the choice would be a control the sheet ignores.
 */
import { handOf } from "@/engine/sheets/hands";
import type { ModelGuides, SheetFont } from "@/engine/sheets/types";

import { Choice, opt } from "./parts";

const GUIDES = [
  opt<ModelGuides>("letters", "Letters", "a single letter or pair, the usual"),
  opt<ModelGuides>("all", "All", "words and sentences too"),
  opt<ModelGuides>("none", "None"),
];

export function GuidesControl({
  font,
  value,
  onChange,
}: {
  /** The face the sheet is set in — the one the family resolves, not the config's. */
  font: SheetFont | undefined;
  value: ModelGuides | undefined;
  /** The usual comes back as `undefined`, which is what the config means by it. */
  onChange: (guides: ModelGuides | undefined) => void;
}) {
  if (!handOf(font)) return null;
  return (
    <Choice
      label="Stroke arrows on the model"
      value={value ?? "letters"}
      onChange={(guides) => onChange(guides === "letters" ? undefined : guides)}
      options={GUIDES}
      hint="A dot where each stroke starts, an arrow for the way it goes, and its number."
    />
  );
}
