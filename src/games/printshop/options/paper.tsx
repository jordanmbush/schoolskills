/**
 * Lined, ruled, graph, dot and isometric paper.
 *
 * The one family whose options are the §17 line "ruling and rule size · line
 * spacing", all three of which are the same question here: on ruled paper the
 * spacing between the lines *is* the ruling, which is why the sizes are named
 * by their pitch — a teacher says "we're on ⅝ paper this year", not "we're on
 * handwriting paper at spacing four".
 *
 * The two extras appear only where they mean something. A midline and descender
 * space belong to a handwriting rule and nothing else; a square belongs to the
 * three rulings that repeat across the page as well as down it. Showing them
 * greyed out on narrow ruled would be offering a choice that does nothing.
 */
import { GRID_PITCHES, RULINGS, rulingOf } from "@/engine/sheets/paper";
import type {
  Midline,
  PaperConfig,
  RuleStyle,
  Mil,
} from "@/engine/sheets/types";

import { Checkbox } from "@/components/ui/kit";

import { Choice, opt, type PanelProps } from "./parts";

const STYLES = Object.values(RULINGS).map((ruling) =>
  opt<RuleStyle>(ruling.id, ruling.label),
);

const MIDLINES = [
  opt<Midline>("dashed", "Dashed", "the usual"),
  opt<Midline>("solid", "Solid", "youngest"),
  opt<Midline>("none", "None", "oldest"),
];

/** The squares of §5, labelled the way the paper is sold. */
const SQUARES = [
  opt("quarter-inch", "¼ in"),
  opt("fifth-inch", "⅕ in"),
  opt("centimetre", "1 cm"),
  opt("half-centimetre", "5 mm"),
];

type Square = keyof typeof GRID_PITCHES;

export function PaperPanel({ config, set }: PanelProps<PaperConfig>) {
  const ruling = rulingOf(config.rule);
  const rule = (patch: Partial<PaperConfig["rule"]>) =>
    set({ rule: { ...config.rule, ...patch } });

  // Which square is chosen, read back off the pitch rather than stored beside
  // it: `Rule` holds a length, and a second field naming the same thing is a
  // second thing that can disagree with it.
  const square =
    (Object.keys(GRID_PITCHES) as Square[]).find(
      (key) => GRID_PITCHES[key] === config.rule.pitch,
    ) ?? "quarter-inch";

  return (
    <>
      <Choice
        label="Ruling and line spacing"
        value={config.rule.style}
        onChange={(style) => rule({ style })}
        options={STYLES}
        hint="Handwriting sizes are named by the space between one set of lines and the next."
      />

      {ruling.handwriting && (
        <>
          <Choice
            label="Midline"
            value={config.rule.midline ?? "dashed"}
            onChange={(midline) => rule({ midline })}
            options={MIDLINES}
          />
          <Checkbox
            label="Room for descenders"
            hint="Space below the baseline for the tail of a g."
            checked={config.rule.descender === true}
            onChange={(descender) => rule({ descender })}
          />
        </>
      )}

      {ruling.grid && (
        <Choice
          label="Square"
          value={square}
          onChange={(next) => rule({ pitch: GRID_PITCHES[next] as Mil })}
          options={SQUARES}
        />
      )}
    </>
  );
}
