/**
 * The worlds, as data.
 *
 * A world is a subject with a look: The Grid is multiplication, Word Jungle is
 * spelling, Frost Keys is typing. The whole site is one game and these are its
 * levels, so this file is the registry both halves read from — the content
 * pages build the map out of it, and the game asks a deck which world it's
 * played in (see `DeckSpec.world`).
 *
 * It lives in the engine because "what worlds exist" is product knowledge, the
 * same kind of thing as the Dolch lists in decks/wordlists.ts. The engine never
 * interprets any of it: to the model a world id is an opaque string that a
 * stylesheet happens to key off. Nothing here may grow a behaviour.
 *
 * The colours are the ONLY duplication with src/styles/worlds.css, and they're
 * here for one reason: <meta name="theme-color"> is markup, not CSS, so the
 * browser chrome can't read a custom property. Keep them in step.
 */

export type World = "map" | "grid" | "jungle" | "ice" | "line" | "empty";

/** Matches `--ink-900` for each world, so the browser chrome joins the page. */
export const THEME_COLOUR: Record<World, string> = {
  map: "#0a0819",
  grid: "#0a0c16",
  jungle: "#08160f",
  ice: "#06121e",
  line: "#0c0e12",
  empty: "#0c0e12",
};

export type WorldInfo = {
  id: World;
  /** What it's called on the map. */
  name: string;
  /** What it actually teaches, in the words a parent would search for. */
  subject: string;
  /** One line, written for the child who has to pick. */
  tagline: string;
  /** What a parent needs to know before handing over the tablet. */
  blurb: string;
  /** For the hop-between-worlds control in a game's top bar. */
  icon: string;
  /** Where the world starts — the game, not a page about it. */
  href: string;
  /**
   * The crawlable page about this world, where one exists.
   *
   * Not every world has one, and that's the honest state of things: the Grid's
   * reading surface is the twelve times-table pages rather than one index, and
   * typing hasn't earned an article yet. Where a guide does exist it is linked
   * from the map and the footer, because a page nothing links to is a page
   * nothing ranks.
   */
  guide?: { href: string; label: string };
  /** How many levels are in it, and what a level is called here. */
  levels: string;
  /** Roughly who it's for. Ages, not school years — see /spelling for why. */
  ages: string;
};

/**
 * The worlds you can actually play, in the order they appear on the map.
 *
 * Order is difficulty-ish rather than fixed: nothing is gated, and a six-year
 * old who wants to start in the jungle should be allowed to. Non-linear is the
 * point — see the note on the map itself.
 */
export const WORLDS: WorldInfo[] = [
  {
    id: "grid",
    name: "The Grid",
    subject: "Times tables and flash cards",
    tagline: "Twelve by twelve. Beat the clock, then beat yourself.",
    blurb:
      "Multiplication, division, addition and subtraction as timed cards. Race the clock, a ghost of your own best run, or a sibling's. Facts that come out slow get their own practice deck.",
    icon: "🔢",
    href: "/flash-cards",
    levels: "12 tables",
    ages: "Ages 5–12",
  },
  {
    id: "jungle",
    name: "Word Jungle",
    subject: "Spelling and sight words",
    tagline: "Hear the word. Spell it before it gets away.",
    blurb:
      'The Dolch sight words, graded by age. Each one is read aloud in a sentence and typed from memory, so "their" and "there" are telling apart rather than guessing. Paste in this week\'s spellings and they become a deck like any other.',
    icon: "🔤",
    href: "/spelling/play",
    guide: { href: "/spelling", label: "What sight words are" },
    levels: "6 word lists",
    ages: "Ages 4–9",
  },
  {
    id: "ice",
    name: "Frost Keys",
    subject: "Touch typing",
    tagline: "Home row to whole sentences, one word at a time.",
    blurb:
      "Start with eight keys under eight fingers and work up to real punctuation. Every word is a split, so a rival's pace is something you feel word by word instead of reading at the end.",
    icon: "⌨️",
    href: "/typing",
    levels: "4 levels",
    ages: "Ages 5–12",
  },
];

/**
 * Worlds that don't exist yet.
 *
 * Named on the map on purpose, and deliberately not dated or described as
 * anything more than a name — the honest version of a roadmap for a free site
 * built in evenings. There is nothing to sign up to; a new world just turns up.
 */
export const UNBUILT_WORLDS = [
  "The Old West",
  "Deep Water",
  "Chicken World",
  "90s Web",
] as const;
