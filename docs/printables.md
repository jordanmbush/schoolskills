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
  spec.ts          SheetSpec — how a family builds, keys and describes a sheet
  families.ts      the family table: which kinds there are, what each is
                   called, and the import() that fetches one
  index.ts         the front door for Node: every family awaited, then
                   sheetSpec(kind), buildSheet(config, seed)
  types.ts         SheetConfig union, Sheet, Block
  paper.ts         page sizes, margins, ruling geometry — all in real units
  layout.ts        how many problems fit on a page (pure arithmetic, no DOM)
  maths/*.ts       arithmetic, fractions, geometry, pre-algebra …
  writing/*.ts     tracing, copywork, cursive joins, penmanship
  hands/*.ts       letters as strokes: the shape, and a generated hand each (§25)
  words/*.ts       spelling sheets, word search, ABC order, scrambles
  grammar/*.ts     the tagged sentence bank, and five views of its tags
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

### One table, two doors

Behavior is all a spec carries. Which `kind` reaches a family and what it is
called are in `families.ts`, beside a `() => import(...)` for the module itself,
because a family reached by a static import is a family in every bundle that can
see the registry — and several carry a corpus. Eagerly, opening the builder
fetched **696,078 B** of JavaScript, the passage library alone being 174 KB of
text: a parent choosing a times-table sheet downloaded the King James Bible to
do it. It now fetches **340,503 B**, and the rest arrives a family at a time.

**Both numbers are the whole static import closure, walked from
`dist/printables/make/index.html` — not the island's entry chunk.** The entry
chunk fell much further, 431,805 B to 66,315 B, but most of that is code that
moved into siblings the entry still imports statically; a budget set on the
entry alone would sit at 66 KB and never notice 300 KB of new siblings beside
it. Two thirds of what remains is React (184,057 B, the same file on both
sides): the sheet code itself is 512,021 B → 156,446 B. `scripts/bundle-guard.mjs`
enforces a budget on that figure after every build, for the same reason it is
the figure quoted here.

The closure is also the only thing that can say whether a family is _actually_
lazy. A block renderer that reaches into a family module for one pure helper
puts that whole family in the closure, and its `() => import(...)` then resolves
from memory — lazy in the registry, eager in the browser. That is what
`phonics/metrics.ts` and `words/metrics.ts` exist to prevent, and
`components/sheet/blocks/index.test.ts` is the guard that fails when a renderer
reaches past them.

So the table is read two ways:

- **`index.ts` awaits all of it**, once, at module load. The catalog build and
  the tests keep an ordinary synchronous `buildSheet`, and nothing that ships
  to a browser imports this module.
- **The builder island loads one at a time**, through `loadSheet(kind)`, and
  renders no paper until the family that draws it has landed. The picker still
  names all twenty-seven, because naming them is what the table is for.

The option panels split on the same seam (`games/printshop/options/index.tsx`),
which is the half that matters for the passage picker: it reads the whole
library to list it.

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
renderer then honors that layout rather than discovering it. The consequence
is that a problem cell has a **declared** size, not a measured one — which is
a real constraint on the design of each family, and the right one.

A page that comes up short — fewer problems than were asked for, because the
draw could make no more, or because not even one row fits at this type size —
says so on the paper, in the instruction line (`shortfall` in `chrome.ts`),
rather than printing a title, a score box and a silence. The family then lays
the page out again under that header: a longer instruction line can take a row
from the problems it is about, and a page laid out for the shorter line would
run over. The paper having no room is not on that list, because a count is
never cut to the page: what does not fit runs on.

---

### More than a page

A family whose content outruns the page neither trims it to fit nor shrinks it.
It emits a `break` block where its own arithmetic says the page is full, and
`SheetView` prints what follows as the next page, with the header and footer
again and "Page 2 of 3" in the foot — so a child set the whole of a psalm gets
the whole of it, and a parent who wanted one page prints page one. Capacity is
still arithmetic: the family cuts at `perPage`, never by measuring, through
`paged` in `layout.ts` — and every family that takes a count runs on this way.
The problems families go through `problemPages`, which numbers page two on
from where page one stopped, so twenty long divisions at nine to a page are
three pages and a child told to do 14 to 20 finds them. The other numbered
lists — sentences with gaps, multiple choice and word shapes — carry the same
`start`, and a matching set or a page of cards is cut the same way, each page
its own. Handwriting cuts its rows the same way. The one shortfall the paper
still causes is a single row taller than the page, which no number of pages
would mend: then nothing is drawn and the instruction line says so. Memory
work still fits its rounds to the page it has.

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

The named size is always the writing space, top line to baseline. Room for a
tail is **added under it**, half as much again, rather than carved out of it:
⅜ paper with descenders on still has ⅜ of an inch between its top line and its
baseline, and holds a third fewer sets to the page. Carving the tail out kept
the page count and shrank the letters, which is the wrong one of the two to
give up — the size on the label is the one thing a parent chose.

Any lined ruling can also be written at a size of the parent's own, `Rule.pitch`
in mil, which the builder offers as a letter size in points. The preset names
stay; stepping the size keeps the ruling's midline and tail, and the one-line
description says so — `handwriting ⅝" — 36pt letters` — because a saved sheet
called ⅝ paper with nothing ⅝ of an inch on it is a label that lies.

The margin line on wide and college is not decoration either: it is what makes
a page read as notebook paper rather than as lined paper.

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
| Dim / gray | `fill: currentColor; opacity: .28` — tune per font weight        |
| Hollow     | `fill: none; stroke: currentColor; stroke-width: .5pt`           |
| **Dotted** | as hollow, plus `stroke-dasharray: 0.5 3; stroke-linecap: round` |
| Dashed     | as hollow, plus `stroke-dasharray: 4 3`                          |

One font, five appearances, no licensing, and the dash pitch is a slider.

Start dots and directional arrows are the one thing this _can't_ derive — those
need per-glyph authored data (where the pen starts, which way it goes). That is
real work for a real payoff and belongs in a later phase. Note that stroke
order differs between teaching models, so it is per-font data, not per-letter.
§25 is that later phase: a hand stores the strokes themselves, and the dot and
the arrow fall out of the drawing.

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
- **Print / manuscript** — needs a single-story `a` and `g`. **ABeeZee** (OFL,
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

On an outline row, which letters join is read out of the font and never
written down here: a cell is one `<text>` element, so the face's own
contextual alternates see the pair either side of every join and draw the form
that belongs there. (A row written in a hand joins by the hand's own drawings
instead — §25.) That is what
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

Dropping the loops is also what makes the unlooped American model the one
cursive whose descender fits the room a ⅝ rule gives it: its ascenders run
0.06 em under the looped hand's and its tail is shallower in proportion.

### The measurements behind the five faces

`src/engine/sheets/faces.ts` is where each face's proportions are written down,
and the file itself says where each number came from and what a test holds it
to. What is here is the working behind them: what each number is a judgment
about, and the obvious alternative two of those judgments turned down.

**Capitals.** `capHeight` is taken from the flat-topped capitals (`E H I L T`).
The round ones (`C G O Q S`) sit a little above that in the two text faces —
Andika by 0.012 em, OpenDyslexic by 0.013 — which is the optical overshoot they
would show against a cap line in any book. The three cursive models do not: in
the unlooped and British hands every round capital is drawn flush, which is what
a face drawn to a ruling rather than to a paragraph looks like. In the looped
hand `C G O Q` are flush too, and it is `S`, `V` and `W` that stand well above —
`S` by 0.071 em, `V` and `W` by 0.034 — which is letterform rather than
correction. On the ¾ rule the capitals sheet uses, those print 0.036in and
0.017in above the top rule — nine times the four thousandths of an inch
`faces.ts` calls a tolerance elsewhere, and still the right way round. **Sizing
the em off `S`** instead would drop the other twenty-three capitals that same
0.036in _below_ the line the page says every capital starts on.

**Tails.** Against the tail space a handwriting ruling gives them, four of the
five have room to spare: Andika takes 0.239 of the 0.396 it is allowed and
OpenDyslexic 0.261 of 0.425, and the two unlooped cursive models clear it as
well at 0.457 of 0.478 and 0.394 of 0.447. Only the looped hand hangs over, and
by 0.009 of the em.

**Widths.** `capAdvance` is a second mean, taken over the alphabet as pairs
rather than over `a`–`z`, and two things about how it is taken are decisions
rather than convenience. It is _a pair, not a capital_, because on these sheets
a capital never stands alone in a cell — it heads a pair, a word or a sentence,
and what has to fit is the pair. And it is _ink, not advance_, because a cell is
a box the letters sit inside and the side bearings either side cost nothing: the
neighbor's bearing is there to meet them. Andika's comes out a sixth over its
small-letter mean, which the air a handwriting row already reserves absorbs; the
looped hand's is a third over, and it does not.

**Stems.** The outline weights are tuned against each face's own stem,
scanlined at half the x-height across `lnioe`: Andika 0.090 em, the three
cursive models 0.088, 0.086 and 0.086, OpenDyslexic 0.099 em — which makes the
shipped weights 24%, 18% and 26% of their stem. Those three ratios differ far
more than the stems they are taken against do, for reasons `faces.ts` states
beside them.

**Numerals in a square.** A grid sets its text at half the square's height, and
on a hundred chart or a multiplication square that fits only in Andika: three
characters is the widest thing either puts in a square, and only Andika's
numerals clear the shared size at that width — 400 mil against a shared 375 on
the hundred chart's ¾in square, 307 against 288 on the 13×13. The other four
faces are wider per numeral (a digit measures at the wider of `advance` and
`capAdvance`), so they are set smaller, which is the answer rather than a miss:
three OpenDyslexic numerals at half the square measure 0.89in across a 0.75in
square. Every catalog page is set in the print face, so all of them print at
the shared size.

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

**The key is never a second build.** Every answer is worked out at the moment
its problem is built and travels on the problem, so `spec.key(sheet)` switches
`answers` on, says so in the footer, and does nothing else — and on the families
that have nothing to reveal, a key is the sheet itself, unchanged. It prints
what is already there rather than computing the same answer a second time and
risking a different one — which is what makes "reduced when it was drawn", "converted in
whole units" and "built around the number that solves it" true of the key as
well as of the page. Where an answer is a drawing rather than a number the same
rule holds through the renderer: a time sheet's key is the same faces with their
hands put on, drawn from `sheet.answers`.

**A key prints only the pages that differ.** A lesson (§23) whose first page
is the lesson alone — the notes, the picture, worked examples that print
their answers on the sheet itself — would print that page again, identically,
in its key, and a two-page lesson would come out of the printer as four pages
with the third the same as the first. So `LESSON_SHEET.key` is still the same
build with `answers` switched on, and it then drops the leading pages on which
nothing changes: pages whose every block either has no answer to reveal or is
a worked example. The page numbers in the foot are counted from what is left,
so a one-page key says 1 of 1. A key on which no page differs — a lesson
printed without its problems — is the sheet itself, as it is on every family
with nothing to reveal. The contract (§20) allows exactly this and no more: a
key may be its sheet with whole leading pages removed, and only pages that
would print the same either way.

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
neighboring sheets. Where it's a math topic, it also links to the matching
`/multiplication/N-times-table` page and to the game — the internal-linking win
is significant and free.

Bound the programmatic set. Twelve times-table pages work because there are
twelve of them and each has a real tip on it. Five thousand permutations of
grade × operation × difficulty is a doorway-page farm, and the `noindex`
reasoning in `Base.astro` shows this codebase already knows why that's a
liability. Curate the slugs; generate the sheets.

**What shipped (PRINT28), and the one decision inside it.** Ten year pages,
Pre-K through 8th, over the ten subject hubs that were already there. The
decision that made them possible without inventing anything: **a grade is read
off the sheets, never written onto them.** Every catalog entry already stated
the ages it was drawn for — `Ages 8–11` on the division worksheet — so a year
page is the sheets whose stated band reaches the two ages a child is in that
year, and `_grades.ts` is a parser and an overlap test rather than a second
table of judgments to keep true. A sheet therefore appears on two or three of
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
ten subject hubs and ten school years. The hub itself is unchanged HTML, so a
crawler and a visitor with no JavaScript get the whole catalog and no dead
search box. `scripts/search-index-guard.mjs` fails the build if a row points at
a page `dist/` doesn't have, or if a page `dist/` has is reachable from
neither the index nor a hub.

Two things about that island are worth recording, because both are decisions
rather than defaults. A **third-party search box was never an option**: it
would send the page a child is looking at to somebody else's server, which is
the one thing this site does not do, so the index is built here and the
matching runs in the browser that downloaded it. And the island is
`client:only` rather than server-rendered, which is what makes the sentence
above true — everything the search can show, `/printables` already shows, so a
visitor with no JavaScript gets a complete catalog with no sign that anything
is missing, where a search box rendered into the HTML would be a control that
looks live, takes a keystroke and does nothing.

The type facet and the shelves cross, but three of the shelves line up with one
type exactly, because they were always defined by the kind of page rather than
by a subject: charts are references, paper is paper, and templates are forms
right through.

### One stock or two, which decides how many routes a sheet gets

**Is the paper itself a stated measurement?** That is the whole question, and
it is answered once per shelf rather than once per sheet.

Where it is, the shelf prints on both stocks and each stock is a route of its
own. A ⅝ handwriting rule sent to a printer loaded with A4 is scaled to fit,
and a scaled ⅝ rule is not a ⅝ rule; `@page` is a document rule, so Letter and
A4 cannot share a page. That covers paper, handwriting, cursive and Scripture,
which print at `<slug>` and `<slug>/a4`.

Where it is not, the shelf is one route and the A4 switch is a control in the
builder. Nothing on a math, spelling, grammar, phonics or chart sheet is a
measurement — a printer that shrinks the page by four per cent gives a slightly
smaller sum and the same right answer, and a hundred chart four per cent
smaller still has a hundred squares in it. The templates shelf reaches the same
answer by another road: a card's size is worked out from the paper it is cut
out of rather than declared on it, so a page of them on A4 is a correct page of
slightly different cards, and what the prose quotes is what US Letter gives.

Two consequences, both load-bearing:

- **It decides the shape of the route file.** A two-stock page is two path
  segments, so it needs a rest parameter — `[...slug].astro` — where a
  one-stock shelf needs only `[slug].astro`. Both shapes sit side by side at
  the top of `/printables`, paper's and math', and what keeps that legal is
  that no slug is ever emitted by both. A shelf's own suite is where that is
  checked, because Astro will not complain: it simply picks one.
- **A shelf answers for all of its pages.** The memory sheets on the Scripture
  shelf have no ruling to distort and could have lived on one stock, as the
  math sheets do. They come on both anyway: a shelf where some pages have an
  A4 twin and some don't is a shelf a parent has to check.

Graph paper is the case that proves the split rather than breaking it — its
squares _are_ a measurement, and it sits on the paper shelf, which prints both.
The charts shelf links to it instead of rebuilding it.

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

**The card links the builder too, and so does everything else.** `href` is
the catalog and `island` is the builder, and a card that offered only the
front door would hide the half of the world a parent comes back for.
`WorldInfo.build` is the label the map and the footer offer `island` under, in
the slot a guide link takes on the jungle's card, and only The Print Shop sets
it. The home page's hero makes the builder its first action for the same
reason — paper is what most people arrive for, and the builder is where a
sheet that is nearly right becomes the right one — and gives it a band of its
own under the catalog's. The Print Shop's front door carries the same button
in its hero, and every catalog page links the builder preloaded with its own
sheet (§8).

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
- **Say what to do.** The Print button's neighboring hint reads "Print, or
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

Two rules hold across every one of them, and both exist because the failure
they guard is a wrong answer key that prints looking right.

**No math sheet's numbers are floats.** Fractions, decimals and money share
one hazard the times tables never had: `7 × 8` is 56 in any arithmetic anybody
has ever implemented, but `0.1 + 0.2` is 0.30000000000000004 in the one every
JavaScript program is written in, and `4/8` is a correct answer written the
wrong way. Both failures print. So `engine/sheets/maths/exact.ts` holds the two
shapes those families count in and nothing else counts in either: a **fraction**
is a pair of whole numbers whose reduction is a division by their greatest
common divisor, exact by construction; a **fixed-point** number is a whole
number of thousandths, hundredths or tenths, and the point is written in at the
last moment by the one function that knows where it goes — £3.45 is 345 pence
everywhere else, and the only division anywhere near it is by ten. That module
knows nothing about sheets, which is what stops a second answer to "how do I
write 5/4 as a mixed number" growing inside a family.

**Problems are drawn and rejected, never enumerated.** The obvious generator
lists every pair in the range, shuffles it and takes twenty. It is exact, and
it allocates a million pairs for a sheet of three-digit sums — at build time,
on every catalog page, three times over for the variants. So a problem is
drawn, checked against what the config asked for, and rejected if it fails or
repeats, with one shared budget of rejections in a row after which the draw
accepts it has run out and prints what it has. That is the honest answer to
"twenty different sums from 1 to 3": there are six, and six is what a parent
should get rather than the same sum three times.

**Math.** Counting and numeral tracing 0–20 · ten frames · number bonds ·
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

**Penmanship** (§24). Pre-writing strokes and warm-up patterns, drawn rather
than set in a font · letter families · tall, small and tail · finger spaces ·
circle your best one · the alphabet against the clock.

**Words.** Spelling: write it three times, ABC order, missing letters, word
shapes, unscramble, word search, crossword, use it in a sentence · sight-word
sheets from the existing Dolch lists **and from a parent's own saved deck** ·
rhyming · syllables · word families · prefixes and suffixes · plurals ·
contractions · homophones · synonyms and antonyms.

**Grammar.** Parts of speech · subject and predicate · sentence types ·
punctuation · capitalization. Not generated from a rule but drawn from a tagged
sentence bank — authored content, small and reusable, because grammar is a
judgment rather than a calculation.

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
letterforms would be one too many.

**What shipped (PRINT21).** The two puzzles, and one rule holds both of them
up. Every other sheet in the shop is marked by doing what it asks — the sums,
the spellings, the conversions — and a word search is marked by hunting twelve
words through a grid, which nobody does. A word that quietly failed to place
therefore looks exactly like one that placed well, and the sheet goes out asking
a child to find something that is not there. So neither generator is allowed to
be its own witness: **what the finished paper says is what the sheet claims**,
and anything the paper does not contain is printed under the puzzle by name
instead of disappearing. `words/search.ts` and `words/crossword.ts` are each
written in two halves that barely speak — a placer that keeps no record, and a
reader that goes back over the squares — and every list, key and omission line
comes out of the second half. Neither retries; the bounds are stated where they
are set.

The crossword's own hazard is which word goes down first, and it is severe:
COULD shares not one letter with AFTER, AGAIN or EVERY, so the same sight-word
list places three of twelve anchored on COULD and nine anchored on AFTER. That
is the shape of English rather than a flaw in the placer, so the answer is a
handful of whole layouts kept side by side and the fullest one printed — a
second opinion rather than a cleverer algorithm.

Clues were reused rather than written, as PRINT20 reused the distractors. Every
shipped sight-word list already gives each word a short sentence with the word
taken out of it — written for the race, where it is what makes a homophone
answerable at all — and a crossword clue is exactly that shape, so a crossword
set on "First words" is clued in sentences somebody wrote for a five-year-old. A
word this build has never met falls back to the one clue that can be written for
any word at all: its own letters, out of order.

**What shipped (PRINT22).** Grammar: one family, five topics, one bank. The
bank is the story. Spelling is authored because **English will not yield to a
rule**; grammar is authored because **grammar is a judgment** — whether a word
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
class is the same judgment with a worse layout; there is no comma topic and no
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
observation journals · timelines · calendars and planners · chore and behavior
charts · award certificates · name tags and bookmarks · blank flashcards with
cut lines · dice and spinner nets · memory-verse cards and a verse-of-the-week
chart.

**What shipped (PRINT26): the blank math references.** `templates/charts.ts` —
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

One thing every family on this shelf does that none of them needs to: it lays
its page out against a footer carrying the note a key prints, whether or not it
has anything to reveal. A key keeps its sheet's blocks and is laid out against
the same box, so a footer that wraps to two rows on the key and one on the
sheet is a key whose last row prints on a second page — and on this shelf
`SheetSpec.key` stamps "Answer key" onto any sheet it is handed, including the
blank forms, because a parent may press the button on a coordinate grid and
what they should get is the same paper with a word in the footer. Reserving
unconditionally costs one footer row on the sheets that withhold nothing, and
only at the type sizes where that row wraps at all; at every size a catalog
page prints, it costs nothing. That is the cheap side to be wrong on: a row
over-reserved is a rule line, and a row under-reserved is a second sheet of
paper.

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

**Where it doesn't go: the math sheets.** Not for positioning reasons — as a
craft judgment. A verse reference bolted to a long-division problem serves
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

Memory work is the second family, and it is the one §12's license condition
actually bites on: rounds of the same passage with a growing share of the words
gone, chosen by the seed, nesting so nothing comes back. The instruction line
says the words are left out for the exercise and the key prints the passage
whole — both halves, in the engine, so neither is a page's decision to forget.
The shelf is `/printables/bible`, a peer of `/printables/math` and
`/printables/handwriting`; the math sheets stay clear of it, as above.

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
a scheduling call: a word list is a list of definitions a child memorizes, and
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

Both are read through `passage()` rather than inlined, which puts the license
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
the table — there is nowhere in the code for a program's own spelling of a
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

**Which accent the table describes, and why it is written down.** A phoneme
table always describes _somebody's_ speech, and one that quietly described only
one variety would tell half the children using this site that a sound is
different from another sound they say identically. So `phonics/sounds.ts`
states its scope: **the contrasts shared by General American and standard
southern British.** A shared table is possible because the two agree about far
more than they disagree about — all twenty-four consonants, and the vowel of
nearly every word in the bank. Where they genuinely differ the divergence is
named on the phoneme rather than resolved by picking a side: `cot`/`caught` and
`father`/`bother` are two sounds in one variety and one in the other; rhoticity
changes the vowel of `car` and `her` and changes nothing about the letters,
which is what the table is for; and a minority of speakers keep `wh` as a sound
of its own.

Where there is no honest answer the word is left out of the bank rather than
guarded against later — the `bath` set (`grass`, `ask`, `after`, `class`),
`with`, the `new`/`tune`/`duke` set where England says a `y` that America
drops, and `was` and `water`, whose vowel after a `w` differs in both places.
`few`, `cube`, `want` and `wash`, which agree, are in. Words whose vowel differs
while its _identity_ does not are fine and are in, because both varieties agree
about which words share a vowel.

None of the seven sheets filters on accent, and that is a decision rather than
an oversight: every style that prints a word asks about its **spelling** —
which spellings it is made of, which spelling is in it, how it is written down
when it is read out — and a spelling is the same on both sides of the Atlantic.
A sheet asking whether `cot` and `caught` sound alike would mark half the
children who saw it wrong, so there isn't one.

---

## 14 · The builder, and the three bootstraps

`/printables/make`, a `client:only` island, decomposed from the start because
of the 300-line cap — which is the right pressure for a screen like this.

```
src/games/printshop/
  App.tsx            mount, and what goes where
  useBuilder.ts      the config, the seed, and the URL they live in
  defaults.ts        what the bench opens on, per family
  shelves.ts         the chooser's shelves, and what each family's tab is called
  Rail.tsx           the rail's numbered steps, each with the line that says what is set
  summary.ts         those lines, for the paper, the lettering and the heading
  Chooser.tsx        choose a family (the catalog, in-app), and the three doors
  PageOptions.tsx    the options every sheet has, in three sections
  Preview.tsx        the sheet, scaled, on the press-room ground
  PrintBar.tsx       another draw · the link · copies · answer key · print
  Caption.tsx        under the paper: the seed, and where a file comes from
  SavedSheets.tsx    My Sheets, through services/sheets.ts
  Bootstrap.tsx      the three doors — what they missed, a saved list, a paste
  Missed.tsx         practice what they missed, through services/practice.ts
  options/index.tsx  the registry — the one place `kind` is narrowed
  options/parts.tsx  choice · range · sizing · pool · word list
  options/*.tsx      one panel per family
```

**One rail, one tray, and the steps are numbered.** The options first stood
in a column beside the paper, and the column grew to five screens: a parent
tuning a sheet scrolled up and down it looking for the one control they meant,
and a landscape sheet had half the width it needed. Now everything that changes
the paper runs across the top in one rail, as numbered steps in the order a
stranger needs them — the sheet type, what is on it, the paper, the lettering,
the heading — and a step opens its section in a tray under the rail, laid out
in columns so the whole section is on screen at once. The row above the steps
is what leaves the bench as paper: another draw, the link, copies, the answer
key and Print. The rail sticks under the masthead, and the paper takes the full
width below.

Three things make it a way through rather than a set of tabs, and each is a
finding rather than a taste. A closed step shows the choices made in it as one
line (`summary.ts`), because a step that showed only its name would have to be
opened to be checked — the fault Baymard's checkout testing found in every
accordion that collapsed to a heading. Every tray ends in "Next: Paper →", a
descriptive next rather than a bare one, so a parent who only ever presses it
walks the order and ends at Print, while any step can be opened at any time —
Material's non-linear stepper, and GOV.UK's "allow users to complete tasks in
any order". And a stranger opens on step one, with one line saying to start
there; a sheet that arrived by link or out of My sheets has its kind chosen
already and lands on its own options instead. There is no tour, because
NN/g's testing found people who read one were no more successful and rated
the task harder, and no ticks, because every step holds a good value from the
first second and a tick on all five would say nothing.

The family's own step is called what the family holds — problems, letters,
words, a ruling — because the one heading that had to be true of every family
("what is on it") read as the site talking to itself. `shelves.ts` holds those
names beside the five shelves the chooser groups the families on, cut coarser
than the catalog's because five is what fits across a chooser. The bootstraps
below are the chooser's lower half rather than a section of their own: "start
from" asked a question the bench had already answered, since it opens on a
finished sheet.

Built as it stands, with two names moved from this sketch: the per-family panel
is `options/*.tsx` alone (there is no `Editor` wrapping it), and what was going
to be `Editor.tsx` turned out to be `PageOptions.tsx` — the options that belong
to no family. The reading half of `#s=` lives in `engine/sheets/share.ts` beside
the encoder rather than in the builder, because the two are one format.

**The bench opens on a finished sheet, never on an empty form.** `defaults.ts`
holds one config per family and each is a worksheet somebody would print
unchanged, so switching family produces paper before a single option has been
touched — the bargain a catalog page strikes, reached from inside the builder.
Where a family has several styles the default is the one a parent recognizes
across the room and would name if asked: the reading log among the nine forms,
blank flashcards among the five cards, the word search among the three puzzles,
blending among the seven phonics sheets, parts of speech among the five grammar
topics, rhyming among the ten word-study topics. Everything else on each shelf
is one control away, and each of those controls lists its options in the order a
week or a school year uses them rather than alphabetically. The two families
whose content is a list — spelling and puzzles — open on the same shipped
sight-word slice, so moving between the shelves keeps the words a parent is
already looking at on screen.

Those judgments live in the view rather than in the engine, deliberately. A
family's `SheetSpec` states what it _can_ build; "twenty-four sums with both
numbers under twenty" is an editorial judgment about children, of a piece with
the catalog copy, and `deckSpec` draws the same line for the races.

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

1. **Practice what they missed.** Read the trouble facts the record book
   already computes and print a sheet of exactly those. **No other worksheet
   site can do this**, because no other worksheet site knows what the child got
   wrong. It is the reason this section exists at all rather than being one
   more printables site, and the phase order below is arranged to reach it as
   early as possible.
2. **From a saved word list.** Every `CustomDeck` a parent already typed in
   becomes six sheet styles instantly. Nearly free: the data is already there.
3. **From pasted text.** `parseWords` already handles whatever a school letter
   looks like. Paste a spelling list, a verse, a passage — get a sheet.

### Where "practice what they missed" is entered from

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

- **Practice what they missed** (§14) — the highest-value feature in this
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
is arranged to reach "practice what they missed" by phase 2.

**Phase 0 · The press.** `engine/sheets` spine, `paper.ts`, `layout.ts`, block
renderers, `sheet.css`, `print.css`, the `paper` world and its map card, and
**one family end-to-end: lined paper.** Every ruling in §5, printable,
prerendered at `/printables/lined-paper`. It is the smallest thing that proves
the geometry, and "printable wide ruled paper" is a top-tier query in its own
right. Plus the hub at `/printables` and the sitemap assertion from §8.

**Phase 1 · Math.** The arithmetic families with the full option set, answer
keys, seeds and variants. Curated catalog pages per operation, cross-linked to
the twelve times-table pages. This is the traffic phase.

**Phase 2 · The builder, and practice what they missed.** `/printables/make`,
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

| Question                    | Decided                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL shape                   | `/printables`, with worksheet-shaped slugs beneath it. One-way door.                                                                                                        |
| Print or PDF                | Print only. "Save as PDF" in the dialog is the download path.                                                                                                               |
| Scripture placement         | Woven through — a peer subject, not a separate section.                                                                                                                     |
| Translation                 | WEB Updated (LORD/GOD, American spelling). KJV as an option.                                                                                                                |
| Credit                      | Constant in the engine, on every sheet and catalog page that uses it.                                                                                                       |
| Map card                    | Yes, with copy that's honest about it being a parent's screen.                                                                                                              |
| Scripture on the front door | Yes, where it's content — footer, the day-rhythm band, `/about`. Never in a title, description or `jsonLd`. Not marketed.                                                   |
| Descender space             | Added under the writing space, half as much again — the proportion primary paper is sold at. The label names top line to baseline; the tail costs pages, never letter size. |
| Content past the page       | Runs on to the next page, header and footer again, never trimmed or shrunk. A parent who wants one page prints page one.                                                    |

Nothing open. Phase 0 is unblocked.

---

## 20 · Tests

The engine is pure, so most of this is cheap and worth having:

- **Geometry.** A ⅝-inch rule set is 0.625in from top line to baseline, at
  Letter and at A4, at every margin — and 15/16in from one top line to the
  next once a tail is under it. Off-by-one in a repeat is invisible on screen
  and obvious on paper.
- **Paging.** A sheet that outruns the page cuts at the family's own `perPage`
  and nowhere else, keeps a line's repeats on one page, and prints its header
  and footer on every page it runs to.
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
- **The island's import graph.** Nothing under `src/components/sheet/` reaches a
  sheet family or a corpus by a static import, so a helper borrowed from a
  family module fails the suite instead of quietly re-fattening the builder
  (§3).
- **The island's weight.** `scripts/bundle-guard.mjs` weighs every island's
  closure against a recorded baseline after each build — the React runtime
  budgeted separately, because every island pays for it — and fails on a step
  change in either direction. The closure and not the entry chunk, for the
  reason in §3. It is the half that catches a leak the import graph above
  can't see, because the module that grew was somewhere else.

---

## 21 · Long division on the page

The bracket is the one arithmetic form whose answer is written _above_ the
problem and whose working goes _under_ it, and both of those are set by place
value: the quotient's last digit belongs over the dividend's last digit, and
every line of working under the dividend is a number whose digits belong in
particular columns. The first version drew the bracket as two right-aligned
boxes over a blank band, and a three-digit dividend floated most of an inch to
the right of the upright, because the house had a minimum width and nothing
tied the digits to it.

**The rule now: the house is a grid of squares, and a digit is always in a
square.** One column per digit of the dividend, each `cell` wide, where `cell`
is `answerLine(fontPt)` — the line a child writes an answer on, which is also
one digit wide and one line of working tall. A gutter column on the left holds
the divisor. The rows are the quotient, the dividend, and then `rows` lines of
working, each `cell` tall, where `rows` is `divisionLines(digits)` — the
reservation `long.ts` was already making as blank paper, now spent on squares
instead. So `7)105` reads as it does in a textbook, with the digits starting
right after the upright and lightly spaced, and the quotient's digits sit
directly over the dividend's, column for column, whether or not any square is
drawn. The bracket's own height is two cells, which is what `bracketHeight`
declares and the row height is built from; a constant in ems was short at
small type, where a quarter-inch line is taller than three ems. Its width is
`bracketWidth` beside it — the divisor's squares and the dividend's, and room
for `r` and a remainder where one may be written — and both families that set
a bracket cut their columns to it, because a bracket is a fixed drawing in
squares that does not wrap to its column the way a sentence does, and a
bracket wider than its column prints over the problem beside it with nothing
to measure that before paper.

**Help under the bracket comes in four steps, and each includes the one
before it**, because they are the same scaffold being taken away a piece at a
time as a child needs less of it:

| `help`   | What is drawn                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `none`   | The bracket and blank paper under it. Absent means this.                                              |
| `grid`   | Every square gets a hairline border, the quotient boxes above the bar included. Nothing else.         |
| `steps`  | The grid, plus a minus sign in the gutter beside each take-away row and a heavier rule under it.      |
| `guided` | Steps, plus the squares that actually get written in are shaded, and the last row's gutter reads `R`. |

The grid alone fixes the commonest long-division error, which is a digit
brought down into the wrong column. The steps show the shape of the algorithm
— take away, bring down, take away — without its numbers. Guided shows _which_
squares the numbers go in, and is the sheet for the first week; a child who
can already fill the shaded squares is ready for `steps`, and one who can find
the columns unaided is ready for the plain grid.

**The working is engine data.** `maths/tableau.ts` walks the standard
algorithm exactly as it is written on paper — divide, multiply, subtract,
bring down — and returns the quotient with the column its first digit sits
over, one row per line of working with the column its last digit sits under,
and the remainder. The renderer places digits in squares from those numbers
and never divides anything, which is what keeps §7 true of the tableau as it
is of every other answer: the key writes the working that was computed when
the problem was built, and it writes it at every help level, `none` included
— the squares are there at every level and only their borders differ, and a
parent marking from the key wants the working whether or not the sheet drew
a grid for it. It is also what `steps` and `guided` are drawn from on the
blank sheet — which rows are take-away rows and how wide their rule is
depends on the numbers, even when the numbers are not printed. Rows are two
per quotient digit, and a quotient can be no longer than `into − by + 1`
digits, which is why `divisionLines` can reserve the space before any
division has been drawn.

**The shading is an SVG fill, not a background** (§5). A background is dropped
by most printers' defaults, and a guided sheet whose shading did not print is a
`steps` sheet that was promised something else. One `<svg>` sits behind the
squares, its rectangles placed from the same `cell` and gutter widths the
squares are laid out with, at a twelfth of the ink so that a digit written
over one is still black on nearly white.

## 22 · Decimals, divided

Three divisions, and they are three sheets rather than one with switches on,
because each is a different lesson: a decimal divided by a whole number
(`8.46 ÷ 3`), a whole number divided to a decimal answer (`7 ÷ 4 = 1.75`), and
a decimal divided by a decimal (`8.4 ÷ 0.2`). `DecimalConfig` names them with
`operation: "divide"`, `wholeDividend` and `by: "decimal"`, and the family
decides which it is once — dividing _by_ a decimal wins over a whole dividend
— so the draw, the layout and the title cannot disagree.

**Every one of them is built from the answer outward**, as `long.ts` builds a
long division (§11). The quotient is drawn as a `Fixed` at the places the sheet
is set at, the divisor is drawn from its span, and the dividend is their
product. Nothing is ever divided, so nothing can fail to terminate: a quotient
of 2.82 times 3 _is_ 8.46, exactly, and the answer key is the number the sheet
was made from. The alternative — draw a dividend, divide it, hope the answer
stops — either prints a rounded key or throws most of its draws away.

- **Divided by a whole number**: the plainest case, and the one the range and
  the places describe directly, because they describe the answer. A quotient
  whose last digit is a zero is thrown away: `20.50 ÷ 5 = 4.10` is `20.5 ÷ 5`
  written to two places, an exercise nobody sets, with a tableau of nothing
  rows. The dividend may still end in one — `4.15 × 2` is `8.30`, and that is
  a real exercise.
- **A whole dividend**: the divisor is drawn first and the quotient walked in
  the steps that make their product whole — every twenty-fifth hundredth for
  4, every fiftieth for 2 — for the reason the percent draw walks rather than
  rejects: a rejecting draw prints the friendliest divisors over and over. A
  divisor with no factor of ten in it, 3 or 7 or 9, has no decimal quotient
  that stops and is left out rather than rounded in: the draw takes only from
  the divisors in the span that can stop (`stoppingDivisors`), so a span that
  holds none — 3 alone, or 7 — makes nothing, the page says which divisor
  rather than that nothing could be made, and the builder grays the box. A
  whole quotient is left out because an answer past the point is the promise.
  The answer prints to the sheet's places like every answer on the family, so
  `6 ÷ 4` at two places is `1.50` — the last annexed zero divided into and
  found empty, which is part of the lesson, and the one place on the family a
  quotient may end in a zero. In columns the dividend prints with `places`
  zeros **annexed**, `7.00`, because that is the form a child keeps dividing
  into; along a line it is the whole number it is, and the instruction says
  to write the zeros in.
- **Divided by a decimal**: drawn as the whole-number division a child rewrites
  it into — `84 ÷ 2` — and then each side is given its places, the divisor one
  to `places` and the dividend at least as many, so the answer is the whole
  quotient with its point moved back by the difference. Neither side ends in a
  zero: the two sides carry different place counts by design, and `8.40 ÷ 0.2`
  is a number written the long way for no column to line up on.

**Dividing by a decimal is never set in the bracket, deliberately.** The
method is to rewrite the sum until the divisor is whole and then divide, so a
bracket round `0.2)8.4` would have to show either the question — which is not
what gets worked — or the rewritten sum `2)84`, which is not what was asked.
Either way the paper would be doing the one step the sheet exists to teach. It
is written along a line, the builder hides "In columns" for it, and the key
shows the answer only.

**The point in the bracket.** A dividend of `8.46` occupies three columns, not
four: `Problem.bracket.dividend` carries the point, the columns count digits
only, and `Bracket.tsx` draws the point as a mark on the boundary between two
squares in a box of no width, so every digit stays in the column it would have
without it. The quotient's point goes on the same boundary — which is the
whole of the method, said as geometry — and it is printed above the bar
wherever squares are drawn, because there it is part of the scaffold; a bare
bracket leaves placing it to the child, and the key writes it either way. The
working is computed on the digits alone (`decimalTableau` over `tableau.ts`,
which never sees a point), and the reservation under the dividend is the same
arithmetic as §21's, over the longest dividend the range and the divisor span
allow.

**A quotient below one is written with its leading zero**: `0.23`, never
`.23`. The tableau starts the quotient at the first column where the digits
read so far come to the divisor, which for `0.69 ÷ 3` is the tenths column,
and a key that wrote `23` there with the point beside it would be showing a
child a form nobody writes. So the family pads the quotient back to the units
column with zeros before the bracket sees it — in the family and not in
`tableau.ts`, which has no point to measure from. The zeros are written digits:
a guided sheet shades their squares, and the key writes them in.

**Five more sheets, each aimed at one wrong idea.** The family's number-sense
styles — `place`, `compare`, `order`, `round` and `powers` — have no sum in
them. Each exists because of a mistake children make reliably enough for it to
have a name, and each is built so the mistake shows up on the page rather than
slipping through:

- **`compare` and `order`** are for _longer is larger_ and its opposite.
  Steinle and Stacey's long study of Melbourne schoolchildren found two rules
  doing most of the damage: 0.45 read as more than 0.5 because 45 is more than
  5, which most children grow out of, and 0.5 read as more than 0.55 because
  tenths are bigger than hundredths, which persists into secondary school. So
  half of a comparing sheet is pairs with one whole part and different place
  counts, where the longer number is bigger only half the time; a quarter is
  the same number written to two place counts, 3.4 and 3.40; and the rest is
  two numbers at the sheet's places. An ordering set shares a whole part and
  mixes place counts, so the sorting happens after the point. A tenths sheet
  has one place count and therefore none of these pairs, which is honest
  rather than a gap. The ordering answer is the whole set rewritten, so it
  travels as a ruled line (`Problem.answers`) rather than a slot; the family
  reserves the line's height and cuts the columns to what the longest line can
  hold, because `.sheet__answer-line` clips rather than wraps.
- **`round`** is for "add one to the last digit", which is what most children
  hold rounding to be and which fails at a 9: 2.97 to the nearest tenth is 3.0,
  not 2.10. The values carry one place more than the target, so the deciding
  digit is always the last one and rounding is that digit cut off and the rest
  carried up when it was five or more — whole numbers throughout. A quarter of
  the draws are built to carry through a 9, because a free draw sets that case
  once a page or not at all. The answer keeps the target's places, 3.0 and not
  3, since the zero is what says "to the nearest tenth".
- **`place`** asks what one digit is worth, answered as a number: the 5 in
  3.75 is 0.05. The digit appears once in its number, so the question names
  one column; it is never a zero; and one time in three it sits before the
  point, since a child who assumes the answer is always small has not read the
  column.
- **`powers`** multiplies and divides by 10, 100 and 1000, and the instruction
  says _the digits move; the point stays where it is_ — the DfE and NCETM
  wording, chosen over "move the point" because it keeps a child saying what
  each digit is now worth. The two pictures are one motion seen from either
  side, and Foster (2017) makes the fair case that calling either a
  misconception is unjustified; so the sheet teaches the digits-move picture
  and never says the other is wrong. A third of the values are whole numbers,
  because 48 ÷ 1000 is the question a child who has only ever slid a point
  along a decimal cannot start. Answers stop at three places, and a division
  is drawn to fit that cap rather than drawn and rejected: dividing moves the
  digits right, so the value is drawn with fewer places to leave the answer
  room — on a thousandths sheet, ÷ 10 is asked of hundredths and ÷ 1000 of a
  whole number. Drawn at the full places and thrown away afterwards, every
  decimal division on that sheet was thrown away, and the page taught
  dividing on whole numbers only. No value ends in a zero, and the shift is
  `shifted` in `exact.ts`: the places run down to zero and then the units
  grow, so 3.7 × 100 is `370` and not `370.0`.

**And a decimal times a decimal**, which is `multiply` with `by: "decimal"`.
It stacks with the digits on the right rather than the points, because that is
the method: multiply as if there were no points, then count the places in both
numbers into the answer. `timesFixed` multiplies the units and adds the places.
Neither number ends in a zero, so the count of places in the question is the
count that is true — `3.70 × 2.4` would show three and mean two — and the
answer keeps every place the count gives, `0.90` rather than `0.9`. The
multiplier is under ten with one to `places` places, so the count varies down
the page and is a thing to do rather than a number to remember.

## 23 · Lessons — teaching a method on paper

Every other family in the shop drills: it asks for what a child can already
do, twenty times, and marks it. A lesson does the opposite. It is one idea,
explained on one page, to a child who has not met it yet and to the grown-up
sitting beside them — the idea in a child's words, a picture, the same sum
worked step by step, a few problems to try with the same picture beside each,
and one sentence for the grown-up set small at the foot. The family is
`engine/sheets/lessons/`, and three things about it are decisions rather than
defaults.

**A lesson is authored, not generated.** What to say first, which picture to
draw, which numbers to use and in what order — those are judgments, and the
grammar bank (§11) already settled how this codebase treats a judgment: write
it down once, tag it, and let the code print it. So a topic is data plus a
small builder: the title, the instruction line, the blocks in order, and the
problems to try, drawn from the seed only in the order they are dealt. Another
seed is the same six problems in another order. The one page that _is_
generated is the page a topic this build has never heard of prints — a saved
sheet outlives the table, as it does everywhere else (§3).

**Picture before symbols.** Every page follows concrete → pictorial → abstract
(Bruner's three modes, as Singapore's curriculum adopted them), and a printed
sheet can only ever be the middle step, so each page points the grown-up back
to the first — "get 12 real things out" — and puts the picture above the sign.
The Education Endowment Foundation's guidance is blunt that a representation
earns its place by showing the structure, not by decorating the sum, and names
the number line as the one with the strongest evidence behind it; so a lesson's
pictures are the three that show the structure of division and nothing else:

- **Counters** (`counters.ts`, `Counters.tsx`): dots already sorted. In rings
  for sharing — as many rings as there are children, the answer in each,
  because Squire and Bryant found children read a sharing picture grouped by
  the divisor far more easily than one grouped by the answer. Ringed along a
  row for grouping. In rows for an array. What does not divide stands outside
  every ring, which is what a remainder looks like. Never more than two dozen,
  because past that a child stops counting and starts guessing. On a
  grouping problem to try, the rings are left off and the dots spaced evenly,
  so nothing on the sheet gives away where the child's rings go.
- **Hops along a number line** (`NumberLine.jumps`): division as repeated
  subtraction, drawn — start at 12, jump back 3 at a time, count the jumps.
  The line stands `JUMP_ROOM` taller to hold the arcs and their labels, added
  rather than carved out of the plain height, because every family that
  reserves for a plain line has reserved that number.
- **A worked example** (`Problem.worked`): the answer printed on the sheet a
  child is handed, in every place an answer goes — the slot, the total under a
  stack, the quotient and the whole tableau in a bracket, the ruled lines. A
  worked problem carries no number, so the problems to try still count from
  one, and a block of nothing but worked examples keeps its declared height
  rather than taking the spare paper on the page.

**Every height is declared, and this is the family where that costs
something.** A lesson is mostly prose, and prose wraps. A note (`note` block,
`Note.tsx`) reserves its lines by counting characters across the box's width
at the face's declared advance (`fittedCharacters`) — the wider of its
small-letter and capital advances wherever the text has a capital or a
numeral, so the count comes out long before it comes out short — and the
renderer draws the box exactly that tall. An estimate a line short shows as
text over the bottom rule, which a reader can see; a box that grew to fit
would push the last block onto a second sheet, which they cannot. The page is
then cut where the sum of those heights says it is full, block by block,
never through one. The two lessons written for six-year-olds fit one Letter
page at 14pt, and the suite holds them to it; the arrays lesson does not — five
arrays with two ruled lines under each are taller than what is left under the
lesson — so its problems go on to page two whole, and the lesson is not cut to
make them fit.

At a type size where the six problems to try stand taller than a whole page,
they are cut one row to a block, each block numbered on from the last
(`Block.start`), because a row is the smallest piece the renderer prints
whole and a block taller than the page would run off the foot of it. A lone
block that cannot be cut — a paragraph, a picture, a chart, one row — gets a
page to itself and runs over the foot, which is the honest answer to paper
that cannot hold one paragraph; at 24pt and above on Letter the long-division
steps note does, and one row of arrays. Every line a lesson draws hops on
ends on the dividend with every landing on a tick (`hopLine` chooses the
spacing), so a child sent to jump back in threes from 21 is never handed a
line to 22 with no 21 on it.

**The sequence, and why each page comes where it does.** Sharing first,
because it is the model of division children arrive at school holding
(Fischbein found it the only intuitive one, and Correa, Nunes and Bryant found
five-year-olds already sharing fairly). Grouping second, with the same 12 ÷ 3,
because a child with only the sharing story is stuck the day the divisor stops
being a number of people — Roche and Clarke found three quarters of practicing
teachers could not make sense of 8 ÷ 0.5 for that reason — and because every
later method leans on it: chunking is repeated subtraction, and dividing by a
decimal is a grouping question. Arrays third, because one picture holds the
multiplication and both divisions, and "think multiplication" is the reflex
every step of a written method later depends on. Then remainders, drawn as
the counters that would not go round standing outside every ring, with the
check written as a multiplication sentence — `4 × 3 + 2 = 14` — and never as
a chain of equals signs after `3 r 2`, because `3 r 2` is not a number; and
one story on the page whose leftover pushes the answer up, since the
best-documented failure with remainders is not the division but stopping at
it. Chunking before long division, though the compact method is the one a
parent asks for by name: every line of a chunked division says what it means,
and children who reach the algorithm by way of it make fewer of the errors
that come from following steps without a reason. Long division last of the
whole-number pages, with the four words a child will meet at school each
printed beside what it means in place-value language. Then decimals, the
place-value chart first because the other two lean on it.

**The written methods draw the bracket rather than a picture.** From
remainders on, a picture of counters stops showing the structure, so the
worked example is the thing itself: a division set in the bracket at
`guided` (§21) with `worked` on, which prints the whole tableau shaded and
filled in — the same tableau the drill pages key, computed by the same code.
The `bracket` builder in `lessons/blocks.ts` reads the answer back off the
tableau, so a lesson's example cannot disagree with the key of the sheet it
teaches. Chunking is the one exception, and it is a picture again: a number
line with two hops of different sizes (`NumberLine.jumps` takes a list as
well as a size), and the column written down the page as a note — a stacked
sum's working lines are blank on the sheet and hold one number each, with no
room for "ten 12s" beside them. The chart for powers of ten is a `grid` with
`row` set, the shop's own place-value chart at four rows (§11), with the
abbreviations a classroom wall uses at its head so the type stays at the
lesson's size, and the point drawn as the heavy rule after the ones column.

The words on a page are for the child. "Partitive" and "quotative" belong
here, not on the paper.

**Sources.** The three lessons above draw on:

- Bruner, J. S. (1966). _Toward a Theory of Instruction_. Harvard University
  Press.
- Carpenter, T. P., Ansell, E., Franke, M. L., Fennema, E., & Weisbeck, L.
  (1993). Models of problem solving: a study of kindergarten children's
  problem-solving processes. _Journal for Research in Mathematics Education_,
  24(5), 428–441.
- Correa, J., Nunes, T., & Bryant, P. (1998). Young children's understanding
  of division: the relationship between division terms in a noncomputational
  task. _Journal of Educational Psychology_, 90(2), 321–329.
- Education Endowment Foundation (2022). _Improving Mathematics in Key Stages
  2 and 3: Guidance Report_, Recommendation 2.
- Fischbein, E., Deri, M., Nello, M. S., & Marino, M. S. (1985). The role of
  implicit models in solving verbal problems in multiplication and division.
  _Journal for Research in Mathematics Education_, 16(1), 3–17.
- Leong, Y. H., Ho, W. K., & Cheng, L. P. (2015). Concrete-Pictorial-Abstract:
  surveying its origins and charting its future. _The Mathematics Educator_,
  16(1), 1–18.
- Mulligan, J. T., & Mitchelmore, M. C. (1997). Young children's intuitive
  models of multiplication and division. _Journal for Research in Mathematics
  Education_, 28(3), 309–330.
- NCETM. _Structures: quotitive and partitive division_ (Primary Mastery
  Professional Development, Year 2).
- Nunes, T., & Bryant, P. (2009). _Key understandings in mathematics learning.
  Paper 3: Understanding rational numbers and intensive quantities_. Nuffield
  Foundation.
- Roche, A., & Clarke, D. (2009). Making sense of partitive and quotitive
  division: a snapshot of teachers' pedagogical content knowledge. In
  _Proceedings of the 32nd MERGA conference_ (Vol. 2). MERGA.
- Squire, S., & Bryant, P. (2002). The influence of sharing on children's
  initial concept of division. _Journal of Experimental Child Psychology_,
  81(1), 1–43.
- Common Core State Standards for Mathematics, 3.OA.A.2, 3.OA.B.6 and 3.OA.C.7;
  Department for Education (2013), _National curriculum in England: mathematics
  programmes of study_, Years 2 to 4.

The six that follow — remainders, chunking, long division, and the three
decimal lessons — draw besides on:

- Anghileri, J. (2001). Development of division strategies for Year 5 pupils
  in ten English schools. _British Educational Research Journal_, 27(1),
  85–103.
- Anghileri, J., Beishuizen, M., & van Putten, K. (2002). From informal
  strategies to structured procedures: mind the gap! _Educational Studies in
  Mathematics_, 49, 149–170.
- Bell, A., Fischbein, E., & Greer, B. (1984). Choice of operation in verbal
  arithmetic problems: the effects of number size, problem structure and
  context. _Educational Studies in Mathematics_, 15, 129–147.
- Carpenter, T. P., Lindquist, M. M., Matthews, W., & Silver, E. A. (1983).
  Results of the third NAEP mathematics assessment: secondary school.
  _Mathematics Teacher_, 76(9), 652–659.
- Common Core Standards Writing Team (2015). _Progressions for the Common Core
  State Standards in Mathematics: Number and Operations in Base Ten, K–5_.
- Department for Education (2020). _Mathematics guidance: key stages 1 and 2 —
  Year 6_, ready-to-progress criteria 6NPV–1 and the division section.
- Foster, C. (2017). Can I just move the decimal point? _Mathematics in
  School_, 46(4), 39.
- Graeber, A. O., Tirosh, D., & Glover, R. (1989). Preservice teachers'
  misconceptions in solving verbal problems in multiplication and division.
  _Journal for Research in Mathematics Education_, 20(1), 95–102.
- Guarino, J. (2018). Instructional materials matter: interpreting remainders
  in division. Illustrative Mathematics.
- NCETM. _Calculation: ×/÷ decimal fractions by whole numbers_ (Year 5) and
  _Decimal place-value knowledge, multiplication and division_ (Year 6).
- Rittle-Johnson, B., Schneider, M., & Star, J. R. (2015). Not a one-way
  street: bidirectional relations between procedural and conceptual knowledge
  of mathematics. _Educational Psychology Review_, 27(4), 587–597.
- Silver, E. A., Shapiro, L. J., & Deutsch, A. (1993). Sense making and the
  solution of division problems involving remainders. _Journal for Research
  in Mathematics Education_, 24(2), 117–135.
- Skemp, R. R. (1976). Relational understanding and instrumental
  understanding. _Mathematics Teaching_, 77, 20–26.
- Steinle, V., & Stacey, K. (2004). Persistence of decimal misconceptions and
  readiness to move to expertise. In _Proceedings of the 28th PME Conference_
  (Vol. 4, pp. 225–232).
- van Putten, C. M., van den Brom-Snijders, P. A., & Beishuizen, M. (2005).
  Progressive mathematization of long division strategies in Dutch primary
  schools. _Journal for Research in Mathematics Education_, 36(1), 44–73.
- Van de Walle, J. A., Karp, K. S., & Bay-Williams, J. M. _Elementary and
  Middle School Mathematics: Teaching Developmentally_. Pearson.
- Common Core State Standards for Mathematics, 4.OA.A.3, 4.NBT.B.6, 5.NBT.A.2,
  5.NBT.B.7, 6.NS.B.2 and 6.NS.B.3; Department for Education (2013),
  _National curriculum in England: mathematics programmes of study_, Years 4
  to 6.

---

## 24 · Penmanship — the page after the letters

The handwriting family teaches a letter: trace it, copy it, write it. A child
who can do that and still hands in a page nobody can read has a different
problem, and the shelf that answers it is `engine/sheets/writing/penmanship.ts`,
with its catalog at `/printables/penmanship`. It is a family of its own rather
than five more handwriting styles because what a parent types is different —
"pre-writing strokes", "finger spaces", "handwriting speed" — and because
what is on the paper is chosen for a different reason. Handwriting asks what a
letter looks like; penmanship asks what makes a page of them readable, and
every scheme lists the same four answers: the shape of the letters, their
size against each other, the space between words, and a consistent slant.
Three of those are styles here. The fourth is not, for a reason given below.

**Same row, shared once.** Every style writes on the trace → copy → write row
the handwriting sheets use, so the row was moved out of handwriting.ts into
`writing/rows.ts` — the progression, the packing, the cell that is empty
where the child is on their own, the paging. Not for tidiness: handwriting.ts
reaches the passage library through copywork, and every family is its own
chunk (§3), so a penmanship module that imported it to draw a row of loops
would have fetched Psalm 23 to do so.

**What the evidence says, and what each style takes from it.** Handwriting
instruction improves legibility and fluency, and improves the length and
quality of what children write (Santangelo & Graham 2016); the finding that
matters most here is that fluency is the lever. When forming a letter takes
attention there is none left for the sentence, and how automatically a child
writes the alphabet predicts how well they write a paragraph (Jones &
Christensen 1999; Graham 2010). So the shelf is built for the child whose
writing is neat only when it is slow, and each style is one thing that
evidence names:

- **Strokes** (`strokes`). The nine patterns every letter is built from — lines,
  slants, circles, zigzags, waves, humps, cups, loops and tail loops — one to
  a row, in the order a child can copy them: a vertical line at about two, a
  circle at three, a diagonal only after four (Beery & Beery 2010). Two
  things this sheet is and one it is not. It is the pre-writing page for a
  child with no letters yet, and it is the warm-up penmanship copybooks
  opened every lesson with, because a stroke drawn evenly to the end of a
  line at speed is what control at speed looks like. It is not the lesson:
  the meta-analysis found that motor practice on its own did not move
  legibility, so a strokes page is what comes before a letter page and never
  instead of one. The patterns are geometry rather than text
  (`components/sheet/strokes.ts`), which is what a pre-writing stroke has to
  be — the same in every face — and what lets a row be cut into cells that
  change from solid to dotted to nothing without the line breaking: each
  continuous pattern ends every repeat on the line it began on, so a cell
  that starts at the edge of the last one continues it in phase. The engine
  knows one thing about the geometry, which is that a tail loop drops into
  the descender space: on a ruling with no tail room it is left off rather
  than drawn through the row below (`strokePatterns`). A pattern gets
  `lines` rows, the first walking the progression and the rest the child's
  own, and the ink is a pencil line clamped at both ends rather than a glyph
  outline, because there is no fill for the stroke to be the edge of.
- **Families** (`families`). The alphabet grouped by the stroke a letter
  starts with, a family to a row, because a child who can make that one
  stroke well has every letter that starts with it, and because `b` and `d`
  are confused less when each is met beside the letters it is built like.
  The grouping is the hand's answer, not ours (`writing/letterfamilies.ts`):
  print small letters fall into the four groups most primary schemes teach —
  the letters that start like a `c`, the ones that start with a line down,
  the ones that go down, back up and over, and the four made of slants —
  while a joined hand goes by the stroke the pen enters with, and has a loop
  family print lacks and no straight slant at all. Hence five ids for four
  families a hand, and a family this hand has not got prints every family it
  has rather than a title over nothing. Cursive capitals use the print
  groups: no scheme groups them, and a capital is a capital.
- **Sizes** (`sizes`). Tall, small and tail letters, a zone to a row, then six
  words with more than one height in each (`ZONE_WORDS`), because the place
  a letter's size goes wrong is inside a word rather than on a row of one
  letter. `f` is tall: on a printed sheet it is, and its tail in a joined
  hand is the one exception a parent can see for themselves.
- **Spacing** (`spacing`). Sentences of short words, each written down the
  page as a model, a trace and an empty line, with a filled dot in the model
  where every space is — the finger a teacher puts between two words, drawn.
  Every row of the three sets its spaces a finger wide (`fingerSpace`, two
  and a half word spaces), so the model and the rows traced under it line up
  word for word, and the dot sits in the middle of the gap at half the small
  letters' height, well above a full stop on the baseline. The mark is on
  the solid model only: a child tracing a
  dotted sentence would trace it too, and a mark between every word is not
  the habit being taught. In a face with no hand the mark is a middle dot
  in place of the space, which is about as wide as a font's space, so those
  rows line up as well. The five default sentences are all eighteen
  characters or under, which is what a ⅝ rule holds on Letter paper; a
  sentence about spaces has to sit on one line, or the break at the margin
  is the widest space on the page. The wrap counts a finger space as one
  character, and a line the wider gaps make too wide shrinks to fit, model
  and trace alike.
- **Check** (`check`). A model, then the child's own tries, then a
  judgment: "circle the one that looks most like the model". Self-evaluation
  is the step that turns repetition into practice — it was in the lessons
  that moved first-graders' handwriting and their composition with it
  (Graham, Harris & Fink 2000), and writing from a studied model rather than
  over one is the condition that transferred best in the treatment study
  before it (Berninger et al. 1997). So this style ignores the trace setting:
  the tries are never dotted, never fewer than one, and the instruction
  counts them.
- **Fluency** (`fluency`). The alphabet in order from memory against a timer,
  which is the task the research measures handwriting automaticity with
  (Berninger, Mizokawa & Bragg 1991), or a sentence copied over and over.
  The model once at the top, empty ruling to the foot, and a box for the
  count. One page and never more, which is the one place this shelf departs
  from §4's rule that content runs on: the page _is_ the task, "as many as
  you can" is measured against the paper in front of the child, and a second
  sheet would be a second go. The count box is a `note` the layout took off
  the height before it counted rows, so the last row and the box cannot both
  claim the same inch.

**Why there is no slant.** The fourth key is a consistent slant, and
copybooks rule slant guides for it. The guides would have to match the model
above them, and the five faces here all declare an italic angle of zero in
their own `post` tables — which for the three cursive models is metadata
rather than measurement, since the looped hand visibly leans. Guides at a
guessed angle under a model drawn at another would teach the wrong one, so
there are none until the lean is measured off the outlines the way the
heights in `faces.ts` were. Until then the hub says the models are upright,
which is true of the print face and honest about the rest.

**The catalog.** Eight pages in three groups — pencil control, shape and
size, the whole line — on both stocks, because the ruling is a measurement
(§8). The slugs are the queries: pre-writing strokes, a handwriting warm-up,
cursive loops and ovals, letter families, tall small and tail, finger spaces,
circle your best letter, handwriting speed. The hub quotes the nine patterns
from `STROKE_PATTERNS` the way the cursive hub quotes the joins, so a pattern
added to the table is on the page.

**Sources.**

- Beery, K. E., & Beery, N. A. (2010). _The Beery-Buktenica Developmental
  Test of Visual-Motor Integration_ (6th ed.). Pearson.
- Berninger, V. W., Mizokawa, D. T., & Bragg, R. (1991). Theory-based
  diagnosis and remediation of writing disabilities. _Journal of School
  Psychology_, 29(1), 57–79.
- Berninger, V. W., Vaughan, K. B., Abbott, R. D., Abbott, S. P., Rogan,
  L. W., Brooks, A., Reed, E., & Graham, S. (1997). Treatment of handwriting
  problems in beginning writers: transfer from handwriting to composition.
  _Journal of Educational Psychology_, 89(4), 652–666.
- Feder, K. P., & Majnemer, A. (2007). Handwriting development, competency,
  and intervention. _Developmental Medicine & Child Neurology_, 49(4),
  312–317.
- Graham, S. (2010). Want to improve children's writing? Don't neglect their
  handwriting. _American Educator_, 33(4), 20–27, 40.
- Graham, S., Harris, K. R., & Fink, B. (2000). Is handwriting causally
  related to learning to write? Treatment of handwriting problems in
  beginning writers. _Journal of Educational Psychology_, 92(4), 620–633.
- Jones, D., & Christensen, C. A. (1999). Relationship between automaticity
  in handwriting and students' ability to generate written text. _Journal of
  Educational Psychology_, 91(1), 44–49.
- Santangelo, T., & Graham, S. (2016). A comprehensive meta-analysis of
  handwriting instruction. _Educational Psychology Review_, 28(2), 225–265.

---

## 25 · Hands — letters as strokes, not outlines

§6 gets five appearances out of one ordinary font by stroking the glyph
instead of filling it, and it says in its own second paragraph what that
cannot do: a dash pattern on stroked text runs **along the outline**, so a
dotted stem is two dotted lines a stem apart, and a start dot or an arrow
needs data no font carries. That was the right trade in PRINT15. It stops
being one the moment the sheet is judged against what a tracing worksheet
actually looks like — one thin broken line down the middle of every stroke —
because no amount of tuning the outline weight gets there. The outline is
the wrong shape.

A **hand** is the other shape: each letter stored as the strokes a pen makes,
open paths in writing order, in units of the hand's own em. The renderer
strokes them, so the same drawing is the solid model at one weight, the thin
`hollow` line at half of it, and the dotted or dashed trace with a dash array
— exactly as the stroke patterns of §24 already are, because a letter _is_
two or three of those patterns joined. What the drawing knows that an outline
never did is where the pen goes down and which way it sets off: the first
point of the first stroke is the start dot, the tangent a little way along is
the arrow, and the index is the stroke number. §6 called those "a later
phase". They are the free half of this one.

### Why not a font

Every font format a browser draws is closed outlines. The single-line fonts
that exist for plotters and engravers say so on their own pages: browsers
cannot render them, and the closed-outline builds they ship for the web are
the outline problem again. The one way a font can print a thin dashed
letter is to bake each dash in as its own tiny contour — a font per style per
hand, twelve files for the site as it stands, the dash pitch frozen into the
em, and still no start dot. A hand is one drawing per letter and every style
from it, and if a real font is ever wanted (a heading set in the hand, say),
it is a script over the same data: stroke-expand the paths into outlines.
That direction is cheap. The other one, outlines back to centerlines, is
the thing this section exists to avoid doing by hand twice.

### What a hand is

`src/engine/sheets/hands/hand.ts` states the shape and `hands/print.ts` is
the first one. Three numbers set the geometry and they are chosen, not
measured: the tallest letter reaches `ascent` (1000), a small letter reaches
`xHeight` (500) and a tail reaches `descent` (−500). That is a ruling, not a
paragraph — the handwriting rule puts its midline at exactly half the
writing space and its tail space at half again (§5) — so when a row sets
`ascent` on the top line, the midline and the tail line land exactly too.
§6 spends a paragraph on the overshoot every outline face shows against the
midline; a hand drawn to the ruling has none.

One thing is not set exactly on the line, and that is the ink. A stroke
centered on a line lies half on it, and a bar along the top line or the
baseline — the top and bottom of an `E` — disappears into it. So the row
sets a letter with its ink just inside the lines it reaches: a stroke on
the top line, the baseline or the line under the tail space is centered a
rule's half-width and an ink's half-width off it, so the two touch and
neither covers the other. The writing space is that much shorter for the
letter; the tail space is not, so a tail keeps its length and bumps the line
below; and the midline, which is dashed, is left where it is, so a crossbar
sits on it.

Every glyph carries an `advance` and its `strokes`, and each stroke is
absolute path data in `M`, `L`, `C` and `Q` and nothing else. Four commands
is a reader a test can cover whole (`glyphs.test.ts`), and it is the ingest's
job to get there from whatever a drawing tool saved. A letter of a hand that
joins carries a `join` as well — which ends of its joining stroke a join
replaces — and that is the whole of what joining adds to the data (see
_Joins_ below).

### Forms — a letter taught two ways

Some letters have no one shape. An `a` has one story or two, and a `t` or
a `q` ends in a curve or goes straight to the line; a `y`, an `l` and an
`i` split the same way on their feet. Schemes differ on each, and
a parent choosing a sheet has a scheme in mind — the one their child's
school uses — so a hand that drew only one of each would be right for half
its readers.

So a glyph is the hand's own drawing of a letter and, where the hand draws
it another way, the others by **form**: `a` as drawn, with `double` beside
it. The forms are a fixed vocabulary of single words — `single`, `double`,
`curved`, `straight` — shared by every hand, so that a sheet asking for a
straight `t` asks the same thing of the print hand and of a cursive one.
A sheet says what it wants with a `Forms` choice, one form per letter, and
the row writes every cell in it; a letter without a choice, or asked for a
form it has no drawing of, is the letter as drawn. That fallback is what
lets a choice be saved into a sheet: the hand may grow or rename a form
later, and the sheet still prints.

Which form is a hand's own is a judgment written into `hand.json`, first
in the letter's list. The print hand's are the ones a child is taught
first: a single-story `a`, a `t`, a `q` and a `y` with the curve, and a
plain `l` and `i`; the other of each is drawn beside it. The specimen
writes every letter in every form it has, and the words a second time with
every letter switched to its other form, which is the guide layout's stress
test on shapes the first row never shows.

A row of a hand is `WrittenRow` (`src/components/sheet/Written.tsx`), the
third row a sheet writes on beside `TracedRow` and `StrokedRow`: same width,
same one-repeat height, same `Ruling` under it, the same six styles with the
same meaning. `glyphs.ts` beside it moves a stroke from hand units onto the
paper in mil — the only change of coordinates — and walks a curve for the
arrow.

### The guides on a model

A model cell carries three marks per stroke: a dot where the pen goes down,
an arrow for the way it sets off, and the stroke's number. `guides.ts` lays
them out; it takes placed paths in mil and returns positions, so the layout
is tested without rendering.

The arrow runs _beside_ the stroke, a gap off it, following its shape for
about a quarter of the writing space — or the whole of a stroke shorter than
that, so a crossbar gets one arrow along all of it rather than a stub — with
a small filled head and a shaft that stops where the head begins. An arrow drawn on the stroke was tried
first and rejected: a head on the line it points along is one more mark on a
letter a child is trying to read, and on a bowl it looks like a bump in the
curve. Beside the stroke it is what a teacher draws next to a letter on the
board.

The number sits against the arrow's tail, near enough to read as the arrow's
own — `1 →`. The earlier layout put the number by the dot and the arrow
some way along the stroke, and on a `t`, where both strokes start in one
corner, nobody could say which number was whose.

Where the arrow runs, on which side, and which spot the number takes is
chosen by cost, because no rule survives the alphabet: a stem that a
crossbar cuts, a bowl whose start is under the next stroke's dot, a bar that
is one stroke with the arc it turns into. Every candidate — at the start of
the stroke or slid further along, full length or cut short for a corner,
either side, the number behind the tail or turned out of the way or by the
dot — is scored on what it runs into, and the cheapest wins. The unit is one
sample of ink under a mark. An arrow's two ends weigh double, because a tail
or a head against another stroke says the arrow starts or ends there; along
the shaft, ink crossed at right angles is half the price of ink run
alongside; a number is scored as its box, against ink sampled finely enough
that a curve grazing its corner is seen. With everything clear, the outside
of the letter and the start of the stroke win, so a plain stem gets the
arrow a teacher would draw. The weights are judgments, and the specimen
page is where they are checked: change one and look at every letter.

Which models carry them is the sheet's choice: `guides` on a trace block,
and on the two writing families' configs. The usual, `letters`, is a single
letter, numeral or `Aa` pair and not a word, because the marks between a
word's letters crowd the row. `all` guides every model, a parent's own words
and sentences included, and `none` leaves them all bare. The builder asks it
as one three-way choice on both panels, and only in a face with a hand — the
outline row has no strokes to mark.

A word set as a model is laid out letter by letter, each keeping off its
neighbors' ink and the earlier letters' marks, and the row tracks the
letters out into whatever spare room the cell has, never shrinking the word
to make it. In a block set to `all`, every cell gets that room — the wider
inset and the spread — whether or not it draws the marks. A sentence whose
model was tracked out and whose trace was not would put every dotted letter a
little to the left of its solid one, which on the finger-spaces sheet is the
misalignment §24 exists to avoid.

### How a hand is drawn

The drawings are the source and the data module is generated from them.

1. **`scripts/hand-template.mjs`** writes one SVG per glyph into
   `art/hands/<hand>/`: the ruling, the outline of the face the hand is
   traced over in two scales, a note, and an empty `strokes` layer to draw
   in. Everything else is locked. Two outlines because the face was drawn to
   a paragraph and the hand to a ruling: scaled so its x-height meets the
   midline, the face's `l` stops short of the top line and its `g` short of
   the tail line. So the body outline says what shape the letter is, and the
   reach outline — the same outline with only its part above the midline or
   below the baseline stretched — says how far the tall or hanging stroke
   goes. A template is never rewritten over a drawing. The outline comes
   from a UFO (`scripts/hand/glif.mjs`) or from a Glyphs package at one
   point between its masters (`scripts/hand/glyphspkg.mjs`), which is how
   Playwrite publishes: one source, and each model a choice of alternates
   at an instance. Which glyph a character is traced over is SIL's naming
   for Andika and the `tracedOver.glyphs` table in `hand.json` for a face
   that names its own — for the cursive hand that table is the record of
   which alternates make the US Trad model.
2. **Draw**, in Inkscape or anything that saves SVG: one open path per pen
   stroke, in the order the pen makes them, in that layer. Where on the
   template the letter sits does not matter. In a hand that joins, the
   joining stroke is drawn in named parts — a path labeled `lead` for the
   lead-in, `top` for the top of a bowl, `tail` for the exit stroke, and
   the body between them — each starting where the one before ends; the
   ingest fuses them into one stroke and records how many segments each
   was, which is the letter's `join`. The body is labeled `body` where
   nothing else marks the stroke as a joining one: a letter the unlooped
   American model lifts the pencil after has neither lead-in nor tail, and
   joins in all the same. That stroke is the first unless the letter writes
   another before it, as a capital `K` writes its stem before the arm that
   joins, and the ingest records which it was.
3. **`scripts/hand-ingest.mjs`** reads every drawing in the directory into
   `src/engine/sheets/hands/<hand>.ts`. Relative, shorthand and implicit
   path forms become the four commands; layer and group transforms are
   applied; y is turned over; the ink is moved so it starts one side bearing
   in from the origin and the advance is its far edge plus the other. So
   every letter in a hand is spaced by one rule and none by where it was
   drawn. A closed path or an arc stops the run rather than being converted,
   because each means a shape tool was used where the pen tool was meant. A
   letter that does not reach about where its kind of letter should — the
   top line for an ascender, the midline for a small letter — is a warning,
   not a failure, since the drawing may be right and the table wrong.

File names follow the UFO convention — `A_.svg` for a capital, `five.svg`
for a numeral — because `a.svg` and `A.svg` are one file on a Mac
(`scripts/hand/names.mjs`). A letter the hand lists under `forms` in its
`hand.json` is one drawing per form, each named for it — `t.curved.svg`,
`t.straight.svg`, never a bare `t.svg`, which would be a second claim to be
the hand's own `t` — and the template writes every form of a listed letter
at once, each over the face's own outline of that form where it has one
(`SIL_FORMS` in `names.mjs`; a hooked `q`, which Andika lacks, is drawn over
its straight one). The ingest folds them into one glyph (`scripts/hand/forms.mjs`),
warns of a listed form nobody has drawn yet, and refuses a form the
vocabulary or the hand's table does not know. The specimen at `/dev/<hand>`
shows every glyph in every form and every style on every ruling, with the
outline face's dotted row under it, and is a development route only: a
production build has no paths for it.

### Provenance

The print hand is traced over Andika's published UFO sources — the shapes
are its shapes, made single-stroke — which makes the data a modified version
of that face under the OFL. The generated module says so in its header, the
hand carries its own name rather than a reserved one, and
`public/fonts/LICENSE.md` records it beside the fonts. The three cursive
hands are traced over Playwrite's sources the same way, each at the instance
and with the alternates that are its model — US Trad, US Modern and GB J —
which is what makes each the researched model rather than a guess at one.

### Joins — one line through a word

§6 makes a point of never deciding which cursive letters join: the font's
`calt` table sees the pair and the repo does not. A cursive hand has to
decide, and this is how it does without a second drawing of any letter.

Every small letter is drawn as it is written alone — with its lead-in, a
rise from the baseline where the letter starts with one, and its exit
stroke, the tail every letter of the looped model finishes with — and its
`join` says how many segments of the first stroke each of those is. Two
letters that join are the first without its tail, one curve, and the second
without its lead-in, and a run carries on for as long as each letter joins
out and the next joins in (`src/components/sheet/joined.ts`). The curve is a
cubic from the point the first letter's body ends, heading the way its tail
set off, to the point the second letter's body begins, heading the way its
lead-in arrived, with both handles the same share of the distance between
them. That one rule draws every family in `joins.ts`: a tail leaving the
baseline flat and a lead-in arriving steep is the diagonal join; the same
tail into a loop's top is the climb into a tall letter; a check leaving the
top of an `o` heading right and down is the horizontal join, dipping and
climbing into whatever comes next. Whether a join sets off from the midline
is read off the letter rather than stored — a body that ends nearer the
midline than the baseline leaves from its top, as `o`, `v`, `w` and `b` do —
and a join from there does one more thing: it runs along the top of a round
letter instead of climbing into it. That is `top`, the further segments of
`a`, `c`, `d`, `e`, `g`, `o` and `q` a bridge covers, so `oa` drops into the
left side of the `a` where `ea` comes up its right and over.

What a run becomes is one path for the line the pen never lifts from, then
the strokes it comes back for — the dots and crossbars — in the order the
letters sit. So a dotted word is dotted through its joins, and the guide
layout sees a joined pair as one stroke and numbers it so, which is what a
joins sheet is teaching. A letter with no tail does not join out; that is
how the unlooped American model, which lifts the pencil after some letters,
says so, and it is the `breaks` family becoming the hand's answer rather
than the font's. A mark, a space or a character the hand lacks ends a run.

A capital begins its word, and the model settles which capitals connect to
the letter after them: the fifteen that finish on the baseline — `A`, `C`,
`E`, `I`, `J`, `K`, `L`, `M`, `N`, `Q`, `R`, `U`, `X`, `Y` and `Z` — carry
a tail like any small letter's, and the rest end in a loop or at the top
and the pencil lifts. Nothing joins into a capital whatever comes before
it: its `join` is `initial`, so a name like McKenna keeps the `c`'s tail
and starts again at the `K`. Where a capital writes a stroke before the
one that joins, as the `K` writes its stem, the join says which stroke it
is on, and the run keeps that stroke ahead of its line so a model's
numbering is still the pen's order.

The two unlooped hands are the same rules applied to models that draw no
lead-in. Every small letter of both is written from where a print letter
starts, and the entry stroke a child sees on every letter of a British
joined word is the join itself arriving. So the run decides how a join
arrives at a letter with nothing to replace, by what the letter starts
with. Into a bowl the join arrives climbing, parallel to the bowl's side,
and the letter's own top turns over from where the join lands; arriving
the way the top sets off, leftward, would swing the join out past the bowl
and over its top from the right. Along the bar of an `e` the join arrives
heading that way and the curve flows into the letter. Down a stem — every
`i`, `t`, `n` and `b` of both models — it arrives along the straight line
from where it left, the way a pen goes to the top of a stem and turns
there; arriving the way the stem sets off would swing the join up over the
top of the stem and back down into it. The one entry stroke that is drawn
rather than decided is the American model's `m`, `n` and `r`, which
written alone start with a short rise from the left, and that is a lead-in
like any other. Which letters join out was read off Playwrite's own
connection classes, as the capitals' joins were: the British model carries
a tail on every letter, the American one on none of `b`, `f`, `g`, `j`,
`p`, `q`, `s` and `y`, so a run ends at those and the letter after starts
as it would alone — which is how `Zebra` in that model gets the rise on
its `r`. Both models' capitals are print, and none joins.

The handle share and the halfway rule are judgments, and the specimen
writes every pair of the joins sheet so they can be checked against the
outline face's dotted row under them.

### What this costs

Two things the outline faces gave for nothing.

**Joining decided here.** The outline row still leaves every join to the
font. A written row decides them by the section above, so a cursive hand
that draws a letter without a tail has taken a position §6 refused to, and
the drawing is where that position is written down.

**Coverage.** A face has every character; a hand has the ones somebody drew.
`drawable(hand, text)` says whether a text can be written in a hand, and the
tracing block (`blocks/Trace.tsx`) reads it row by row: a row set in the
print face is written in the hand wherever the hand has every character on
the row, and is the outline face otherwise, so a child never sees half a
word in one shape and half in another. The print hand has the two
alphabets, the numerals, and the seven marks a copied sentence needs — full
stop, comma, question and exclamation marks, apostrophe, hyphen and the
middle dot the spacing sheet marks a space with — so on a print sheet the
fallback is reached only by a character outside those, an accent say. The
three cursive hands have both alphabets and the same marks, so a cursive
sheet of letters, joins, words or copywork in any model is written in its
hand, and a row with a numeral on it is the outline face until those are
drawn. A
model of a letter or of a pair carries its guides; a model of a word does
not. Which shape of each letter is `SheetOptions.forms`, picked under Face
in the builder, carried onto the `Sheet` by `present()` exactly as the face
is, and into a share URL — where `share.ts` keeps only the forms the
vocabulary knows.

### Phases

| Phase | What                                                                         | Where it lands                                    |
| ----- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| 0     | Template, ingest, renderer, six print letters in nine drawings, specimen     | this section                                      |
| 1     | The print alphabets, numerals and marks, the letter shapes, every trace row  | `hands/print.ts`, `blocks/Trace.tsx`, the builder |
| 2     | The looped cursive small letters, with joins                                 | `hands/cursive.ts`, `joined.ts`                   |
| 3     | Its capitals, and the capital that writes its stem before its joining stroke | `hands/cursive.ts`, `joined.ts`                   |
| 4     | The other two cursive models, and the join into a letter with no lead-in     | `hands/cursive-modern.ts`, `hands/cursive-uk.ts`  |
| 5     | A font generated from the data, if one is ever wanted                        | a script, not a design                            |

A face without a hand keeps the outline row, so print ships before any
cursive is drawn and nothing waits on the whole table.
