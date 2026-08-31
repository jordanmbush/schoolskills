/**
 * The worlds, as data.
 *
 * A world is a subject with a look: The Grid is multiplication, Word Jungle is
 * spelling, Frost Keys is typing, The Print Shop is paper. The whole site is
 * one game and these are its levels, so this file is the registry both halves
 * read from — the content pages build the map out of it, and the game asks a
 * deck which world it's played in (see `DeckSpec.world`).
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

export type World =
  "map" | "grid" | "jungle" | "ice" | "paper" | "line" | "empty";

/** Matches `--ink-900` for each world, so the browser chrome joins the page. */
export const THEME_COLOUR: Record<World, string> = {
  map: "#0a0819",
  grid: "#0a0c16",
  jungle: "#08160f",
  ice: "#06121e",
  paper: "#131211",
  line: "#0c0e12",
  empty: "#0c0e12",
};

export type WorldInfo = {
  id: World;
  /** What it's called on the map. */
  name: string;
  /** What it actually teaches, in the words a parent would search for. */
  subject: string;
  /**
   * One line, written for the child who has to pick.
   *
   * Except The Print Shop's, which is written for the parent — a worksheet is
   * not a level and a card that pretended otherwise would be selling a child
   * something they can't use. Same for its `subject`, `blurb`, `levels` and
   * `ages`: the map is a child's screen with one grown-up's stop on it, and
   * saying so plainly is cheaper than the disappointment.
   */
  tagline: string;
  /** What a parent needs to know before handing over the tablet. */
  blurb: string;
  /** For the hop-between-worlds control in a game's top bar. */
  icon: string;
  /** Where the world starts, and where the map and the masthead point. */
  href: string;
  /**
   * The mounted app — a `client:only` island whose prerendered body is two
   * words. It carries `noindex` (see Base.astro) and astro.config.mjs keeps it
   * out of the sitemap, so THIS field, not `href`, is what "the route search
   * engines must never be handed" means.
   *
   * For the three game worlds it is `href`, because the game is the front
   * door. The Print Shop is the exception that made the field necessary: its
   * front door is a catalog of prerendered worksheets — the largest crawlable
   * surface on the site, and one that must be in the sitemap — while its
   * builder at /printables/make must not be. Deriving the exclusion from
   * `href` instead would have deleted the catalog from the sitemap silently,
   * with nothing failing (docs/printables.md §8).
   */
  island: string;
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
 * The worlds that exist, in the order they appear on the map.
 *
 * Order is difficulty-ish rather than fixed: nothing is gated, and a six-year
 * old who wants to start in the jungle should be allowed to. Non-linear is the
 * point — see the note on the map itself. The Print Shop is last because it is
 * the one you don't play.
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
    island: "/flash-cards",
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
    island: "/spelling/play",
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
    island: "/typing",
    levels: "4 levels",
    ages: "Ages 5–12",
  },
  /*
   * The one stop on the map that isn't a game, and the copy says so in the
   * first four words rather than burying it. A child who taps this card should
   * be able to tell within a line that it belongs to whoever bought the
   * printer — anything cleverer would be a bait-and-switch on the audience
   * this site is most careful with.
   *
   * `href` is the catalog and `island` is the builder; see the field docs
   * above for why those have to be different here and nowhere else.
   */
  {
    id: "paper",
    name: "The Print Shop",
    subject: "Worksheets to print",
    tagline: "For the grown-up. Pick a sheet, tune it, print it.",
    blurb:
      "Times tables, handwriting rules, spelling lists and Scripture copywork, as paper you can hand over. Sheets print straight from the browser with an answer key, or save as a PDF — no account, and nothing about your child in the file.",
    icon: "🖨️",
    href: "/printables",
    island: "/printables/make",
    levels: "Paper, not levels",
    ages: "Pre-K to Y8",
  },
];
