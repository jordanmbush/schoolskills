/**
 * The sounds of English, and the letters that spell them.
 *
 * The table a sound inventory is ticked out of, and the only place in the
 * Print Shop where a spelling is claimed to say anything. Everything phonics
 * generates is constrained by a set of the ids below, so an error here is a
 * word on a page that a child has not been taught to read yet — which is the
 * one failure this whole family exists to prevent (docs/printables.md §13).
 *
 * ── Which accent this describes ────────────────────────────────────────────
 *
 * **The contrasts shared by General American and standard southern British
 * (RP).** Stated rather than assumed, because a phoneme table always describes
 * *somebody's* speech, and a table that quietly described only one of the two
 * would tell half the children using this site that a sound is different from
 * another sound they say identically — or the same as one they don't.
 *
 * A shared table is possible because the two varieties agree about far more
 * than they disagree about: all twenty-four consonants, and the vowel of every
 * word below except where marked. Where they genuinely differ, the divergence
 * is named on the phoneme in `varies` rather than resolved by picking a side:
 *
 *   - **cot / caught.** `/o/` and `/aw/` are two sounds in RP and for many
 *     Americans, and one sound for most of the western and midland United
 *     States and nearly all of Canada. Both are listed, and a sheet that asks a
 *     child to *hear the difference* between them can ask `variesByAccent`
 *     first (see `bank.ts`).
 *   - **father / bother.** `/ah/` and `/o/` are one sound in General American
 *     and two in RP. Same treatment.
 *   - **bath / trap.** The vowel of `bath`, `grass`, `ask` and `after` is `/a/`
 *     in America and `/ah/` in southern England. There is no honest single
 *     answer, so those words are simply not in the bank — see the note there.
 *   - **Rhoticity.** `car`, `her` and `four` end in an r-sound in America and
 *     in most of Ireland, Scotland and the English south-west, and in a longer
 *     vowel in RP. It makes no difference to *spelling*, which is what this
 *     table is for: the letters are the same either way. So the r-coloured
 *     vowels are one entry each, with the difference recorded on them.
 *   - **which / witch.** A minority of speakers keep `wh` as a separate sound.
 *     `wh` is listed as spelling `/w/`, with the note.
 *
 * ── One spelling is not one sound ──────────────────────────────────────────
 *
 * English is many-to-many in both directions and the table says so rather than
 * flattening it. `/k/` is spelled six ways; `ea` spells three different vowels
 * (`eat`, `bread`, `great`) and `ear` three more (`hear`, `earth`, `bear`).
 * So **the unit a parent ticks is a correspondence — a grapheme _and_ the sound
 * it makes — not a grapheme.** That is not a modelling nicety: every systematic
 * programme teaches `ea` as `/ee/` months before it teaches `ea` as `/e/`, and
 * an inventory that could only hold "we've done ea" would put `bread` on a page
 * for a child who can only read `eat`.
 *
 * ── What is not tickable ───────────────────────────────────────────────────
 *
 * A spelling that appears in a handful of words is not a rule, and pretending
 * otherwise is how a generator ends up printing `said` as if it rhymed with
 * `paid`. Those correspondences are recorded — truthfully, because `ai` really
 * does spell `/e/` in `said` — and marked `odd`. An `odd` correspondence can
 * never be in an inventory, so the only door a word using one comes through is
 * the parent's own list of words taught by sight (`Inventory.tricky`), which is
 * exactly how every programme handles them.
 */

/** A sound. `id` is what a correspondence names and what a sheet prints by. */
export type Phoneme = {
  /** Short, readable, and stable: it is written into saved inventories. */
  id: string;
  /** IPA, for the parent who wants to know exactly which sound is meant. */
  ipa: string;
  /** A word that has it. Chosen so the sound is unmistakable when said aloud. */
  example: string;
  kind: "consonant" | "vowel";
  /**
   * How the varieties in the header differ over this sound, when they do.
   *
   * Present on eight of the forty-five, absent on the rest — which is the
   * point of writing it down: it makes the eight visible instead of leaving a
   * reader to wonder about all forty-five.
   */
  varies?: string;
};

/* ── Consonants ───────────────────────────────────────────────────────────
   All twenty-four, and the two varieties agree about every one of them. The
   only footnote in the set is `wh`, and it is a footnote about a *spelling*
   rather than about a sound — it lives on the correspondence below.        */

const CONSONANT_PHONEMES: Phoneme[] = [
  { id: "b", ipa: "b", example: "bat", kind: "consonant" },
  { id: "d", ipa: "d", example: "dog", kind: "consonant" },
  { id: "f", ipa: "f", example: "fan", kind: "consonant" },
  { id: "g", ipa: "ɡ", example: "got", kind: "consonant" },
  { id: "h", ipa: "h", example: "hat", kind: "consonant" },
  { id: "j", ipa: "dʒ", example: "jam", kind: "consonant" },
  { id: "k", ipa: "k", example: "cat", kind: "consonant" },
  { id: "l", ipa: "l", example: "leg", kind: "consonant" },
  { id: "m", ipa: "m", example: "man", kind: "consonant" },
  { id: "n", ipa: "n", example: "net", kind: "consonant" },
  { id: "ng", ipa: "ŋ", example: "ring", kind: "consonant" },
  { id: "p", ipa: "p", example: "pig", kind: "consonant" },
  { id: "r", ipa: "ɹ", example: "red", kind: "consonant" },
  { id: "s", ipa: "s", example: "sun", kind: "consonant" },
  { id: "sh", ipa: "ʃ", example: "ship", kind: "consonant" },
  { id: "t", ipa: "t", example: "top", kind: "consonant" },
  { id: "ch", ipa: "tʃ", example: "chip", kind: "consonant" },
  // The two `th` sounds, which share a spelling and are told apart by nothing
  // on the page. A child who can read `thin` cannot necessarily read `this`,
  // so they are two sounds here and two tick boxes in front of a parent.
  { id: "th", ipa: "θ", example: "thin", kind: "consonant" },
  { id: "dh", ipa: "ð", example: "this", kind: "consonant" },
  { id: "v", ipa: "v", example: "van", kind: "consonant" },
  { id: "w", ipa: "w", example: "win", kind: "consonant" },
  { id: "y", ipa: "j", example: "yes", kind: "consonant" },
  { id: "z", ipa: "z", example: "zip", kind: "consonant" },
  { id: "zh", ipa: "ʒ", example: "measure", kind: "consonant" },
];

/* ── Vowels ───────────────────────────────────────────────────────────────
   Where the two varieties part company, and where the `varies` notes earn
   their place. Named by their spelling rather than by a lexical set, because
   the audience is a parent with a tick list rather than a phonetician.      */

const VOWEL_PHONEMES: Phoneme[] = [
  { id: "a", ipa: "æ", example: "cat", kind: "vowel" },
  { id: "e", ipa: "ɛ", example: "bed", kind: "vowel" },
  { id: "i", ipa: "ɪ", example: "sit", kind: "vowel" },
  {
    id: "o",
    ipa: "ɒ / ɑ",
    example: "dog",
    kind: "vowel",
    varies:
      "Rounded in southern England, unrounded in America — and for most of " +
      "the western United States and Canada the same vowel as in `saw`.",
  },
  { id: "u", ipa: "ʌ", example: "cup", kind: "vowel" },
  { id: "uu", ipa: "ʊ", example: "book", kind: "vowel" },
  { id: "ee", ipa: "iː", example: "see", kind: "vowel" },
  { id: "ai", ipa: "eɪ", example: "rain", kind: "vowel" },
  { id: "ie", ipa: "aɪ", example: "night", kind: "vowel" },
  { id: "oa", ipa: "oʊ / əʊ", example: "boat", kind: "vowel" },
  { id: "oo", ipa: "uː", example: "moon", kind: "vowel" },
  { id: "ow", ipa: "aʊ", example: "cow", kind: "vowel" },
  { id: "oy", ipa: "ɔɪ", example: "boy", kind: "vowel" },
  {
    id: "aw",
    ipa: "ɔː",
    example: "saw",
    kind: "vowel",
    varies:
      "The other half of the cot/caught pair: a sound of its own in southern " +
      "England and the eastern United States, merged with the vowel of `dog` " +
      "for most other American and Canadian speakers.",
  },
  {
    id: "ah",
    ipa: "ɑː",
    example: "father",
    kind: "vowel",
    varies:
      "The father/bother pair: distinct from the vowel of `dog` in southern " +
      "England, the same vowel in almost all of North America.",
  },
  {
    id: "ar",
    ipa: "ɑːr",
    example: "car",
    kind: "vowel",
    varies: "The r is sounded in America, Ireland and Scotland; not in RP.",
  },
  {
    id: "or",
    ipa: "ɔːr",
    example: "fork",
    kind: "vowel",
    varies: "The r is sounded in America, Ireland and Scotland; not in RP.",
  },
  {
    id: "er",
    ipa: "ɜːr / ər",
    example: "her",
    kind: "vowel",
    varies:
      "The r is sounded in America, Ireland and Scotland; not in RP. One " +
      "entry rather than two, because the vowel of `her` and the ending of " +
      "`letter` are spelled the same way and differ only in stress.",
  },
  {
    id: "air",
    ipa: "ɛər",
    example: "hair",
    kind: "vowel",
    varies: "The r is sounded in America, Ireland and Scotland; not in RP.",
  },
  {
    id: "eer",
    ipa: "ɪər",
    example: "deer",
    kind: "vowel",
    varies: "The r is sounded in America, Ireland and Scotland; not in RP.",
  },
  { id: "uh", ipa: "ə", example: "about", kind: "vowel" },
];

export const PHONEMES: Phoneme[] = [...CONSONANT_PHONEMES, ...VOWEL_PHONEMES];

export const PHONEME_BY_ID = new Map(PHONEMES.map((p) => [p.id, p]));

/**
 * A spelling, and the sound it makes *in the words this build prints*.
 *
 * The unit a parent ticks. See the header for why it is this rather than a
 * grapheme, and `odd` for the ones that are recorded but never offered.
 */
export type Correspondence = {
  /**
   * `grapheme:sound`, e.g. `ea:ee`. Built by `spells` and never parsed back
   * apart — treat it as opaque. It is stable because it is saved: an inventory
   * a parent ticked out in September is a list of these strings, and renaming
   * one would silently un-teach a sound.
   */
  id: string;
  /**
   * The letters, exactly as they appear in the word. A split vowel is written
   * with the `_` where its consonant goes: `a_e` is the spelling in `cake`.
   */
  grapheme: string;
  /**
   * Usually one sound; two for the letters that carry a pair (`x` is /k/+/s/,
   * `qu` is /k/+/w/, `le` is /uh/+/l/); none for a letter that says nothing,
   * which is a real thing a spelling does and worth being able to state.
   */
  phonemes: string[];
  /** A word spelled that way. What a sound card and a wall chart print. */
  example: string;
  /** When the spelling is restricted to a position or a neighbour. */
  note?: string;
  /**
   * Recorded, but never tickable: a spelling with too few words behind it to
   * be a rule. See the header — this is the flag that keeps `said` out of a
   * sheet built for a child who has been taught `ai` as in `rain`.
   */
  odd?: true;
};

/**
 * One row of the table.
 *
 * The id is derived rather than typed so that the two halves cannot drift
 * apart — a hand-written `"ea:ee"` beside `phonemes: ["e"]` would be a lie
 * that nothing could catch, because an id is opaque to everything that reads
 * one.
 */
const spells = (
  grapheme: string,
  // Space-separated, because a letter can carry two sounds: `x` is `k s`. `-`
  // is "says nothing", which is a dash rather than an empty string so that an
  // id doesn't end in a bare colon and read like a typo.
  sounds: string,
  example: string,
  extra: Omit<Correspondence, "id" | "grapheme" | "phonemes" | "example"> = {},
): Correspondence => {
  const phonemes = sounds === "-" ? [] : sounds.split(" ");
  return {
    id: `${grapheme}:${phonemes.join("-") || "-"}`,
    grapheme,
    phonemes,
    example,
    ...extra,
  };
};

/* ── How the consonants are spelled ───────────────────────────────────────
   Ordered so that the first entry for a grapheme is its commonest sound. That
   ordering is load-bearing: `bank.ts` writes a word's spelling in shorthand
   and a bare grapheme means "the first row for those letters", so moving
   `c:s` above `c:k` would re-spell half the bank.                          */

const CONSONANT_SPELLINGS: Correspondence[] = [
  spells("b", "b", "bat"),
  spells("bb", "b", "rabbit"),
  spells("c", "k", "cat"),
  spells("c", "s", "city", { note: "before e, i or y" }),
  spells("k", "k", "kit"),
  spells("ck", "k", "duck", {
    note: "after a short vowel, never at the start",
  }),
  spells("ch", "ch", "chip"),
  spells("ch", "k", "school", { note: "mostly in words taken from Greek" }),
  spells("tch", "ch", "catch", { note: "after a short vowel" }),
  spells("qu", "k w", "queen"),
  spells("d", "d", "dog"),
  spells("dd", "d", "ladder"),
  spells("f", "f", "fan"),
  spells("ff", "f", "cliff"),
  spells("ph", "f", "phone"),
  spells("gh", "f", "laugh", { odd: true }),
  spells("g", "g", "got"),
  spells("gg", "g", "egg"),
  spells("g", "j", "giant", { note: "before e, i or y" }),
  spells("ge", "j", "large", { note: "at the end of a word" }),
  spells("dge", "j", "bridge", { note: "after a short vowel" }),
  spells("j", "j", "jam"),
  spells("h", "h", "hat"),
  spells("l", "l", "leg"),
  spells("ll", "l", "bell"),
  spells("le", "uh l", "little", { note: "at the end of a word" }),
  spells("m", "m", "man"),
  spells("mm", "m", "hammer"),
  spells("mb", "m", "comb", { note: "the b says nothing" }),
  spells("n", "n", "net"),
  spells("nn", "n", "dinner"),
  spells("n", "ng", "think", { note: "before k or g" }),
  spells("kn", "n", "knee", { note: "at the start; the k says nothing" }),
  spells("gn", "n", "gnat", { note: "at the start; the g says nothing" }),
  spells("ng", "ng", "ring"),
  spells("p", "p", "pig"),
  spells("pp", "p", "happy"),
  spells("r", "r", "red"),
  spells("rr", "r", "sorry"),
  spells("wr", "r", "write", { note: "at the start; the w says nothing" }),
  spells("s", "s", "sun"),
  spells("ss", "s", "miss"),
  spells("s", "z", "has"),
  spells("s", "zh", "measure", { odd: true }),
  spells("z", "z", "zip"),
  spells("zz", "z", "buzz"),
  spells("sh", "sh", "ship"),
  spells("t", "t", "top"),
  spells("tt", "t", "butter"),
  // One spelling, two sounds, no clue on the page which is which. `thin` and
  // `this` are the pair that makes the case for correspondences over
  // graphemes better than any argument could.
  spells("th", "th", "thin"),
  spells("th", "dh", "this"),
  spells("v", "v", "van"),
  spells("w", "w", "win"),
  spells("wh", "w", "when", {
    note: "a few speakers say a puff of air first, as if it were hw",
  }),
  // `who`, `whose`, `whom`, `whole` — four words, so a rule it is not, but
  // recording it is what lets `who` be cut honestly instead of being cut as
  // the `wh` of `when` and printed on a blending line as /w/ /oo/.
  spells("wh", "h", "who", { odd: true }),
  spells("x", "k s", "box", { note: "two sounds in one letter" }),
  spells("y", "y", "yes", { note: "at the start of a word" }),
  spells("t", "-", "castle", { odd: true }),
  spells("w", "-", "two", { odd: true }),
  spells("h", "-", "hour", { odd: true }),
];

/* ── How the vowels are spelled ───────────────────────────────────────────
   The long half of the table, and where nearly all the many-to-many lives.
   `ea` is three rows and `ear` is three more; the same grapheme with a
   different sound is a different thing to have been taught.                 */

const VOWEL_SPELLINGS: Correspondence[] = [
  spells("a", "a", "cat"),
  spells("a", "ai", "baby", { note: "at the end of a syllable" }),
  spells("a", "o", "wash", { note: "after w or qu" }),
  spells("a", "aw", "ball", { note: "before ll" }),
  spells("a", "uh", "about", { note: "in a syllable with no stress on it" }),
  spells("a", "ah", "father"),
  spells("a", "e", "any", { odd: true }),
  spells("al", "aw", "walk", { note: "before k; the l says nothing" }),
  spells("a_e", "ai", "cake"),
  spells("ai", "ai", "rain"),
  spells("ai", "e", "said", { odd: true }),
  spells("ay", "ai", "day", { note: "at the end of a word" }),
  spells("eigh", "ai", "eight"),
  spells("e", "e", "bed"),
  spells("e", "ee", "me", { note: "at the end of a syllable" }),
  spells("e", "uh", "garden", { note: "in a syllable with no stress on it" }),
  spells("e", "-", "have", {
    note: "at the end of a word, after a consonant",
  }),
  spells("e_e", "ee", "these"),
  spells("ee", "ee", "see"),
  spells("ea", "ee", "eat"),
  spells("ea", "e", "bread"),
  spells("ea", "ai", "great", { odd: true }),
  spells("ie", "ee", "chief"),
  spells("ie", "e", "friend", { odd: true }),
  spells("ey", "ee", "key"),
  spells("y", "ee", "happy", { note: "at the end of a word of two syllables" }),
  spells("i", "i", "sit"),
  spells("i", "ie", "mind", {
    note: "before ld, nd or mb, and at the end of a syllable",
  }),
  spells("i_e", "ie", "bike"),
  spells("igh", "ie", "night"),
  spells("ie", "ie", "pie", { note: "at the end of a word" }),
  spells("y", "ie", "my", { note: "at the end of a short word" }),
  spells("y", "i", "gym", { odd: true }),
  spells("o", "o", "dog"),
  spells("o", "oa", "go", { note: "at the end of a syllable, and before ld" }),
  spells("o", "u", "love", { odd: true }),
  spells("o", "oo", "do", { odd: true }),
  spells("o", "w u", "one", { odd: true }),
  spells("o_e", "oa", "home"),
  spells("oa", "oa", "boat"),
  spells("ow", "oa", "snow"),
  spells("oe", "oa", "toe"),
  spells("u", "u", "cup"),
  spells("u", "uu", "put"),
  spells("u", "y oo", "music", { note: "at the end of a syllable" }),
  spells("u_e", "oo", "flute"),
  spells("u_e", "y oo", "cube"),
  spells("ue", "oo", "blue"),
  spells("ui", "oo", "fruit"),
  spells("ui", "i", "build", { odd: true }),
  spells("ew", "oo", "flew"),
  spells("ew", "y oo", "few"),
  spells("oo", "oo", "moon"),
  spells("oo", "uu", "book"),
  spells("ou", "ow", "out"),
  spells("ou", "u", "touch", { odd: true }),
  spells("ow", "ow", "cow"),
  spells("oi", "oy", "coin"),
  spells("oy", "oy", "boy", { note: "at the end of a word" }),
  spells("aw", "aw", "saw"),
  spells("au", "aw", "haul"),
  spells("ar", "ar", "car"),
  spells("ar", "or", "war", { note: "after w" }),
  spells("or", "or", "fork"),
  spells("or", "er", "word", { note: "after w" }),
  spells("ore", "or", "more"),
  spells("oor", "or", "door"),
  spells("our", "or", "four"),
  spells("er", "er", "her"),
  spells("ir", "er", "bird"),
  spells("ur", "er", "turn"),
  // All three `ear` rows together, commonest first, so that the trio is
  // readable as the one fact it is: the same three letters say the vowel of
  // `hear`, of `earth` and of `bear`, and no rule tells a child which.
  spells("ear", "eer", "hear"),
  spells("ear", "er", "earth"),
  spells("ear", "air", "bear"),
  spells("ere", "eer", "here"),
  spells("ere", "air", "where", { odd: true }),
  spells("ere", "er", "were", { odd: true }),
  spells("air", "air", "hair"),
  spells("are", "air", "care"),
  spells("eer", "eer", "deer"),
];

export const CORRESPONDENCES: Correspondence[] = [
  ...CONSONANT_SPELLINGS,
  ...VOWEL_SPELLINGS,
];

export const CORRESPONDENCE_BY_ID = new Map(
  CORRESPONDENCES.map((c) => [c.id, c]),
);

/**
 * Every spelling of a grapheme, in the order the table lists them.
 *
 * What a tick list is drawn from: a parent looks for the letters they taught
 * this week, and the sounds those letters make are the boxes under them. Built
 * here so the screen never has to group the table itself and get a different
 * answer from the one the shorthand resolver got.
 */
export const CORRESPONDENCES_BY_GRAPHEME = CORRESPONDENCES.reduce<
  Map<string, Correspondence[]>
>((map, entry) => {
  const found = map.get(entry.grapheme);
  if (found) found.push(entry);
  else map.set(entry.grapheme, [entry]);
  return map;
}, new Map());

/**
 * A grapheme's commonest sound — the first row the table lists for it.
 *
 * The shorthand `bank.ts` writes its spellings in, so that `c a t` means what
 * it looks like it means and only the unexpected sounds have to be spelled out
 * in full.
 */
export function defaultSpelling(grapheme: string): Correspondence | undefined {
  return CORRESPONDENCES_BY_GRAPHEME.get(grapheme)?.[0];
}

/**
 * Resolves one written part of a spelling to a correspondence id.
 *
 * `a` is the commonest sound those letters make; `ea:e` says which one when it
 * matters. Never throws and never guesses: a part that names nothing in the
 * table comes back as itself, which is an id no inventory can ever hold, so the
 * word it belongs to is simply never decodable. `phonics.test.ts` asserts the
 * bank contains none of those — a typo must fail a test rather than quietly
 * retire a word.
 */
export function spellingId(part: string): string {
  if (CORRESPONDENCE_BY_ID.has(part)) return part;
  return defaultSpelling(part)?.id ?? part;
}

/** True for a spelling a parent may tick. See `Correspondence.odd`. */
export const isTeachable = (entry: Correspondence): boolean => !entry.odd;

/**
 * The letters of a correspondence as they land in a word.
 *
 * A split vowel is two pieces with a consonant between them, so it answers with
 * the piece that sits where the vowel goes and the piece that trails at the end
 * of the word. Every other spelling is itself, and no tail.
 */
export function graphemeParts(grapheme: string): [head: string, tail: string] {
  const split = grapheme.indexOf("_");
  return split < 0
    ? [grapheme, ""]
    : [grapheme.slice(0, split), grapheme.slice(split + 1)];
}

/**
 * A split vowel as it is *printed*: `a-e`, not `a_e`.
 *
 * Beside `graphemeParts` because the two are the same fact seen twice — the
 * underscore is the table's notation for "the consonant goes here", and neither
 * a page nor a tick box may show it. It cannot survive onto a sheet for two
 * separate reasons: it reads as a blank to fill in, which is the opposite of
 * what it means, and `Problem.prompt` uses a single `_` to mark where the answer
 * goes, so a prompt carrying one would have a ruled slot drawn through the
 * middle of a spelling.
 *
 * Here rather than in `sheets.ts` because a sound card is drawn in `cards.ts`,
 * which the family imports rather than the other way round: a card's big line
 * needs this, and reaching up to the family for it would be a cycle. Everything
 * that prints a grapheme — card, chart, blending prompt, matching column, tick
 * list — goes through it.
 */
export const graphemeText = (grapheme: string): string =>
  grapheme.replace("_", "-");
