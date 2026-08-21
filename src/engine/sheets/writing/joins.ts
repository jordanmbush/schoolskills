/**
 * The joins: what a cursive sheet has that a print one doesn't.
 *
 * A letter is a shape and can be practised alone. A join cannot: the stroke
 * between two letters is only correct in the company of the letters either side
 * of it, which is why `in` is a thing to practise and `i` followed by `n` is
 * not. Every scheme that teaches joined writing therefore teaches a handful of
 * *families* of join rather than 676 pairs, and this file is those families.
 *
 * **Where the join comes from, not what the letters are.** The four classic
 * ones are named for the exit stroke and for how tall the letter it arrives at
 * is: a diagonal join climbs from the baseline, a horizontal one carries across
 * at the x-height, and a tall second letter changes where the stroke has to
 * land. The fifth is the anticlockwise letters — `a c d g o q` are drawn from
 * the top and entered there, so a child who joins into them the ordinary way
 * writes `oi` where they meant `oa`.
 *
 * Every pair below is two ordinary characters, and which of them a hand
 * actually joins is the font's answer rather than this file's (§6) — which is
 * what makes `breaks` an honest group rather than a claim.
 *
 * Kept out of `handwriting.ts` so the catalog and the builder can name a family
 * without pulling in the family that builds sheets.
 */
import { own } from "../paper";
import type { JoinFamily } from "../types";

export type JoinSet = {
  id: JoinFamily;
  /** What the family is called on a sheet, in a picker and on a hub. */
  label: string;
  /** What the family teaches, in one line a parent can read. */
  blurb: string;
  /**
   * Five pairs, which is a row of a ⅝ sheet per family and a whole page for all
   * six. Chosen to be pairs that turn up in ordinary words — a child practising
   * `ea` and `ow` is practising `beat` and `down`.
   */
  pairs: string[];
};

/**
 * The six families, in the order they are taught.
 *
 * Diagonal before horizontal because most letters end on the baseline and a
 * child meets that join first; small before tall in each, because the second
 * letter's height is the complication; the anticlockwise letters after both,
 * because the mistake they cause only shows up once joining is automatic; and
 * the breaks last, because "sometimes you lift the pencil" is only teachable to
 * somebody who is already joining.
 */
export const JOIN_FAMILIES: JoinSet[] = [
  {
    id: "diagonal",
    label: "Diagonal joins",
    blurb:
      "Up from the baseline into a small letter — the join under half the words in English.",
    pairs: ["in", "un", "im", "er", "es"],
  },
  {
    id: "diagonal-tall",
    label: "Diagonal joins to a tall letter",
    blurb:
      "The same climb, carried on up to the top line: ch, th and ck are this join.",
    pairs: ["ch", "th", "ck", "il", "at"],
  },
  {
    id: "horizontal",
    label: "Horizontal joins",
    blurb:
      "Across at the midline, from the letters that finish at the top of their body — o, r, v and w.",
    pairs: ["on", "or", "we", "ve", "ow"],
  },
  {
    id: "horizontal-tall",
    label: "Horizontal joins to a tall letter",
    blurb: "The same stroke arriving at an ascender, which is where wh lives.",
    pairs: ["wh", "ol", "ot", "oh", "rt"],
  },
  {
    id: "round",
    label: "Joins into a round letter",
    blurb:
      "Into a, c, d, g, o and q, which are written anticlockwise and entered at the top.",
    pairs: ["ea", "oa", "ua", "ic", "od"],
  },
  {
    id: "breaks",
    label: "Where the pencil lifts",
    blurb:
      "The letters a model may not join out of. Which ones those are is the model's answer, not ours.",
    pairs: ["ba", "ge", "ju", "qu", "ye"],
  },
];

const BY_ID: Record<string, JoinSet> = Object.fromEntries(
  JOIN_FAMILIES.map((family) => [family.id, family]),
);

/**
 * A family by id, or the first one.
 *
 * Never throws, for the reason every lookup keyed by a saved string doesn't: a
 * config outlives the build that wrote it, and a sheet asking for a family this
 * build has never heard of should print the diagonal joins rather than nothing.
 */
export const joinFamily = (id: JoinFamily): JoinSet =>
  own(BY_ID, id, JOIN_FAMILIES[0]);

/**
 * The pairs a joins sheet writes: one family's, or every family's in order.
 *
 * All of them is what a parent means by "cursive joins" — the whole progression
 * on one page, the way the letters sheet is the whole alphabet — and one family
 * is the sheet for the week that join is being taught.
 */
export const joinPairs = (family?: JoinFamily): string[] =>
  family === undefined
    ? JOIN_FAMILIES.flatMap((set) => set.pairs)
    : joinFamily(family).pairs;
