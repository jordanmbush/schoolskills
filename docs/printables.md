# The Print Shop — worksheets you can print

A fourth surface for the site: printable sheets. Not a game — a press. A parent
picks a sheet, tunes it, and gets paper.

This document is the design, the scope, and the order to build it in. The work
is tracked as **epic #76 (PRINT01–PRINT31)**, whose stories reference the
section numbers here — so a heading that moves should move with its story.

---

## 1 · What it has to satisfy

The three constraints in `CLAUDE.md` are not softened by this feature — they
are what makes the design obvious.

**Static.** No server means no server-side PDF renderer. A worksheet has to be
generated in a browser.

**The player's data is theirs.** Custom sheets go in IndexedDB, the same as
custom word lists. Nothing about a child is uploaded — including, importantly,
their name, which is the one field every worksheet on earth asks for. The
"Name:" line on a sheet is printed blank by default and filled in by hand.

**SEO is a first-class requirement.** This is the part that changes the shape
of the whole feature. "Free printable multiplication worksheets" is one of the
largest search categories in education, and the site is already built to win
that kind of query — twelve prerendered times-table pages are the proof. So the
catalog is not a listing that links to an app. **Each catalog page is a real
prerendered worksheet.** A parent arriving from Google can press ⌘P without
touching anything, and a crawler reads the same HTML they do.

---

## 2 · The one idea the rest follows from

**A sheet is HTML.** Not a canvas, not a PDF blob, not an image. Real elements,
laid out in real inches, with a print stylesheet.

Everything good here falls out of that:

- The catalog pages **ship zero JavaScript**. A React component with no
  `client:*` directive is rendered to HTML at build time by `@astrojs/react`,
  which means the same renderer serves the prerendered page and the live
  builder. Exactly the trick `App.tsx` already pulls by mounting twice.
- The worksheet is **crawlable content**, not an opaque asset. The problems on
  a multiplication sheet are text a search engine can read.
- It is **accessible and selectable**, works at any zoom, and reflows for
  someone reading on a phone before deciding to print.
- It **works offline** through the existing service worker with no extra work.
- It costs nothing in bundle size. No PDF library, no font embedding, no
  fontkit.

---

## 3 · Where the code goes

The layer boundaries in `eslint.config.mjs` already have a slot for this. The
header of block A says the engine stays framework-free so the same functions
can run "in a build-time script that pre-renders a worksheet PDF". That was
written before there were any worksheets. It is still the right shape.

```
src/engine/sheets/
  spec.ts          SheetSpec — what every family of sheets must say about itself
  index.ts         the front door: sheetSpec(kind), buildSheet(config, seed)
  types.ts         SheetConfig union, Sheet, Block
  paper.ts         page sizes, margins, ruling geometry — all in real units
  layout.ts        how many problems fit on a page (pure arithmetic, no DOM)
  maths/*.ts       arithmetic, fractions, geometry, pre-algebra …
  writing/*.ts     tracing, copywork, cursive joins
  words/*.ts       spelling sheets, word search, ABC order, scrambles
  phonics/*.ts     sound inventories, constrained word generation, the seven
                   sheets built out of them, and the orthography marking pass
  passages/*.ts    the public-domain text library, Scripture included
  templates/*.ts   lined paper, graph paper, charts, certificates

src/components/sheet/    the block renderers. Prop-driven, no storage, no
                         services. Rendered at build time on catalog pages and
                         at runtime in the builder — one renderer, two mounts.

src/games/printshop/     the builder island. `src/games/` means "a mounted
                         app", which `src/games/race/` already establishes;
                         the directory name is the only thing about it that
                         says "game".

src/services/sheets.ts   saved sheets. The only writer of the `sheets` store.

src/pages/printables/    the catalog. Astro, prerendered, indexable.

src/styles/sheet.css     the sheet's own geometry — absolute units
src/styles/print.css     @page, and what disappears when you print
```

Nothing here needs a new eslint block. `src/components/sheet/**` and
`src/games/printshop/**` are already inside the view boundary and already under
the 300-line cap, which is a constraint worth welcoming: a worksheet builder is
the exact kind of screen that grows into a 900-line settings panel.

### The spec, mirroring `DeckSpec`

`DeckSpec` exists because the race loop can't generically decide what two cards
share a fact, or whether an answer matches. A sheet has the same shape of
problem, so it gets the same shape of answer:

```ts
export type SheetSpec = {
  /** Matches SheetConfig.kind, so a saved sheet finds its way back here. */
  id: string;
  label: string;
  /** Which world it prints in — always "paper", but stated, not assumed. */
  world: World;
  /** Build the sheet. Deterministic in (config, seed). */
  build(config: SheetConfig, seed: number): Sheet;
  /** The same sheet with answers filled in. Not optional. */
  key(sheet: Sheet): Sheet;
  /** One line for the catalog and the record of what was printed. */
  describe(config: SheetConfig): string;
};
```

`sheetSpec(kind)` never throws, for the same reason `deckSpec(mode)` never
throws: a sheet saved six months ago must still open after its family is
renamed. Return an `UNKNOWN_SHEET` that renders a blank page and says so.

### `Sheet` is plain data

```ts
type Sheet = {
  paper: Paper; // size, orientation, margins
  header: SheetHeader; // title, instructions, name/date line, score box
  blocks: Block[];
  footer: SheetFooter; // credit lines, short URL back to the game
};

type Block =
  | { kind: "problems"; columns: number; items: Problem[] }
  | { kind: "rules"; rule: Rule; lines: number }
  | { kind: "trace"; rule: Rule; rows: TraceRow[] }
  | { kind: "copywork"; text: string; rule: Rule; mode: TraceStyle }
  | { kind: "grid"; grid: GridSpec } // graph, hundred chart, coordinate
  | { kind: "wordsearch"; letters: string[][]; find: string[] }
  | { kind: "matching"; left: string[]; right: string[] }
  | { kind: "blanks"; sentences: Blank[] }
  | { kind: "choice"; questions: Choice[] }
  | { kind: "clock"; faces: ClockFace[] } // SVG dials
  | { kind: "shapes"; figures: Figure[] } // SVG geometry
  | { kind: "cutline" }
  | { kind: "spacer"; height: Length };
```

The engine returns this; the view renders it. No React in the engine, no
measurement in the engine — see `layout.ts` below.

---

## 4 · Paper, and why it's in inches

The rest of the app is built on `rem` and `--ui-scale`, which scales every size
with the player's age. **A worksheet must not do that.** A ⅝-inch handwriting
rule is ⅝ of an inch or it is wrong, and a child who has been taught to write
between two lines will notice before an adult does.

So the sheet subtree opts out:

```css
.sheet {
  --ui-scale: 1; /* neutralised, not inherited */
  font-size: var(--sheet-pt); /* points, set by the config */
  width: var(--paper-w); /* 8.5in / 210mm */
  height: var(--paper-h);
}
```

`paper.ts` owns the numbers, in a single unit (thousandths of an inch is the
pragmatic choice — integers, no float drift, converts cleanly to mm):

| Paper  | Size          | Default margin |
| ------ | ------------- | -------------- |
| Letter | 8.5in × 11in  | 0.5in          |
| A4     | 210mm × 297mm | 12.7mm         |
| Legal  | 8.5in × 14in  | 0.5in          |

Letter is the default. A4 is a switch, not an afterthought — a sheet that runs
off the bottom of the page is worse than no sheet.

### `layout.ts`, and why capacity is arithmetic

"How many problems fit" must be answerable without a DOM, or the catalog pages
can't be built and the engine can't be unit-tested. So capacity is computed
from geometry: usable height ÷ row height, usable width ÷ column width. The
renderer then honours that layout rather than discovering it. The consequence
is that a problem cell has a **declared** size, not a measured one — which is
a real constraint on the design of each family, and the right one.

---

## 5 · The ruling systems

The user-facing list, and the geometry behind it. All of these are two numbers:
a repeat pitch and where the lines sit inside it.

| Ruling         | Pitch   | Notes                                          |
| -------------- | ------- | ---------------------------------------------- |
| Handwriting 1" | 1in     | Kindergarten. Top, dashed mid, base, descender |
| Handwriting ¾" | 0.75in  | Early Y1                                       |
| Handwriting ⅝" | 0.625in | The commonest primary size                     |
| Handwriting ½" | 0.5in   | Y2–Y3                                          |
| Handwriting ⅜" | 0.375in | Transitional                                   |
| Wide ruled     | 11/32in | 0.34375in. Margin line 1.25in from the left    |
| College ruled  | 9/32in  | 0.28125in. Margin line 1.25in                  |
| Narrow ruled   | 1/4in   |                                                |
| Graph ¼"       | 0.25in  | Also 1/5in, 1cm, 5mm                           |
| Dot grid       | 0.25in  |                                                |
| Isometric      | 0.25in  | 30° triangular                                 |
| Blank          | —       |                                                |

Handwriting rules take a variant: solid midline, **dashed** midline (the usual),
or no midline. And a "descender space" toggle, which is the difference between
a sheet a child can write a `g` on and one they can't.

### Draw them as SVG lines, not background gradients

The obvious implementation is `repeating-linear-gradient`, which is what
`worlds.css` already does for the jungle's handwriting terrain. **Don't.**
Browsers drop `background-image` and `background-color` when printing unless
the user has "Background graphics" ticked, and most people don't. Borders and
SVG strokes are foreground paint and always print.

So a ruled block is one inline `<svg>` with `<line>` elements at computed
positions. It also gives dashed midlines for free (`stroke-dasharray`) and
prints at the printer's resolution rather than the screen's.

Where a background genuinely is wanted (a tinted answer box), set
`print-color-adjust: exact` — but prefer a hairline border. **Ink-saving is a
feature, not an accident:** the default sheet is black on white with no fills,
because a parent printing thirty pages a week is paying for this in toner.

---

## 6 · Tracing, without a tracing font

Dotted and dim letterforms are the point of a handwriting sheet, and every
commercial tracing font is licensed per-seat. We don't need one.

SVG `<text>` can be stroked, and a dash pattern applies **along the glyph
outline**. That gives every trace style from one ordinary font:

| Style      | How                                                              |
| ---------- | ---------------------------------------------------------------- |
| Solid      | `fill: currentColor`                                             |
| Dim / grey | `fill: currentColor; opacity: .28` — tune per font weight        |
| Hollow     | `fill: none; stroke: currentColor; stroke-width: .5pt`           |
| **Dotted** | as hollow, plus `stroke-dasharray: 0.5 3; stroke-linecap: round` |
| Dashed     | as hollow, plus `stroke-dasharray: 4 3`                          |

One font, five appearances, no licensing, and the dash pitch is a slider.

Start dots and directional arrows are the one thing this _can't_ derive — those
need per-glyph authored data (where the pen starts, which way it goes). That is
real work for a real payoff and belongs in a later phase. Note that stroke
order differs between teaching models, so it is per-font data, not per-letter.

### The fonts

Self-hosted, like the existing three, for the reason in `fonts.css`: a request
to Google's CDN carrying a child's IP is exactly what `/privacy` says doesn't
happen here.

- **Cursive and handwriting models — [Playwrite](https://fonts.google.com/specimen/Playwrite+FR+Trad/about)** (TypeTogether, SIL OFL).
  A superfamily covering the handwriting models actually taught in 40+
  countries, built on the Primarium research. It ships a separate **Guides**
  family that draws handwriting guidelines, using `_` as the guideline glyph —
  designed precisely for making practice sheets. This is the find that makes
  the handwriting work tractable.
- **Print / manuscript** — needs a single-storey `a` and `g`. **ABeeZee** (OFL,
  drawn for children learning to read) or **Andika** (SIL, drawn for literacy
  work). Pick one; don't ship both.
- **Body and headings on the sheet** — the site's existing Nunito, so a
  worksheet looks like it came from here.
- **Optional** — OpenDyslexic (OFL) as an accessibility choice.

D'Nealian® and Zaner-Bloser® are trademarked models with commercial fonts. We
describe our styles by shape ("continuous cursive", "slanted print"), never by
their trademarks.

**What shipped (PRINT15).** Playwrite US Trad for cursive, **Andika** for print
and OpenDyslexic for the accessibility option, self-hosted in `public/fonts`
with their provenance in the `LICENSE.md` beside them and the OFL text itself in
the `OFL.txt` beside that. Andika over ABeeZee on the letterforms a child is
asked to copy: a straight-stemmed `l` rather than a tailed one, an `I` with
serifs that can't be read as an `l`, and an x-height that sits nearer the
midline of primary ruled paper. The proportions each face is sized by are
measured out of the files themselves and live in `src/engine/sheets/faces.ts` —
Playwrite's tallest ascender is a whole em against Andika's 0.79, so one shared
ratio would print two of the three through the top rule. What the em is fixed to
is that ascender and the top line; the midline follows from it rather than being
solved for, so letter bodies clear the midline (Andika by 0.13 of the writing
space, OpenDyslexic 0.16, Playwrite 0.01) and an Andika capital, at 0.71 em,
stops about a tenth of the writing space below the top line — a text face on a
manuscript ruling, and the stated tolerance. The dash pitches in the table above
are the same numbers as multiples of the outline weight, which is what keeps
dots reading as dots on a ⅜ rule.

**What shipped (PRINT17): three cursives, not one.** The note above about
regional variants turned out to be the whole story, so the model is a choice.
**Playwrite US Trad** is the looped traditional hand and stays the `cursive` id
saved sheets already carry; **Playwrite US Modern** is the same letters unlooped
and is the one model that lifts the pencil — its `calt` table breaks after
`b f g j p q s y`; **Playwrite GB J** is the fully joined British hand, with a
lead-in stroke into every letter. All three are measured into `faces.ts` beside
the other two (ascents 1.019, 0.957 and 0.894, so one shared ratio would print
two of them through the rule), and only the looped one hangs its descender over
the tail space.

Which letters join is read out of the font and never written down here: a cell
is one `<text>` element, so the face's own contextual alternates see the pair
either side of every join and draw the form that belongs there. That is what
makes the `joins` style honest in all three models — the same sheet separates
`ba` in one hand and joins it in another, and both are right — and it is why
that style resolves its own face rather than trusting a config that says
`print`: two letters that don't touch are not a join. The families themselves
are in `engine/sheets/writing/joins.ts`, and the shelf is `/printables/cursive`,
cross-linked with the print handwriting hub.

One thing a joining face broke that a printed one never had: `Face.advance` is a
mean over `a`–`z`, and a row of `Aa`…`Zz` is not a sample of `a`–`z`. In a
joined hand a capital is drawn with an entry flourish and a stroke out to the
letter after it, so packed off the small-letter mean the alphabet row came out
one group too dense and `Mm` printed a tenth of an inch into the trace beside
it — which reads as one continuous joined string rather than as a model and a
copy. `faces.ts` therefore declares a second mean, `capAdvance`, measured off
the shaped pairs, and `glyphAdvance` picks between the two by reading the text
exactly as `glyphHeight` picks between the three heights. The packing is checked
by a test that no cell is narrower than what the row writes, and the font files
themselves are checked for the `calt` feature and the connector glyphs a join is
actually drawn with.

---

## 7 · Answer keys, seeds and variants

Three features, one mechanism.

`buildSheet(config, seed)` is deterministic — `mulberry32` in
`src/engine/random.ts` is already there and already used for exactly this
reason on the race decks. From that:

- **The answer key** is `spec.key(sheet)` — the same sheet with the answers
  drawn in. Not optional on any generated family. It is the single most
  expected feature of a worksheet site and the most common thing done badly.
- **"Different sheet, same settings"** is `seed + 1`.
- **Variants A / B / C** for a class, or for a retry that isn't the same
  twenty problems, are `seed`, `seed+1`, `seed+2` printed as consecutive pages.
- **A sheet is reproducible from its URL**, because the seed is in it. Which is
  what makes sharing work without a server.

The seed is shown, in small type, in the footer. A parent who wants the _same_
sheet again next week can have it.

---

## 8 · Routes

**Decided: `/printables`.**

```
/printables                          hub — search and browse. Indexable.
/printables/grade/[grade]            /printables/grade/3rd-grade
/printables/[subject]                /printables/math, /printables/handwriting,
                                     /printables/bible
/printables/[slug]                   one sheet type — prerendered AND printable
/printables/make                     the builder island. noindex.
```

`/printables` over `/worksheets` because the section has to hold lined paper,
hundred charts, certificates, copywork and reading logs, none of which are
worksheets — and every individual slug can still carry the head term.
`/printables/multiplication-worksheets` ranks on "multiplication worksheets"
exactly as well as `/worksheets/multiplication` does, so the broader parent
noun costs nothing and buys room. **Treat it as a one-way door:** changing it
later means redirects the static hosting doesn't natively do.

Each `/printables/[slug]` page carries, in this order: a real `<h1>` and two or
three paragraphs that answer the query, **the sheet itself as printed HTML**,
a link into the builder preloaded with that config, and cross-links to
neighbouring sheets. Where it's a maths topic, it also links to the matching
`/multiplication/N-times-table` page and to the game — the internal-linking win
is significant and free.

Bound the programmatic set. Twelve times-table pages work because there are
twelve of them and each has a real tip on it. Five thousand permutations of
grade × operation × difficulty is a doorway-page farm, and the `noindex`
reasoning in `Base.astro` shows this codebase already knows why that's a
liability. Curate the slugs; generate the sheets.

**What shipped (PRINT28), and the one decision inside it.** Ten year pages,
Pre-K through 8th, over the nine subject hubs that were already there. The
decision that made them possible without inventing anything: **a grade is read
off the sheets, never written onto them.** Every catalog entry already stated
the ages it was drawn for — `Ages 8–11` on the division worksheet — so a year
page is the sheets whose stated band reaches the two ages a child is in that
year, and `_grades.ts` is a parser and an overlap test rather than a second
table of judgements to keep true. A sheet therefore appears on two or three of
the ten, which is the honest answer and is what the pages say out loud; the
alternative, a grade level asserted by a worksheet site, is a guess dressed as
a standard. `_shelves.ts` is the registry the year pages read, and `hub: false`
on paper is the only entry whose "all of it" link is the front door: fifteen
rulings are chosen by reading how one differs from the next, which is what
`/printables` already sets out. The counts on a hub are computed and its three
landmarks are routes whose names are read back out of the catalog, so neither a
number nor a sheet's name exists twice.

**What shipped (PRINT29), and why it added no routes at all.** The search is a
build-time index (`/printables/search-index.json`, a projection of `_shelves.ts`
and nothing else) read by a `client:only` island on `/printables`. The decision
worth recording is where the facets live: **in the URL fragment, never in a
query string.** `?grade=3rd-grade&type=worksheet` is a distinct URL to a
crawler, and four facets crossed over a hundred and nineteen sheets is several
thousand of them, each a near-duplicate of a page that is already indexed —
this section's doorway-page rule arrived at from the other direction. A
fragment is never sent anywhere, so a search is still shareable and
bookmarkable while the indexable set stays exactly the nineteen curated pages:
nine subject hubs and ten school years. The hub itself is unchanged HTML, so a
crawler and a visitor with no JavaScript get the whole catalog and no dead
search box. `scripts/search-index-guard.mjs` fails the build if a row points at
a page `dist/` doesn't have, or if a page `dist/` has is reachable from
neither the index nor a hub.

### The sitemap landmine

`astro.config.mjs` filters **every `WORLDS[].href` out of the sitemap**,
because a world's `href` is by definition its `noindex` game route. Add a
`paper` world with `href: "/printables"` and the site's largest SEO surface
silently vanishes from the sitemap, with nothing failing and no test catching
it.

Two ways out:

1. **Follow the jungle exactly.** `href: "/printables/make"` (the island,
   noindex) and `guide: { href: "/printables", label: "Worksheets to print" }`.
   Zero config change, consistent with the existing model. The masthead entry
   then points at the builder rather than the catalog, which is arguably right
   — the nav link is "go make a sheet".
2. **Widen the registry.** Give `WorldInfo` an explicit `island` field, equal
   to `href` for the three existing worlds, and filter the sitemap on that.
   Better long term, touches shared config.

Recommend (1) for phase 0 and (2) whenever a second world wants an indexable
front door. Either way: **add a build-time assertion that `/printables` is in
the sitemap.** This is precisely the class of bug the smoke test exists for.

---

## 9 · The world, and the map

A new world, `paper`, called **The Print Shop**. Per `CLAUDE.md` that is a
block in `src/styles/worlds.css`, an entry in `src/engine/worlds.ts`, and
nothing else.

The biome writes itself, and it is the only one on the site that isn't outdoors:
a press room. Warm graphite ink ramp rather than the cold blues of grid and ice,
a blueprint-cyan `--accent`, and terrain of faint registration marks and
non-photo blue grid. The sheet itself is white paper floating on it, which is
how every layout tool on earth presents a page and is also just true.

The telemetry five don't change, as always. `--go` is the print button.

**Decided: it gets a map card.** `src/components/site/WorldMap.astro` renders
one card per `WORLDS` entry on the home page — badge, subject, name, tagline,
blurb, and a strip of that world's own terrain along the bottom. Adding a
fourth is a `BADGES` entry and nothing else, and the heading above the cards
("Three worlds, and no locked doors") needs its number updating.

One honest wrinkle to write around rather than ignore: the map is a child's
screen and this world is a parent's. The card's `subject`, `tagline` and
`blurb` should say so plainly instead of pretending a worksheet is a level, and
`levels`/`ages` want different words here — something closer to "Pre-K to Y8"
than "12 tables".

---

## 10 · Printing

**Decided: print only.** `window.print()` with a print stylesheet, and the
browser's own "Save as PDF" is the download path. No client-side PDF library,
which would cost ~600KB and a second rendering path that drifts from the first.

`@media print` hides the masthead, the footer, the ad slots, the skip link and
every builder control, and `@page` sets size and zero margin so the sheet owns
its own geometry and screen matches paper exactly.

Ad slots must never sit inside the printable region — put them beside it, and
add a test that asserts no `.ad` is a descendant of `.sheet`.

Two things this makes non-negotiable, because the print dialog is now the whole
of the output path:

- **The print preview must be right the first time.** Page breaks
  (`break-inside: avoid` on problem rows, `break-after: page` between sheets)
  and the `@page` size have to be correct before a family ships, because
  there's no PDF to fall back on.
- **Say what to do.** The Print button's neighbouring hint reads "Print, or
  choose _Save as PDF_ in the print dialog to keep a copy." One line, and it
  removes the only real objection to this approach.

_Considered and deferred:_ prerendering the curated catalog to `.pdf` at build
time with Playwright, which is already a devDependency. It would give real
files and a second bite at the same queries, since Google indexes PDFs. Worth
revisiting if search data shows people looking for "… worksheet pdf"
specifically; not worth the CI time before then.

---

## 11 · The catalog: what's real, and what isn't

Being honest about this is the difference between a good section and a
worksheet farm. Three tiers:

### Generatable — infinite, correct, answer-keyed

These are pure functions with verifiable answers. This is where the effort goes.

**Maths.** Counting and numeral tracing 0–20 · ten frames · number bonds ·
addition and subtraction (horizontal, vertical, with and without regrouping,
missing addend, fact families) · multiplication and division (tables, grids,
long multiplication, long division with and without remainders) · place value ·
rounding · comparing and ordering · fractions (identify, equivalent, add and
subtract like and unlike, multiply, divide, simplify, mixed numbers, fraction
bars and circles as SVG) · decimals · percents · money (with a currency switch)
· time (analog dials as SVG — read them, or draw the hands) · elapsed time ·
measurement and unit conversion · area, perimeter, volume · angles ·
coordinate plane · integers · order of operations · exponents and roots ·
one- and two-step equations · expressions · inequalities · slope and linear
graphs · ratio, proportion, unit rate · mean, median, mode, range · word
problems from templates.

**Handwriting.** Letter tracing, upper and lower, print and cursive · the
trace → copy → independent progression on one sheet · words · sentences ·
passages · cursive joins · number formation.

**Words.** Spelling: write it three times, ABC order, missing letters, word
shapes, unscramble, word search, crossword, use it in a sentence · sight-word
sheets from the existing Dolch lists **and from a parent's own saved deck** ·
rhyming · syllables · word families · prefixes and suffixes · plurals ·
contractions · homophones · synonyms and antonyms.

**Grammar.** Parts of speech · subject and predicate · sentence types ·
punctuation · capitalisation. Not generated from a rule but drawn from a tagged
sentence bank — authored content, small and reusable, because grammar is a
judgement rather than a calculation.

**What shipped (PRINT20).** The words shelf, and it is two families rather than
one because the two halves are mirror images. `words/spelling.ts` is a list
somebody else wrote in seven exercises — write it out, word shapes, missing
letters, find it among its near misses, ABC order, use it in a sentence, and the
blank test — where the list is the content and the exercise is a setting, so the
same twelve words are a week's worth of paper from one box. `words/study.ts` is
the other way round: the exercise is a parent's and the content is ours,
authored in `words/bank.ts` because **English will not yield to a rule here** —
a plural is `-s` until it is `-es`, `-ies`, `-ves` or `children`, and a generator
reaching for the rule prints `mouses` in an answer key. Ten topics, each stating
which of the three shapes of question it can honestly be asked in, because
"write a word that rhymes with cat" has a hundred right answers and no key.

Two things were reused rather than rebuilt, and both were nearly free. A "find
the word" sheet's near misses are `wordDistractors` out of `decks/words.ts` —
the same three the race's _spot it_ round deals — so a printed sheet and a played
round ask one question of one list. And a sight word to _trace_ is the
handwriting family with a word list on it, so the shelf's tracing page is a
`HandwritingConfig` rather than an eighth spelling style: two families that draw
letterforms would be one too many. Word search and crossword stay PRINT21.

**What shipped (PRINT22).** Grammar: one family, five topics, one bank. The
bank is the story. Spelling is authored because **English will not yield to a
rule**; grammar is authored because **grammar is a judgement** — whether a word
is an adverb, whether a comma is needed, which half of a sentence is the
subject, each decidable in a particular sentence and arguable in general. A
parser would be right most of the time, and a sheet that marks a defensible
answer wrong teaches a child something false, which is worse than no sheet. So
`engine/sheets/grammar/bank.ts` is sentences written down once and **tagged** —
what the sentence is for, where it divides, which one word can be named without
argument, which word has lost its capital — and the five topics are five views
of those tags rather than five parses. Nothing in `grammar.ts` analyses English.

The house rules are the feature, and they are all of the form _leave it out_. No
article or possessive is ever the tagged word, because the schemes disagree
about what those are; verbs are past tense or the word that opens a command,
which is the cheapest way to make a word class unarguable; a split is exhaustive
or absent, which is what stops "complete subject" and "simple subject" being two
right answers to one question; an exclamation is exclamative in _form_, so the
mark on the end is grammar rather than tone. Those rules are what decide the
shape of the shelf too: there is no `match` style, because pairing a word to a
class is the same judgement with a worse layout; there is no comma topic and no
exclamation-mark topic, because neither has a key; and end punctuation asks only
for a full stop or a question mark for the same reason.

Five catalog pages, and five is the point rather than a start. "Noun
worksheets", "verb worksheets" and "adjective worksheets" are all real queries
and all three would be this one sheet with a filter on it — the doorway-page
farm §8 argues against. Two things the pages are held to mechanically: a drawn
page covers the closed list it prints down every line (a types sheet with no
command on it is correct in every item and no longer the exercise), and every
sentence the prose quotes is a sentence the sheet under it prints.

### Templates — blank forms, high value, low effort

Genuinely useful and completely honest: they're supposed to be empty.

Lined paper in every ruling · graph, dot and isometric paper · hundred charts ·
multiplication grids (blank and filled) · number lines · coordinate grids ·
place-value mats · reading logs · book report forms · story maps and paragraph
frames · writing prompts · lab report sheets · scientific method sheets ·
observation journals · timelines · calendars and planners · chore and behaviour
charts · award certificates · name tags and bookmarks · blank flashcards with
cut lines · dice and spinner nets · memory-verse cards and a verse-of-the-week
chart.

**What shipped (PRINT26): the blank maths references.** `templates/charts.ts` —
hundred charts blank and filled over a configurable range, number lines with the
interval a parent sets, first- and four-quadrant coordinate grids, and
place-value charts down to thousandths — on eight pages at `/printables/charts`,
with the metric squares the paper shelf was missing beside them (1 cm and 5 mm
graph, 1 cm dots, 1 cm isometric). Two things listed above are deliberately not
in it: a **multiplication grid** is `/printables/multiplication-chart`, which is
the times-table family with `style: "grid"` on it, and graph paper is the grid
end of the paper shelf. Both are linked rather than rebuilt, for the reason a
sight word to trace is a `HandwritingConfig` — a second family that drew a
times-table square would be a second answer to what goes in square forty-two.

The tier's own argument is what this family had to be held to. A worksheet can
be marked, so a mistake on one is found; a reference sheet is counted along and
trusted, and nothing on the page says when it is wrong. So every count is
verified off the finished blocks and off the rendered markup rather than off the
arithmetic that made them, and three of the failures were only visible in a
browser: `chromeHeight` reserves a title row only if the _options_ it is handed
carry one — a family that prints a title regardless and passes its config
straight in builds a page an inch too long, and `.sheet` is `min-height`, so
nothing overflows on screen; `flex: 1 0 100%` means "a line to yourself" inside
`.sheet__problem` and "take all the height going" inside `.sheet__blocks`, which
is a number line at six times its declared height; and a spacer between two
blocks buys the flex column a second gap to pay for. `GridSpec.row` is the one
new field, set by the one chart whose rows are not squares — everything a child
measures against leaves it unsaid and gets squares by construction.

**What shipped (PRINT27): the rest of the paperwork.** Four families, and what
they have in common is the tier's own argument — **they are supposed to be
empty**, which is what makes them cheap and honest at the same time. Nobody has
to check whether the science on a lab report sheet is right, because there
isn't any: the _paperwork round_ a science lesson is ours to print and the
science is not, which is §11's third tier said from the other side.
`templates/forms.ts` is nine sets of headings with room to answer under each —
reading log, book report, story map, paragraph frame, writing prompt, lab
report, the scientific method, an observation journal and a timeline;
`templates/planner.ts` is five views of a week; `templates/cards.ts` is the
paper that gets cut up; and `templates/nets.ts` is two things that are objects
rather than pages. Twenty-two catalog pages at `/printables/templates`.

Three things on the shelf can be _wrong_, and all three are verified by a path
that does not go through the code that made them:

- **A calendar's weekdays.** `weekday` is Sakamoto's algorithm — integer
  arithmetic with no ambient state, so a catalog built in one timezone prints
  the same month as one built in another — and the suite checks twenty years of
  it against the platform's own `Date`. The dates are then read back off the
  finished cells rather than off the offset that placed them.
- **A die's faces.** Which two squares end up opposite each other is a fact
  about _folding_, not about the drawing, so `nets.test.ts` folds the net: it
  walks the squares carrying an orientation, works out where each one points in
  three dimensions, and checks that every opposite pair adds to seven. The seven
  glue tabs fall out of the same walk — a cube has twelve edges, five are folds
  in this net, and two tabs on one join is a lump that stops it closing.
- **A spinner's sectors.** Equal by construction rather than by arithmetic: the
  block carries a radius and a list of labels and _no angles at all_, so there
  is nowhere for a longer word to have bought itself a wider slice. "Do you
  think this is fair?" is the question the object exists to answer.

**The cut geometry is the story of the cards.** Cut lines on every card
boundary, the outside trim included, because a sheet whose outer edge is
unmarked is a sheet cut freehand. **No gutter** — two cards share one edge and
one pass of a trimmer makes both — and what is left over goes _round_ the block,
split evenly left and right, which is the mirrored-margin failure this is
guarding against and is invisible on screen either way. The card is rounded down
to a whole number of eighths of an inch so the dimension the page quotes is one a
ruler can settle: eight flashcards to a page are 3¾ by 2¼ inches, and the test
holds the prose to the block.

**A printed back is deliberately absent, and a fold is offered instead.**
Duplexing on a home printer lands within about an eighth of an inch at best and
lands there _asymmetrically_, so a back page with its columns flipped to
compensate would still print a verse cut through its own reference on half the
sheet. The two panels of a tent are the same piece of paper and cannot be out of
register with each other; the upper one is printed upside down because folding it
back and down turns it round. That is the honest version of "front and back line
up".

Two things had to give way to keep a page a page, and both were found by a test
rather than by looking. A form declares _shares_ of the writing height rather
than line counts, takes a line each before anything is shared out, and drops the
rows the page cannot hold — reserving for all five rows of a paragraph frame at
36pt produced a sheet 35 thousandths of an inch too tall, which `.sheet` hides
because it is `min-height`. And a verse-of-the-week chart _sizes its verse to the
room_: capping the reservation does not make the block smaller, it moves the
overflow somewhere nobody looks, so the size is searched down until the words fit
and the week always keeps a heading row and a line to write on.

**Dropping a row is only honest where a row is a request.** It is on a chore
chart — four jobs and a growing list is what a family with four jobs wants — and
it is not on the three sheets whose row count is arithmetic: a dated month has
the rows the month has, a week has seven days, and the verse chart counts three
things. Those refuse the sheet rather than print part of one, which is what
`cardGrid` already did for a card too small to cut, and the line naming the
sheet is computed off the same fit the blocks were, so a chart with four rows
can no longer describe itself as six. Reachable at 36pt on a landscape page,
invisible on screen, and found on the wall.

Scripture is woven through here exactly as §12 asks: memory-verse cards and
Scripture bookmarks are the card family with a passage on it, resolved through
the same `copyworkSource` door as copywork, and the verse-of-the-week chart is
the planner family with one. They sit in the same template list as the chore
chart.

### Not ours to fake

Science content, social studies content, history, and anything with a scope and
sequence. Generating "5th grade science worksheets" without an editor produces
plausible nonsense.

Map outlines are the one tempting exception, and they need real vector map data
and real geography review. Later, or never.

---

## 12 · Scripture

**Decided: woven through, not cordoned off.** This is a Christian-owned and
Christian-managed site, and Scripture is a first-class source in the Print Shop
rather than a section off to one side.

### What "woven through" means concretely

- **Copywork and handwriting.** Scripture collections sit in the _same_ passage
  picker as every other public-domain source, listed first. Choosing "Psalm 23"
  and choosing "the Gettysburg Address" are the same interaction.
- **A `/printables/bible` subject hub**, alongside `/printables/math` and
  `/printables/handwriting` in the subject nav — a peer, not a footnote. It is
  also a real search surface: "bible verse copywork printable" and "scripture
  handwriting practice" are queries with genuine homeschool volume.
- **Grade hubs list Scripture sheets** with everything else for that age.
- **Words and vocabulary.** Books of the Bible (in order — a memory-work
  staple), key names and places, and the words the stories are told in, as
  shipped lists alongside Dolch.
- **Templates.** Memory-verse cards to cut out, verse-of-the-week wall chart,
  Scripture bookmarks, a reading-plan grid, a Bible-study journal page.

**Where it doesn't go: the maths sheets.** Not for positioning reasons — as a
craft judgement. A verse reference bolted to a long-division problem serves
neither the verse nor the division, and every worksheet site that does it looks
worse for it. Scripture goes where text belongs: copywork, memory work,
handwriting, vocabulary, reading.

### The translation

**[The World English Bible is public domain](https://ebible.org/eng-web/webfaq.htm)**
— explicitly, unambiguously, and in modern English.

Ship the **World English Bible Updated (WEBu)** as the default. It is the
classic WEB with two changes that matter for this audience: the divine name is
rendered "LORD" / "GOD" rather than "Yahweh", and the spelling is American.
Classic WEB opens Psalm 23 with _"Yahweh is my shepherd"_, which will read as
an error to most families rather than as a translation choice. The British
Edition makes the same swap with British spelling and is the natural second
option.

KJV as an additional option (public domain in the US; the Crown patent in the
UK is a real legal fact and a practically nil risk). Never ESV, NIV, NASB or
CSB — strictly licensed, and bundling them would be a genuine problem.

### Attribution and the two constraints

Credit is not legally required for a public-domain text, but we credit anyway,
and the FAQ imposes two real obligations that are easy to breach by accident:

1. **Don't alter the text and still call it the WEB.** "World English Bible" is
   a trademark of eBible.org, and the one condition attached is that a modified
   text must not carry the name. So: verse text is stored and rendered
   **verbatim**, including punctuation. Verse numbers may be stripped (they
   aren't the text). Smart quotes, re-wrapping and case changes are _not_
   applied to Scripture. Where an exercise deliberately removes words —
   progressive-blank memory practice — the sheet labels it as an exercise and
   prints the full verse in the answer key.
2. **Use a recent copy.** eBible.org asks that publishers pull a current
   release so known typo corrections are included. Record the source and
   release date in the data file's header, and re-pull when the library is next
   touched.

The credit line lives as a single constant in the engine so it can't drift
between the sheet footer and the catalog pages:

```
Scripture: World English Bible Updated (public domain) · worldenglish.bible
```

Printed on every sheet that contains Scripture, and on every catalog page that
previews one.

### Don't ship a Bible

Ship a curated **memory-verse and passage library** — a few hundred entries:
Psalm 23, Psalm 100, Psalm 121, the Beatitudes, the Ten Commandments, the Fruit
of the Spirit, the Lord's Prayer, the Christmas and Easter narratives, Proverbs,
the common AWANA and catechism sets. Tens of kilobytes of engine data, and it
is what copywork actually uses.

For anything else, **paste your own verse** covers it — the same move
`parseWords` already makes for spelling lists. If the curated set proves too
small, per-book JSON as static files fetched on demand
(`/data/bible/webu/john.json`) keeps it static and keeps it out of the bundle.

**What shipped (PRINT18/PRINT19).** 274 entries in the WEBu with the KJV beside
them, checked character for character against eBible's own release
(`passages/release/*.vpl.txt`), and thirty public-domain passages around them.
"Woven through" turned out to be two fields rather than a feature:
`HandwritingConfig.passage` and `MemoryConfig.passage` are a library id, read in
one place (`writing/copywork.ts`) which either resolves it or falls back to
whatever was pasted — so by the time a row is built the sheet cannot tell which
door the words came in, and an id nine characters long is what makes a copywork
sheet fit in a `#s=` link where the psalm would not. The picker is one control
with every collection in it, Scripture first and "your own words" last, and the
credit travels on the passage rather than beside it: `SheetFooter.source` is a
field of its own precisely because an answer key has to say _both_ "Answer key"
and where the passage came from.

Memory work is the second family, and it is the one §12's licence condition
actually bites on: rounds of the same passage with a growing share of the words
gone, chosen by the seed, nesting so nothing comes back. The instruction line
says the words are left out for the exercise and the key prints the passage
whole — both halves, in the engine, so neither is a page's decision to forget.
The shelf is `/printables/bible`, a peer of `/printables/math` and
`/printables/handwriting`; the maths sheets stay clear of it, as above.

**What shipped (PRINT23), and the one thing that didn't.** Five word lists in
`engine/decks/biblelists.ts` — the thirty-nine and the twenty-seven in canonical
order, people, places, and Bible words — as ordinary `WordList`s, so they print
as any of the seven spelling styles and any of the three puzzles and are played
by the word deck without being authored twice. The books say **which canon** in
the blurb a parent reads: sixty-six is the Protestant count, a family whose
Bible has seventy-three would be taught something to unlearn, and the release we
quote ships the deuterocanon itself, so sixty-six is our editorial choice and is
stated as one.

**Catechism vocabulary, promised above, is declined.** Not an oversight and not
a scheduling call: a word list is a list of definitions a child memorises, and
the catechism words worth listing are the ones the traditions answer
differently — what baptism accomplishes, what happens at communion. A
seven-year-old handed one side of that as a fact to learn, who later finds it
was one side, learns to distrust the sheet. "Bible words" is what shipped
instead, and every entry on it is a definition the churches agree on. Anything
past that line is a parent's own list to paste in, which is a door that is
already open.

### Scripture on the front door: content, never a credential

The site is Christian-owned and Christian-run. It is not _marketed_ as such,
and that distinction is the whole of the rule:

> A verse belongs where it says something the page was already trying to say.
> It does not belong where its job is to signal which team the site is on.

Content earns its place. A credential announces an audience. The first is
what's wanted here; the second is what turns a practice site into a niche
site, and it would also make the two "what it isn't" columns on the home page
read as evasive.

**Where it goes.**

| Place                                        | Why it earns it                                                                                                                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SiteFooter.astro`, in `foot__fine`          | Already the author's own voice — _"Made for four kids, then shared."_ A reference there reads as a signature, not a banner, and it appears on every page, which is what "throughout" means without putting it on any one page's pitch. |
| The **"Where it fits in a day"** band on `/` | Its thesis is literally _short and frequent beats long and rare_. The best in-body placement on the home page, because the verse and the section argue the same thing.                                                                 |
| The Print Shop's **map card blurb**          | Lists what it prints — times tables, handwriting, Scripture copywork. A fact among facts.                                                                                                                                              |
| `/about`, under _Why it exists_              | The one page whose entire job is "who is behind this". One plain sentence, not a statement of faith. A parent who cares finds it where they'd look; nobody else trips over it.                                                         |

**Where it does not go, and this is the part that protects the intent.** Any
`<title>`, `description` or `jsonLd` on a page whose subject is _not_ Scripture
— that surface is marketing, and a marker there is a credential rather than a
description. A page whose subject **is** Scripture names it in its metadata the
way every page names its own subject: the `/printables/bible` shelf and the
sheets under it (`/printables/bible/1-corinthians-13-copywork` opens its
description with the verse it prints), the three verse templates, and a grade
hub that lists Bible among its shelves (`/printables/grade/1st-grade`). Those
are the search surfaces this section asked for a few paragraphs up, and the
carve-out is exactly as wide as the subject — no wider. Also out: the home page
hero, which is the pitch; the `#limits` columns and the "What they see, and
what you don't" ledger, which are about scope and privacy and would take a
verse as a non sequitur. And no badge, emblem, "faith-based" label, or
statement of faith anywhere.

**Which verse, which is most of the decision.** Prefer verses apt to the
_thesis_ over verses apt to the _audience_:

- Zechariah 4:10 — _"who despises the day of small things?"_ Directly the
  site's argument about ten minutes a day.
- Proverbs 13:11 — _"…but he who gathers by hand makes it grow."_ Incremental
  accumulation, which is the whole product.
- Proverbs 21:5 — _"The plans of the diligent surely lead to profit."_

Against Proverbs 22:6 (_"Train up a child…"_) and Deuteronomy 6:7 (_"teach
them diligently to your children"_), which are the two most-used verses in
homeschool marketing. They're apt, but they're apt to _who is reading_, and a
reader clocks that instantly. The first set says something about the work. The
second says something about us.

**What shipped (PRINT30).** Four placements, two verses, and neither of them
typed into a page. Zechariah 4:10 is the footer signature — the reference
alone, no text, one quiet line under _"Made for four kids, then shared."_ on
every page. Proverbs 21:5 is the one quotation, in the "Where it fits in a day"
band, because that band already argues what the verse argues; it is set the way
an aside is set, with the reference and `SCRIPTURE_CREDIT` underneath it.
`/about` gets one sentence under _Why it exists_ — a fact, with a link to
`/printables/bible`, which is the page a reader checks it against. The Print
Shop's map card needed nothing: its blurb already listed Scripture copywork
among times tables, handwriting and spelling lists, so `worlds.ts` is
unchanged.

Both are read through `passage()` rather than inlined, which puts the licence
condition in code instead of in a reviewer's memory: the words on the home page
are the release's own, and the credit travels with them exactly as it travels
onto a sheet. `passage()` answers `undefined` rather than throwing, so either
surface renders nothing at all if its id is ever retired — which is silent, so
`passages/index.test.ts` pins both ids to their references and makes a rename
fail there instead.

### The same principle extends to the games

"Scriptural references throughout" reaches past the Print Shop, and two of the
places are nearly free:

- **Frost Keys.** `TypingLevel.pool` takes whole sentences, and the level list
  in `decks/typing.ts` is already a set of passage sources. A Scripture passage
  set slots in beside them — one source among several, exactly the copywork
  picker's pattern. Typing marks **exactly**, case and punctuation included,
  which composes with the verbatim rule above rather than fighting it. One
  practical note: prefer NT, Psalms and Proverbs passages that don't contain
  the divine name, because `LORD` in small caps is a nuisance to type and
  reads as shouting to a seven-year-old.
- **Word Jungle.** Books of the Bible in order, and key names, as shipped lists
  beside Dolch. Same data as the printables lists in §12, so it is authored
  once.

Neither is a phase-0 concern; both belong with the passage library in phase 3.

**What shipped (PRINT31).** A fifth typing level — _Verses_, thirty-three of
the library's verses from Psalms, Proverbs, the Gospels and the letters — and
the whole shipped shelf in Word Jungle's picker rather than Dolch alone, which
is a one-word change because PRINT23 authored the Bible lists as ordinary
`WordList`s. Nothing was renamed and `configKey` is untouched, so every saved
run still resolves and still races its own ghosts.

Two rules picked the thirty-three, and the second was the surprise: no divine
name, as above — and nothing but keys a plain keyboard has. The release sets
quoted speech in curly quotation marks and typing marks **exactly**, so a verse
carrying one would be unpassable rather than hard. That rules out the narrative
and every quoted saying, and leaves the sayings themselves, which is the right
shape for a level anyway.

The verses are written out in `decks/typing.ts` rather than read through
`passage()`, and that is the one place this epic paid for "authored once".
Every island imports the deck registry, the print shop uses the whole library,
and a module is assigned to a chunk whole — so an import of the library from
that file moved all of it into the chunk the flash cards, the spelling mount
and the record book load: 46KB of shared chunk became 222KB, measured on the
way past. `typing.test.ts` pins every line to the library character for
character instead, which is the arrangement `scripture.ts` already has with its
release file. `SCRIPTURE_CREDIT` moved to a leaf module (`passages/credit.ts`)
so a game can carry the credit without carrying the verses, and it is printed
on all three screens that show the words: the setup that names the level, the
race, and the results that list every word back.

---

## 13 · Phonics — and why it isn't called DISTAR

DISTAR® is a trademark of SRA, and _Teach Your Child to Read in 100 Easy
Lessons_ is a 1983 copyrighted work adapted from DISTAR Fast Cycle. Its
modified orthography — the joined digraphs, the small silent letters, the
long-vowel macrons — and its hundred-lesson sequence are theirs. Reproducing
either is not something to do casually, and "supplemental worksheets for
Lesson 47" reproduces the sequence by reference.

What is genuinely ours to build, and is more useful anyway:

**A sound inventory model.** The parent says which graphemes their child has
been taught — by ticking them, or by choosing a preset they name themselves.
The engine then generates practice **constrained to that inventory**: only
words spellable from the sounds so far. That is the actual pedagogical
mechanism behind every systematic phonics program, it works for DI, for
Orton-Gillingham, for Jolly Phonics, for whatever the family uses, and it
belongs to nobody.

**Sheet types.** Sound cards · blending lines (say it slow, say it fast) ·
CVC and word-family sheets · sound-to-word matching · dictation lines ·
decodable sentence strips · a "sounds we know" wall chart.

**Typographic marking as an option.** Macron over a long vowel, dimmed silent
letters, joined digraphs — these are conventions shared across many phonics
traditions, not exclusive to one program, and rendering them is a
text-decorating pass in the engine. Offer them as switches; don't ship a preset
that is somebody's copyrighted alphabet.

The copy can say, truthfully, that it works alongside DI-style programs. It
shouldn't use the trademark as a feature name.

**What shipped (PRINT24, PRINT25).** All of it, in that order and in two
halves. `engine/sheets/phonics/` is the model: a table of correspondences —
a spelling _and_ the sound it makes there, because `ea` spells three vowels and
an inventory that could only hold "we've done ea" would put `bread` in front of
a child who can read `eat` — a hand-cut word bank, and `Inventory`, which is the
set of correspondences a parent has ticked plus their own list of words taught
by sight. `phonics/sheets.ts` is the family, and it is seven views of that one
list: sound cards, the "sounds we know" wall chart, blending lines, word
families, sound-to-word matching, dictation lines and decodable sentence strips.

The promise is that nothing on any of those pages uses a spelling that has not
been ticked — with one deliberate exception, the example word printed under a
sound card, which is the table's own mnemonic ("`sh` as in `ship`") rather than
a word to decode, and stays put as the inventory grows. Both suites say so where
they check it. Otherwise it is checked the way the word search's key is:
`sheets.test.ts` reads the words back off the finished page, looks each one up in
the bank, and compares its spellings with the inventory the config carried. A
generator asserting its own output would agree with itself whatever it did.

Two things had to be authored rather than derived. **Sentences** —
`phonics/sentences.ts` — because a list of readable words is not a sentence and
no rule turns one into the other; each is written as the words it is made of, so
a sentence is available exactly when every word in it is. And the **word bank's
cuts**, which is PRINT24's argument. Word families are then derived from those
cuts rather than authored, and grouped by the rime's _spellings_ rather than its
letters: `be` and `the` end in the same letter and not in the same sound.

The three marks are `macron`, `silent` and `joined` on `PhonicsMarking`, each a
boolean of its own, all three off by default, and every one of them derived from
the table — there is nowhere in the code for a programme's own spelling of a
rule to be written down. They apply to the cards, the chart and the strips, and
deliberately not to the blending lines or the matching sheet: **marking is for a
word a child reads, not for a word a child is working out**, and a joined `sh`
inside `shop` on a matching sheet would print the answer beside the question.

Seven catalog pages at `/printables/phonics`, one per kind of sheet — not per
sound, which is where this shelf would have become a doorway farm fastest. "sh
worksheets", "short a worksheets" and forty more are all real queries and all of
them are one of these sheets with one spelling ticked. Each page states the
spellings its own sheet uses, and says plainly that yours will be different.
There is no level, stage or lesson number anywhere on the shelf.

---

## 14 · The builder, and the three bootstraps

`/printables/make`, a `client:only` island, decomposed from the start because
of the 300-line cap — which is the right pressure for a screen like this.

```
src/games/printshop/
  App.tsx            mount, and what goes where
  useBuilder.ts      the config, the seed, and the URL they live in
  defaults.ts        what the bench opens on, per family
  Picker.tsx         choose a family (the catalog, in-app)
  PageOptions.tsx    the options every sheet has, whatever is on it
  Preview.tsx        the sheet, scaled, on the press-room ground
  PrintBar.tsx       print · variants · answer key · share
  SavedSheets.tsx    My Sheets, through services/sheets.ts
  Bootstrap.tsx      the three below — a saved list, and a paste
  Missed.tsx         practise what they missed, through services/practice.ts
  options/index.tsx  the registry — the one place `kind` is narrowed
  options/parts.tsx  choice · range · sizing · pool · word list
  options/*.tsx      one panel per family
```

Built as it stands, with two names moved from this sketch: the per-family panel
is `options/*.tsx` alone (there is no `Editor` wrapping it), and what was going
to be `Editor.tsx` turned out to be `PageOptions.tsx` — the options that belong
to no family. The reading half of `#s=` lives in `engine/sheets/share.ts` beside
the encoder rather than in the builder, because the two are one format.

The bootstraps arrived the same way. Which sheet family answers for which deck
is `engine/sheets/practice.ts` — a mode and a list of fact ids in, a config
out — because three screens ask for it and a sheet built from the same facts
has to be the same sheet whichever door it came through. What the record book
knows is read by `services/practice.ts`, so the island never goes near
IndexedDB, and a child's name stops at that boundary: what crosses it is facts.

**Live preview**, scaled with `transform: scale()` inside a dark frame. Debounce
regeneration; a sheet with 200 problems is cheap but not free.

**The config lives in the URL.** `#s=<base64url(JSON)>` — a static site's
sharing mechanism, and it costs nothing. It makes every catalog page's "open
this in the builder" link trivial, makes a configured sheet passable round a
class group, and makes a bug report reproducible. Guard it: cap the decoded
length, validate against the spec, and fall back to defaults rather than
throwing. **Never put a child's name in it** — the name field is print-blank
by default and stays out of the encoded config entirely.

**Saved sheets** go to IndexedDB through `src/services/sheets.ts`, mirroring
`services/decks.ts`: one writer, validation in the service, a
`kind: "schoolskills-sheet"` file for sharing, and the sender's id dropped on
import for the same reason.

Bootstrapping a custom sheet is three buttons, not a wizard:

1. **Practise what they missed.** Read the trouble facts the record book
   already computes and print a sheet of exactly those. **No other worksheet
   site can do this**, because no other worksheet site knows what the child got
   wrong. It is the reason this section exists at all rather than being one
   more printables site, and the phase order below is arranged to reach it as
   early as possible.
2. **From a saved word list.** Every `CustomDeck` a parent already typed in
   becomes six sheet styles instantly. Nearly free: the data is already there.
3. **From pasted text.** `parseWords` already handles whatever a school letter
   looks like. Paste a spelling list, a verse, a passage — get a sheet.

### Where "practise what they missed" is entered from

Three doors, and they're all cheap once the builder exists:

- The **race results screen**, after a run with wrong answers: _"Print these."_
- The **progress screen**, next to the existing trouble-facts drill button —
  the same list, either raced or printed.
- The **builder** itself, as bootstrap 1, with a profile picker.

---

## 15 · Storage

`DB_VERSION` 2 → 3, one additive `oldVersion < 3` block adding a `sheets`
store. Additive only, per the rule in `db.ts` — IndexedDB holds the only copy
of anything.

```ts
export type SavedSheet = {
  id: string; // `sheet-…`, so it can never collide with a deck id
  name: string;
  config: SheetConfig;
  seed: number;
  createdAt: string;
  updatedAt: string;
};
```

`Backup` goes to `version: 3` with an optional `sheets` array, and reads
versions 1, 2 and 3 — same widening the `decks` addition already did.

Saved sheets are not profile-scoped. A worksheet belongs to the household, not
to a child, and scoping it to a profile would mean re-making it for the second
kid.

---

## 16 · The bridge back to the games

The Print Shop is worth building on its own. It is worth much more wired to
what's already here:

- **Practise what they missed** (§14) — the highest-value feature in this
  document.
- **This week's spelling deck, as paper** — and the reverse: a printed list
  that carries a link back to the race.
- **A short URL in every sheet footer** pointing at the matching game.
  `schoolskills.app/flash-cards` on a multiplication sheet. Free traffic, and
  genuinely useful — the child who just did twenty problems on paper is the
  child most likely to run the race.
- **QR codes** later. A pure-JS QR encoder is ~5KB and needs no font, but it's
  a nicety, not a need.

---

## 17 · Features people expect

The checklist, so nothing obvious is missed. Most are cheap once §3–§7 exist.

**On every sheet** — name / date / class line · title · instructions ·
numbered problems · score box (`____ / 20`) · footer with credit, short URL and
seed · page numbers on multi-page sheets.

**Options** — font size in points · font family (print, cursive, dyslexia) ·
ruling and rule size · line spacing · problems per page and columns ·
difficulty · number ranges · with/without regrouping · answer key on/off ·
variants (1–5 copies, each different) · Letter/A4/Legal · portrait/landscape ·
margins · black-and-white only (default) · work space per problem · answer
boxes · cut lines · 2-up and 4-up for cards.

**Output** — print · save to My Sheets · share link · print answer key
separately or together.

**Accessibility** — larger type as a first-class option rather than a zoom
hack · dyslexia-friendly face · high contrast · generous line spacing · and the
sheet remains real selectable text, which a canvas or a scanned PDF would not
be.

---

## 18 · What to build, in what order

Each phase is a shippable thing, not a layer of an unshipped thing. The order
is arranged to reach "practise what they missed" by phase 2.

**Phase 0 · The press.** `engine/sheets` spine, `paper.ts`, `layout.ts`, block
renderers, `sheet.css`, `print.css`, the `paper` world and its map card, and
**one family end-to-end: lined paper.** Every ruling in §5, printable,
prerendered at `/printables/lined-paper`. It is the smallest thing that proves
the geometry, and "printable wide ruled paper" is a top-tier query in its own
right. Plus the hub at `/printables` and the sitemap assertion from §8.

**Phase 1 · Maths.** The arithmetic families with the full option set, answer
keys, seeds and variants. Curated catalog pages per operation, cross-linked to
the twelve times-table pages. This is the traffic phase.

**Phase 2 · The builder, and practise what they missed.** `/printables/make`,
live preview, URL-encoded config, save to IndexedDB (`DB_VERSION` 3). The three
bootstraps, and the entry points from the results and progress screens. Kit
primitives added as needed — a checkbox, a segmented control, a range, a
stepper.

**Phase 3 · Handwriting and copywork.** Fonts sourced and self-hosted, the five
trace styles, trace → copy → independent, letters through passages, cursive.
The public-domain passage library, **Scripture included from the start** — the
verse collections, the WEBu data, the credit-line constant, and
`/printables/bible`.

**Phase 4 · Words, and the spelling bridge.** Spelling sheet styles, word
search and crossword generators, Dolch reuse, custom-deck sheets, books-of-the-
Bible and vocabulary lists.

**Phase 5 · Phonics.** Sound inventories, constrained generation, orthography
marking.

**Phase 6 · Templates and the long tail.** Charts, certificates, planners,
flashcards, logs, memory-verse cards. Grade and subject hub pages.

**Phase 7 · Search.** Build-time index as a static JSON, a small island on the
hub, faceted by grade, subject, type and ruling. Everything client-side, and
everything in the fragment — see §8 for why that last part is the whole SEO
decision.

---

## 19 · Decisions, recorded

| Question                    | Decided                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| URL shape                   | `/printables`, with worksheet-shaped slugs beneath it. One-way door.                                                      |
| Print or PDF                | Print only. "Save as PDF" in the dialog is the download path.                                                             |
| Scripture placement         | Woven through — a peer subject, not a separate section.                                                                   |
| Translation                 | WEB Updated (LORD/GOD, American spelling). KJV as an option.                                                              |
| Credit                      | Constant in the engine, on every sheet and catalog page that uses it.                                                     |
| Map card                    | Yes, with copy that's honest about it being a parent's screen.                                                            |
| Scripture on the front door | Yes, where it's content — footer, the day-rhythm band, `/about`. Never in a title, description or `jsonLd`. Not marketed. |

Nothing open. Phase 0 is unblocked.

---

## 20 · Tests

The engine is pure, so most of this is cheap and worth having:

- **Geometry.** A ⅝-inch rule set is 0.625in apart, at Letter and at A4, at
  every margin. Off-by-one in a repeat is invisible on screen and obvious on
  paper.
- **Determinism.** `buildSheet(config, seed)` twice is byte-identical. Same
  guarantee the ghost races already depend on.
- **Answer keys.** Every generated answer is verified by an independent path,
  not by the generator's own arithmetic.
- **Bounds.** No negative results in subtraction unless enabled; no division by
  zero; no duplicate problems within a sheet; no problem outside the declared
  range.
- **Capacity.** `layout.ts` never returns more rows than fit, at any paper size
  or font size.
- **Scripture is verbatim.** A snapshot test over the verse library asserting
  the stored text matches the source release character for character — the
  trademark condition in §12 turned into a failing build rather than a promise.
- **Print isolation.** No `.ad` inside `.sheet`. No `client:` directive on a
  catalog page's sheet.
- **Sitemap.** `/printables` and every catalog slug are in it; `/printables/make`
  is not.
