/**
 * How the chooser groups the families — a shelf here, a subject on screen —
 * and what each family's own tab in the rail is called (§14).
 *
 * Both are editorial rather than engineering, which is why they sit here beside
 * `defaults.ts` and not in the engine's registry: the engine says what a family
 * can build, and this says where a parent would look for it and what they would
 * call what is on it. The catalog's shelves (`pages/printables/_shelves.ts`)
 * are cut finer, by what a page is about; five is what fits across a chooser.
 *
 * A family's tab is named for what the family holds — problems, letters, a
 * ruling — because the one heading that was true of every family ("what is on
 * it") read as the site talking to itself. A family with nothing of its own to
 * set, blank paper, has no tab.
 *
 * Every family is on exactly one shelf, and `shelves.test.ts` holds this table
 * to that against the engine's registry: a family added there without a line
 * here fails the suite rather than going missing from the chooser.
 */
import { SHEET_FAMILIES } from "@/engine/sheets/families";

export type Shelf = {
  id: string;
  label: string;
  /** The families on it, in the order the chooser offers them. */
  families: ShelvedFamily[];
};

export type ShelvedFamily = {
  /** Matches `SheetConfig.kind`. */
  id: string;
  /** What the family's own tab is called, or nothing for a family with no options. */
  tab?: string;
};

const PROBLEMS = "Problems";

export const SHELVES: readonly Shelf[] = [
  {
    id: "maths",
    label: "Math",
    families: [
      { id: "arithmetic", tab: PROBLEMS },
      { id: "multiplication", tab: PROBLEMS },
      { id: "fractions", tab: PROBLEMS },
      { id: "decimals", tab: PROBLEMS },
      { id: "money", tab: PROBLEMS },
      { id: "time", tab: PROBLEMS },
      { id: "measure", tab: PROBLEMS },
      { id: "geometry", tab: PROBLEMS },
      { id: "integers", tab: PROBLEMS },
      { id: "prealgebra", tab: PROBLEMS },
      { id: "ratio", tab: PROBLEMS },
      { id: "statistics", tab: PROBLEMS },
      { id: "word-problems", tab: PROBLEMS },
      { id: "lesson", tab: "Lesson" },
    ],
  },
  {
    id: "words",
    label: "Spelling and grammar",
    families: [
      { id: "words", tab: "Words" },
      { id: "word-study", tab: "Words" },
      { id: "puzzle", tab: "Puzzle" },
      { id: "grammar", tab: "Questions" },
      { id: "phonics", tab: "Sounds" },
    ],
  },
  {
    id: "handwriting",
    label: "Handwriting",
    families: [
      { id: "handwriting", tab: "Letters" },
      { id: "penmanship", tab: "Practice" },
      { id: "memory", tab: "Verse" },
    ],
  },
  {
    id: "stationery",
    label: "Charts and forms",
    families: [
      { id: "chart", tab: "Chart" },
      { id: "form", tab: "Form" },
      { id: "planner", tab: "Layout" },
      { id: "cards", tab: "Cards" },
      { id: "net", tab: "Shape" },
    ],
  },
  {
    id: "paper",
    label: "Paper",
    families: [{ id: "blank" }, { id: "paper", tab: "Ruling" }],
  },
];

/**
 * The shelf a family is on, or the first shelf for a kind this build has never
 * heard of — the chooser still has to open on something for a config that
 * arrived in a link from a newer build.
 */
export function shelfOf(kind: string): Shelf {
  return (
    SHELVES.find((shelf) => shelf.families.some((f) => f.id === kind)) ??
    SHELVES[0]
  );
}

/** What a family's own tab is called; nothing if it has no tab. */
export function tabOf(kind: string): string | undefined {
  for (const shelf of SHELVES) {
    const family = shelf.families.find((f) => f.id === kind);
    if (family) return family.tab;
  }
  return undefined;
}

/**
 * How a family reads in the rail. The registry's own label, so the chooser and
 * the rail agree; a kind the registry doesn't know is named as plainly as that.
 */
export function labelOf(kind: string): string {
  return (
    SHEET_FAMILIES.find((family) => family.id === kind)?.label ??
    "A sheet this site can't make yet"
  );
}
