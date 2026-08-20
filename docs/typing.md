# Frost Keys — the course, the keyboard, and the storm

Typing is the one world on the map where the thing being taught is a _motor
skill_. A times table is knowledge: you either know 7×8 or you don't, and the
race is a way of making retrieval fast. Touch typing is not like that. It is
a hundred small habits laid down in the hands, and the only way it goes wrong
is the way it always goes wrong — a child looks down, finds the key with one
finger, and gets fast enough at hunting that they never learn to touch.

Everything below follows from that. The course exists to stop a child looking
down. The keyboard on screen exists so they don't have to. The game exists so
the fifty lessons in the middle, where nothing new happens and it is only
practice, are survivable.

Three things get built, in this order:

|            |                                                           |             |
| ---------- | --------------------------------------------------------- | ----------- |
| **KEY**    | The keyboard — a model in the engine, a picture on screen | `docs` §3–4 |
| **LESSON** | A hundred lessons, gated, with a real pass mark           | §5–7        |
| **STORM**  | Hailstorm — the falling-letter game                       | §8          |

The order is not arbitrary: the lessons need the keyboard because half of them
turn it on or off deliberately, and the game needs it because in the game the
keyboard _is_ the weapon and a key's horizontal position _is_ the lane a letter
falls down. KEY is a dependency of both, and shippable on its own — dropped
under today's passage it makes today's typing game better with nothing else
changed.

---

## 1 · What this has to satisfy

The three site constraints (CLAUDE.md) apply unchanged, and two of them bite
here in specific ways:

- **Static.** A hundred lessons cannot be a hundred hand-written text files
  fetched on demand. The lesson text is _generated_, deterministically, from a
  spec and a seed — the same arrangement the print shop's sheets already have.
- **The player's data is theirs.** "Which lessons has this child passed" is
  progress, and progress is the most identifying thing on this site. It is
  therefore derived from sessions already in IndexedDB rather than stored as a
  new record. See §6.5 — this turns out to be the _simpler_ design as well as
  the compliant one.
- **SEO.** Nothing here is crawlable and nothing here needs to be. `/typing` is
  already `noindex`; the ladder lives inside the island. If typing ever earns a
  guide page, that is a content story and not this epic.

Plus four that are particular to typing:

1. **Never reward looking down.** The keyboard on screen, the finger colours
   and the next-key hint all exist to make looking down unnecessary. A child
   who is slow _and_ not looking is doing better than one who is fast and
   hunting, and the screen must say so.
2. **Accuracy is the gate; speed is the target.** A speed threshold you can
   pass by hammering teaches hammering.
3. **A lesson is not a race.** No ghost, no rival, no time penalty. The clock
   is there because words-per-minute needs one, not because somebody is
   chasing you.
4. **Nothing is a dead end.** A child who cannot beat a level must always have
   a way forward. This is why game levels never gate the ladder (§8.8) and why
   checkpoints can be attempted out of order (§6.6).

---

## 2 · Where the code goes

```
src/engine/keyboard.ts          The physical keyboard as data — codes,
                                legends, fingers, geometry. No React.

src/engine/typing/
  lessons.ts                    The 100 specs. Titles, new keys, kind,
                                pass criteria. Small — the deck layer reads it.
  keys.ts                       Cumulative key sets, and `reachable()`.
  lexicon.ts                    The word corpus. Large. NOT reachable from
                                decks/index.ts — see §5.3.
  generate.ts                   Spec + seed → the words of one lesson.
  verdict.ts                    Session → passed / not, and which bar failed.
  ladder.ts                     Sessions → which lessons a profile has cleared.
  storm.ts                      Hailstorm's rules: the wave, the shield,
                                the scoring. Pure. No DOM, no rAF.

src/games/typing/
  keyboard/Keyboard.tsx         The picture.
  keyboard/useKeyEcho.ts        Which keys are down, and which were wrong.
  ladder/                       The hundred tiles, and the brief for one.
  lesson/                       The lesson run — the track, the bars.
  storm/                        The game — field, shield, falling letters.
  (existing)                    Free play: TypingSetup, TypingTrack, Passage…
```

`src/engine/typing/` is model, so the lint boundary applies in full: no React,
no services, no storage. That is not ceremony — `generate.ts` and `storm.ts`
are the two modules in this epic that most need to be testable without a DOM,
and `keys.ts` is imported by a test that would otherwise be impossible to
write (§5.2).

**One island, not two.** Hailstorm is not a separate game in the sense typing
is separate from flash cards. It is a level _inside_ the ladder, entered from
the same screen, saved against the same profile, scored into the same XP. A
second island would mean a page load in the middle of a progression, and a
second copy of the keyboard. So `/typing` grows routes; it does not fork.

---

## 3 · The keyboard as a model

### 3.1 · Why the layout is engine, not view

The obvious place for a picture of a keyboard is the view layer. It goes in
the engine instead, because three things that are not pictures need it:

- The **curriculum** needs to know that `e` is left-middle-finger, top row, so
  that "introduce one key per hand" is a rule the lesson list can be checked
  against rather than a claim in a comment.
- The **generator** needs `reachable(word, keys)` — is every character of this
  word producible from the keys unlocked so far? That is the invariant that
  makes a hundred lessons safe to reorder (§5.2), and it is a pure function
  over the layout.
- **Hailstorm** needs a key's horizontal centre, because that is the lane its
  letter falls down (§8.2).

Only the fourth consumer is the picture. Put the layout in the view and the
first three have to import from it, which the lint boundary correctly forbids.

### 3.2 · What a key is

```ts
export type Finger =
  | "l-pinky"
  | "l-ring"
  | "l-middle"
  | "l-index"
  | "thumb"
  | "r-index"
  | "r-middle"
  | "r-ring"
  | "r-pinky";

export type KeyDef = {
  /** `KeyboardEvent.code`. "KeyF", "Semicolon", "Digit4", "Space". */
  code: string;
  /** Unshifted and shifted legends: ["a","A"], ["4","$"], ["/","?"]. */
  cap: [string, string];
  /** 0 = number row, 1 = top, 2 = home, 3 = bottom, 4 = space. */
  row: 0 | 1 | 2 | 3 | 4;
  finger: Finger;
  /** True for a s d f — j k l ; and the space bar. Where fingers rest. */
  home?: boolean;
  /** Width in key units. 1 unless it's a modifier or the space bar. */
  width?: number;
  /** Left edge in key units, from the left edge of the board. */
  x: number;
};
```

`code`, not `key`. `KeyboardEvent.key` tells you what character was produced,
which is the wrong question for "light up the key that was pressed": pressing
shift+`4` produces `$` and there is no `$` key to light. `code` is the physical
switch, which is exactly what the picture draws and exactly what the lane
model needs.

`x` is stored rather than computed because the row stagger is not derivable
from anything — it is a fact about the plastic. Row 1 starts a third of a unit
in, row 2 a little further, row 3 further still. Storing it means one number
per key and no arithmetic anybody has to trust.

`keyX(code)` is `x` plus half the key's width — the **middle** of the key, which
is the lane its letter falls down (§8.2). The field and the drawn board cannot
disagree about where a key is because both read this same table and both measure
in key units off the same `--key` — one _table_, not one function. `keyX` is the
field's convenience for the centre of a key's slot; the board wants a left edge
and a width, and takes `x` and `width` directly. A lane half a unit out is a
spatial hint that teaches the wrong thing, and the shared table is what rules
that out. It returns `null` for a code this board does not carry.

### 3.3 · `keyFor`, and why shift is two keys

```ts
export type Stroke = {
  /** The letter key. */
  code: string;
  /** Which shift to hold, or null. Always the hand OPPOSITE `code`. */
  shift: "ShiftLeft" | "ShiftRight" | null;
  finger: Finger;
};

export function strokeFor(ch: string): Stroke | null;
```

A capital is two keys, and _which_ shift matters. Typing `A` with the left
pinky on shift and the left pinky on `a` is impossible; the technique is
right-shift-plus-left-`a`. So `strokeFor` returns the shift on the opposite
hand from the letter, and the next-key hint highlights both. That is the hint
teaching the technique rather than merely locating the key — and it is the
single most-skipped thing in every typing course aimed at children.

`strokeFor` returns `null` for a character this layout cannot produce. That
null is load-bearing: it is what `reachable()` is built out of, and it is what
would have caught the curly quotation marks that `decks/typing.ts` had to hand-
exclude from the Scripture pool.

### 3.4 · One layout, and the honest limit

US ANSI QWERTY, and nothing else. The site is `en` and the games mark
punctuation exactly, so a UK keyboard — where `"` is shift-`2` and `@` is
shift-`'` — would fail lessons 62 and 67 for a child who is doing everything
right.

That is a real limitation and it should be written down rather than
discovered. It does not block this epic: the layout is data behind one
function, so a second layout is a second table plus a profile field, and
`strokeFor` is the only thing that has to learn about it. Not now.

---

## 4 · The keyboard on screen

### 4.1 · Three modes, not two booleans

```ts
export type KeyboardMode =
  | "off" // not on screen at all
  | "keys" // the board, with finger colours; no hint
  | "guide"; // the board, plus the next key (and its shift) lit
```

One field rather than `showKeyboard` + `showHint`, because three of the four
boolean combinations are meaningful and the fourth ("hint on, board hidden")
is nonsense. A union cannot express the nonsense.

### 4.2 · Where the setting lives, and who wins

The player's own preference is a field on `Profile`, alongside `soundOn`:

```ts
/** Absent on every profile made before this shipped. Read as "guide". */
keyboard?: KeyboardMode;
```

Optional and defaulted at the read site, so **no `DB_VERSION` bump and no
migration** — `Profile` is not read-migrated today and does not need to start.
`services/profiles.ts#update` gains a branch for it exactly like `soundOn`'s.

A lesson may override:

```ts
/** What this lesson puts on screen. `null` defers to the player. */
keyboard: KeyboardMode | null;
/** The lesson insists. The player's toggle is shown, disabled, with a reason. */
keyboardLocked?: boolean;
```

Resolution is one line: `lesson.keyboard ?? profile.keyboard ?? "guide"`, and
the toggle is disabled when `keyboardLocked`. The two ends of the ladder are
where locking earns its keep — lesson 1 forces `guide` because a child who has
never seen a keyboard cannot be asked to guess, and every checkpoint forces
`off` because a checkpoint that can be passed while reading the answer off the
screen measures nothing.

**A lesson's mode seeds the run; it does not overrule the player** (#145).
Read as a plain override the line above is a trap, and the ladder walks
straight into it: **every one of the hundred names a mode**, so the `??` never
falls through, the player's setting is beaten on all hundred rungs, and
`keyboardLocked` marks no difference between the lessons that insist and the
ninety-odd that were only suggesting. So the lesson's mode is what the brief's
control **opens on**; an unlocked lesson may be changed before Start and the
choice governs that run; a locked one is shown, disabled, with the reason.

The choice lives in `TypingConfig.keyboard` and lasts exactly as long as the
run it was made for. It is deliberately not written back to the profile: the
control opens on the _lesson's_ suggestion, so saving what came out of it would
let the ladder quietly overwrite a setting the child chose for themselves in
free play. `games/typing/keyboard/lessonKeyboard.ts` is the one resolver, and
both the brief and the track read it.

Default `guide` rather than `off` for a new profile: the cost of showing it to
a child who didn't need it is a glance; the cost of hiding it from one who did
is a downward glance that becomes a habit.

### 4.3 · Press echo, and why `keyup` is not trusted

The board lights a key on `keydown` and releases it on a **timer**, not on
`keyup`.

`keyup` is missed more often than you would think — the window loses focus
mid-chord, the OS eats it during a key-repeat, a modifier is released after the
element unmounts — and a key stuck lit is worse than no highlight at all,
because it is a lie about where the hand is. A 120 ms auto-release also happens
to be the better _feel_: a flash reads as "that fired", a hold reads as
"something is wrong".

So the hook is:

```ts
useKeyEcho({ expect }: { expect: string | null }): {
  /** Codes lit right now. */
  down: ReadonlySet<string>;
  /** Codes flashing --flare because they weren't the expected character. */
  wrong: ReadonlySet<string>;
}
```

Both sets are small and change at most ten times a second — a `useState` per
keystroke is nothing next to the ticker already re-rendering this screen
sixteen times a second.

Wrongness is decided **here, on keydown**, and not from the input's value.
Comparing buffers cannot tell you which key was struck (shift+`4` and `$` are
the same buffer), and it cannot tell you at all until React has re-rendered.
The keydown handler already has `event.code`; `strokeFor(expect)` gives what it
should have been; the comparison is immediate and exact.

### 4.4 · The board is `aria-hidden`

Sixty-odd spans announcing themselves is not an accessible keyboard, it is a
denial-of-service on a screen reader. Every piece of state the board displays
is already carried by the passage — the current word is `aria-current`, the
characters are text, errors are in the DOM. So `aria-hidden="true"` on the
whole board, and the picture stays a picture.

The **toggle** that shows and hides it is a real kit `Toggle`, labelled, and
reachable — because that one is a control.

### 4.5 · Touch devices

On a tablet the software keyboard _is_ the interface, and "don't look down" has
no meaning. The board still renders (it shows finger colours and the next key,
which are still useful), but it is never tappable. A tappable board would be a
different product — a hunt-and-peck trainer — and building it would undo the
whole point.

Hailstorm is the exception that cannot be papered over: it needs raw key
events and there is no software keyboard on screen during it. See §8.8.

### 4.6 · Colour

Finger colours are the one new palette this epic needs, and they must not come
out of the telemetry five. `--lime`, `--flare`, `--sky`, `--gold` and
`--grape` mean correct / wrong / ghost / record / badge in every world
(CLAUDE.md), and a keyboard that used `--lime` for "left index finger" would
teach a child to unlearn the one signal the site is consistent about.

So: eight finger hues as their own tokens in `tokens.css`, deliberately
desaturated so the board reads as scenery, and the two states that _do_ carry
meaning borrow from the five — a pressed-and-correct key flashes `--lime`, a
pressed-and-wrong key flashes `--flare`, the next-key hint uses `--go`
(per-world, and it already means "press this").

---

## 5 · The ladder

### 5.1 · A lesson is a spec; its text is generated

A hundred hand-written word pools is a hundred things to get wrong, and the
first one anybody gets wrong is using a letter the child hasn't met yet. So a
lesson declares what it is _for_, and the words are produced from that:

```ts
export type LessonKind =
  | { type: "keys" } // letter groups: ffff jjjj fjfj jfjf
  | { type: "words" } // words from the unlocked alphabet
  | { type: "bigrams"; focus: string[] } // words chosen to drill sequences
  | { type: "sentences" }
  | { type: "passage" } // real prose from the library
  | { type: "numbers" }
  | { type: "mixed" }
  | { type: "sprint" }
  | { type: "storm"; wave: WaveSpec }; // §8

export type Lesson = {
  /** 1–100. */
  n: number;
  /** "L07". Stable forever — it is in `Session.mode`. */
  id: string;
  block: number;
  title: string;
  /** Characters this lesson introduces. Empty on review, game, checkpoint. */
  introduces: string[];
  kind: LessonKind;
  wordCount: number;
  keyboard: KeyboardMode | null;
  keyboardLocked?: boolean;
  pass: PassCriteria;
  checkpoint?: true;
};
```

The **unlocked alphabet** at lesson _n_ is the union of `introduces` over
lessons 1…_n_, plus space. It is computed, never written down, so moving a
lesson moves its words with it.

A drill group is **four** characters, not three, and that is arithmetic rather
than taste: four plus the space that follows it is five, which is the
words-per-minute convention `wordCount` is counted in, so a `keys` lesson runs
to `wordCount × 5` characters like every other kind. That is the same figure
`strikesFor` sizes the new-key gate against, and at three the two would
disagree. Lesson 67 hands over six symbols and asks ten strikes of each: 60
new characters out of the 174 that 35 groups of four and their spaces come to
is 34%, inside §5.2's 15–35% band; out of the 139 that groups of three would
leave, it is 43%, above the band with the generator blameless.

### 5.2 · The invariant that makes a hundred lessons safe

> Every character of every word a lesson can generate must be producible from
> the keys unlocked at that lesson.

One test, over all hundred lessons, over a large sample of seeds, asserting
`strokeFor(ch) !== null && unlocked(n).has(ch)` for every character produced.
It is the reason the layout is in the engine and it is the reason this ladder
can be re-ordered by editing one array.

Two more the same test file should carry, because they are the mistakes that
are otherwise found by a seven-year-old:

- **A new key actually appears.** Every introduced character occurs at least
  `pass.keyStrikes` times in the generated text, at every seed. Otherwise the
  new-key gate (§6.4) is unpassable through no fault of the child's.
- **A lesson is mostly review.** New keys are between 15% and 35% of the
  characters. Below that it isn't a lesson about them; above it, it is a memory
  test rather than typing.

### 5.3 · The lexicon, and the 222 KB lesson

Filtering "words using only `f j d k s l`" needs a corpus. The Dolch lists in
`decks/wordlists.ts` are a few hundred words — enough to be a spelling
syllabus, nowhere near enough to survive that filter. So: a frequency-ordered
corpus of a few thousand common English words, child-appropriate, in
`src/engine/typing/lexicon.ts`.

This file must never become reachable from `src/engine/decks/index.ts`.

That is not a style preference. `decks/index.ts` is the front door for every
island — flash cards, spelling, the record book, the print shop — and a module
in its graph is shipped to all of them. The last time this was got wrong, an
import of the passage library from `decks/typing.ts` took the shared chunk from
46 KB to 222 KB, which is why thirty-three verses are written out by hand in
that file today. The same trap, one file over.

The way out is already in the type. `TypingConfig.words` exists, and
`buildTypingDeck` already renders a config that carries its own words:

- The **ladder screen** — inside the typing island, where the lexicon belongs —
  generates the passage and puts it in `config.words` before starting the run.
- `decks/index.ts` builds the deck from `config.words` exactly as it does for a
  drill today, and never imports `generate.ts` or `lexicon.ts`.
- `lessons.ts` stays small (titles and criteria, no text) and _is_ importable
  from the deck layer, which is how `deckSpec("typing:L07")` can label a run
  "Lesson 7 · Reaching up" in a record book two years from now.

A lint rule is cheap and is the only thing that will stop this happening a
third time. What it pins is _reachability_, not the one import: banning
`decks/**` alone would leave the hop through `lessons.ts` — the one module in
`engine/typing/` the deck layer may import, and therefore the one place an
`import { WORDS } from "./lexicon"` buys every island a 222 KB chunk with
nothing under `decks/` looking wrong. So `local/no-corpus-in-decks` bans
`engine/typing/lexicon` and `engine/typing/generate` from **`src/engine/**`**,
exempting only the corpus, the generator and their tests. Default-deny costs
nothing here — no engine module outside those three has any business holding
the words — and it does not need a new entry each time the engine grows a file.

### 5.4 · Ghost identity is the lesson, not the passage

`typingConfigKey` folds `config.words` into the key today, which is right for a
parent-authored drill and wrong for a lesson: every run of lesson 7 generates a
different passage, so every run would land in a bucket of one and a child would
never see their own best.

So when a config carries a lesson id, the key is `typing|<lessonId>|<n>` and
the words are left out of it. Existing keys are unchanged — no shipped level id
looks like a lesson id, so the two namespaces cannot collide — and
**`configKey` decides which runs may race each other as ghosts, so nothing
already saved may change shape** (CLAUDE.md). The discriminator is a new
optional field:

```ts
/** Set when this run is a lesson from the ladder. */
lessonId?: string;
```

`modeOf` prefers it, so `Session.mode` is `typing:L07`; `levelId` is then set
to the same string and is not read.

### 5.5 · The ten blocks

Each block is ten lessons ending in a checkpoint. Roughly five introduce keys,
two consolidate, two are Hailstorm, one is the checkpoint.

| Block             | Lessons | What arrives                                           |
| ----------------- | ------- | ------------------------------------------------------ |
| 1 · Home          | 1–10    | `f j` `d k` `s l` `a ;` `g h`                          |
| 2 · Reaching up   | 11–20   | `e i` `r u` `t y` `w o` `q p`                          |
| 3 · Reaching down | 21–30   | `v m` `c ,` `x .` `z /` `b n`                          |
| 4 · Capitals      | 31–40   | both shifts, `'`                                       |
| 5 · Fluency       | 41–50   | nothing — the common bigrams and the top hundred words |
| 6 · Numbers       | 51–60   | `4 5` `3 6` `2 7` `1 8` `9 0`                          |
| 7 · Punctuation   | 61–70   | `? !` `"` `- _` `: ;` `( )` `@ # $ % & *` `/ \ + =`    |
| 8 · Endurance     | 71–80   | nothing — length                                       |
| 9 · Speed         | 81–90   | nothing — pace                                         |
| 10 · Everything   | 91–100  | nothing — all of it at once                            |

Three things about that order are deliberate:

- **Keys arrive in mirrored pairs, one per hand.** `f`/`j` are the index home
  keys; `d`/`k`, `s`/`l`, `a`/`;` walk outward together. It keeps the hands
  balanced and it teaches the symmetry, which is the thing that makes the
  bottom row guessable by the time you get there.
- **Words cannot start until lesson 5.** There is no English word in
  `f j d k s l`. Three lessons of `fff jjj fjf` is standard and correct, and it
  is also why lesson 4 is a Hailstorm level: the first thing that is _fun_
  arrives before the first thing that is a word.
- **Comma and full stop come in with the bottom row**, because that is where
  they physically are. It costs nothing and it means real sentences are
  available at the end of block 3 rather than needing their own lesson.

### 5.6 · The hundred

`⌨` = keyboard mode, `🔒` = the lesson insists. `wpm` is gross words per
minute; `acc` is the whole-lesson accuracy bar.

**Block 1 · Home row**

|   # | Title                     | New   | Kind    | ⌨       | Words | wpm | acc |
| --: | ------------------------- | ----- | ------- | ------- | ----: | --: | --: |
|   1 | Two keys                  | `f j` | keys    | guide🔒 |    20 |   8 | 95% |
|   2 | Four keys                 | `d k` | keys    | guide🔒 |    20 |   8 | 95% |
|   3 | Six keys                  | `s l` | keys    | guide🔒 |    24 |   9 | 95% |
|   4 | Hailstorm · First ice     | —     | storm   | guide🔒 |     — |   — |   — |
|   5 | Both pinkies              | `a ;` | keys    | guide🔒 |    24 |   9 | 95% |
|   6 | The inside reach          | `g h` | keys    | guide🔒 |    24 |  10 | 95% |
|   7 | Home-row words            | —     | words   | guide   |    25 |  11 | 95% |
|   8 | Pairs that repeat         | —     | bigrams | guide   |    25 |  11 | 95% |
|   9 | Hailstorm · Home row      | —     | storm   | guide   |     — |   — |   — |
|  10 | **Checkpoint · Home row** | —     | words   | off🔒   |    30 |  12 | 97% |

**Block 2 · Reaching up**

|   # | Title                     | New   | Kind    | ⌨       | Words | wpm | acc |
| --: | ------------------------- | ----- | ------- | ------- | ----: | --: | --: |
|  11 | Up to e and i             | `e i` | keys    | guide🔒 |    24 |   9 | 95% |
|  12 | Up to r and u             | `r u` | keys    | guide🔒 |    24 |   9 | 95% |
|  13 | Hailstorm · Eight lanes   | —     | storm   | guide   |     — |   — |   — |
|  14 | The long reach            | `t y` | keys    | guide🔒 |    24 |  10 | 95% |
|  15 | Up to w and o             | `w o` | keys    | guide🔒 |    26 |  10 | 95% |
|  16 | Real words at last        | —     | words   | guide   |    30 |  12 | 95% |
|  17 | The corners               | `q p` | keys    | guide🔒 |    26 |  10 | 95% |
|  18 | th · he · er · re         | —     | bigrams | guide   |    30 |  13 | 95% |
|  19 | Hailstorm · Two rows      | —     | storm   | keys    |     — |   — |   — |
|  20 | **Checkpoint · Two rows** | —     | words   | off🔒   |    35 |  15 | 97% |

**Block 3 · Reaching down**

|   # | Title                         | New   | Kind      | ⌨       | Words | wpm | acc |
| --: | ----------------------------- | ----- | --------- | ------- | ----: | --: | --: |
|  21 | Down to v and m               | `v m` | keys      | guide🔒 |    26 |  11 | 95% |
|  22 | c, and the comma              | `c ,` | keys      | guide🔒 |    26 |  11 | 95% |
|  23 | Hailstorm · Down low          | —     | storm     | guide   |     — |   — |   — |
|  24 | x, and the full stop          | `x .` | keys      | guide🔒 |    26 |  12 | 95% |
|  25 | The last corner               | `z /` | keys      | guide🔒 |    26 |  12 | 95% |
|  26 | The last two                  | `b n` | keys      | guide🔒 |    28 |  12 | 95% |
|  27 | Every letter                  | —     | words     | guide   |    35 |  14 | 95% |
|  28 | an · in · on · nd · nt        | —     | bigrams   | keys    |    35 |  15 | 95% |
|  29 | Hailstorm · Whole alphabet    | —     | storm     | keys    |     — |   — |   — |
|  30 | **Checkpoint · Every letter** | —     | sentences | off🔒   |    40 |  18 | 97% |

**Block 4 · Capitals**

|   # | Title                           | New               | Kind      | ⌨       | Words | wpm | acc |
| --: | ------------------------------- | ----------------- | --------- | ------- | ----: | --: | --: |
|  31 | The right shift                 | `⇧`→left letters  | keys      | guide🔒 |    30 |  13 | 95% |
|  32 | The left shift                  | `⇧`→right letters | keys      | guide🔒 |    30 |  13 | 95% |
|  33 | Names, and the word I           | —                 | words     | guide   |    35 |  15 | 95% |
|  34 | Hailstorm · Capitals            | —                 | storm     | keys    |     — |   — |   — |
|  35 | The apostrophe                  | `'`               | keys      | guide🔒 |    30 |  14 | 95% |
|  36 | First sentences                 | —                 | sentences | keys    |    35 |  16 | 95% |
|  37 | Where the comma goes            | —                 | sentences | keys    |    40 |  17 | 95% |
|  38 | Places and people               | —                 | sentences | keys    |    40 |  18 | 95% |
|  39 | Hailstorm · Shift under fire    | —                 | storm     | off     |     — |   — |   — |
|  40 | **Checkpoint · Real sentences** | —                 | sentences | off🔒   |    45 |  20 | 97% |

**Block 5 · Fluency**

|   # | Title                   | New | Kind    | ⌨     | Words | wpm | acc |
| --: | ----------------------- | --- | ------- | ----- | ----: | --: | --: |
|  41 | The twenty-five         | —   | words   | keys  |    40 |  18 | 95% |
|  42 | th · he · in · er       | —   | bigrams | keys  |    40 |  19 | 95% |
|  43 | an · re · on · at · en  | —   | bigrams | keys  |    40 |  20 | 95% |
|  44 | The hard pairs          | —   | bigrams | keys  |    40 |  19 | 95% |
|  45 | Hailstorm · Pairs       | —   | storm   | keys  |     — |   — |   — |
|  46 | Hands that take turns   | —   | words   | off   |    45 |  22 | 95% |
|  47 | One hand at a time      | —   | words   | keys  |    40 |  20 | 95% |
|  48 | The hundred             | —   | words   | off   |    50 |  24 | 95% |
|  49 | Hailstorm · Whole words | —   | storm   | off   |     — |   — |   — |
|  50 | **Checkpoint · Fluent** | —   | passage | off🔒 |    60 |  25 | 97% |

**Block 6 · Numbers**

|   # | Title                       | New   | Kind    | ⌨       | Words | wpm | acc |
| --: | --------------------------- | ----- | ------- | ------- | ----: | --: | --: |
|  51 | Four and five               | `4 5` | keys    | guide🔒 |    30 |  16 | 95% |
|  52 | Three and six               | `3 6` | keys    | guide🔒 |    30 |  16 | 95% |
|  53 | Hailstorm · Digits          | —     | storm   | guide   |     — |   — |   — |
|  54 | Two and seven               | `2 7` | keys    | guide🔒 |    30 |  17 | 95% |
|  55 | One and eight               | `1 8` | keys    | guide🔒 |    30 |  17 | 95% |
|  56 | Nine and nought             | `9 0` | keys    | guide🔒 |    30 |  18 | 95% |
|  57 | Ages, dates and scores      | —     | numbers | keys    |    40 |  19 | 95% |
|  58 | Words and numbers together  | —     | mixed   | keys    |    45 |  20 | 95% |
|  59 | Hailstorm · Numbers falling | —     | storm   | keys    |     — |   — |   — |
|  60 | **Checkpoint · Numbers**    | —     | mixed   | off🔒   |    50 |  22 | 97% |

**Block 7 · Punctuation**

|   # | Title                       | New           | Kind    | ⌨       | Words | wpm | acc |
| --: | --------------------------- | ------------- | ------- | ------- | ----: | --: | --: |
|  61 | Asking and shouting         | `? !`         | keys    | guide🔒 |    35 |  18 | 95% |
|  62 | Speech marks                | `"`           | keys    | guide🔒 |    35 |  18 | 95% |
|  63 | Hyphen and underscore       | `- _`         | keys    | guide🔒 |    35 |  19 | 95% |
|  64 | Colon and semicolon         | `: ;`         | keys    | guide🔒 |    35 |  19 | 95% |
|  65 | Hailstorm · Punctuation     | —             | storm   | keys    |     — |   — |   — |
|  66 | Brackets                    | `( )`         | keys    | guide🔒 |    35 |  19 | 95% |
|  67 | Above the numbers           | `@ # $ % & *` | keys    | guide🔒 |    35 |  18 | 95% |
|  68 | Slash, plus, equals         | `/ \ + =`     | keys    | guide🔒 |    35 |  19 | 95% |
|  69 | Hailstorm · Symbols         | —             | storm   | off     |     — |   — |   — |
|  70 | **Checkpoint · Punctuated** | —             | passage | off🔒   |    55 |  24 | 97% |

**Block 8 · Endurance**

|   # | Title                            | New | Kind    | ⌨     | Words | wpm | acc |
| --: | -------------------------------- | --- | ------- | ----- | ----: | --: | --: |
|  71 | Sixty words                      | —   | passage | off   |    60 |  22 | 96% |
|  72 | A whole paragraph                | —   | passage | off   |    70 |  23 | 96% |
|  73 | Hailstorm · The long wave        | —   | storm   | off   |     — |   — |   — |
|  74 | The sight words, again           | —   | words   | off   |    60 |  24 | 96% |
|  75 | Verses                           | —   | passage | off   |    70 |  24 | 96% |
|  76 | Someone speaking                 | —   | passage | off   |    70 |  25 | 96% |
|  77 | Eighty words                     | —   | passage | off   |    80 |  26 | 96% |
|  78 | Numbers in prose                 | —   | passage | off   |    80 |  26 | 96% |
|  79 | Hailstorm · No repairs           | —   | storm   | off   |     — |   — |   — |
|  80 | **Checkpoint · A hundred words** | —   | passage | off🔒 |   100 |  28 | 97% |

**Block 9 · Speed**

|   # | Title                        | New | Kind    | ⌨     | Words | wpm | acc |
| --: | ---------------------------- | --- | ------- | ----- | ----: | --: | --: |
|  81 | Sprint · Common words        | —   | sprint  | off   |    30 |  28 | 95% |
|  82 | Sprint · Alternating hands   | —   | sprint  | off   |    30 |  30 | 95% |
|  83 | Hailstorm · Hard rain        | —   | storm   | off   |     — |   — |   — |
|  84 | Sprint · The hard pairs      | —   | sprint  | off   |    30 |  28 | 95% |
|  85 | Sprint · Capitals            | —   | sprint  | off   |    30 |  29 | 95% |
|  86 | Sprint · Numbers             | —   | sprint  | off   |    30 |  26 | 95% |
|  87 | Sprint · Punctuation         | —   | sprint  | off   |    30 |  28 | 95% |
|  88 | A solid minute               | —   | passage | off   |    90 |  32 | 95% |
|  89 | Hailstorm · Whiteout         | —   | storm   | off   |     — |   — |   — |
|  90 | **Checkpoint · Thirty-five** | —   | passage | off🔒 |    80 |  35 | 96% |

**Block 10 · Everything**

|   # | Title                        | New | Kind    | ⌨     | Words | wpm |     acc |
| --: | ---------------------------- | --- | ------- | ----- | ----: | --: | ------: |
|  91 | Mixed prose                  | —   | passage | off   |    90 |  30 |     96% |
|  92 | Prose with numbers           | —   | mixed   | off   |    90 |  30 |     96% |
|  93 | Hailstorm · Everything falls | —   | storm   | off   |     — |   — |       — |
|  94 | A long verse                 | —   | passage | off   |   100 |  31 |     96% |
|  95 | An address, a price, a date  | —   | mixed   | off   |    80 |  30 |     96% |
|  96 | A hundred and twenty         | —   | passage | off   |   120 |  32 |     96% |
|  97 | The accuracy run             | —   | passage | off   |    80 |  28 | **99%** |
|  98 | Sprint · Everything          | —   | sprint  | off   |    40 |  36 |     95% |
|  99 | Hailstorm · The last storm   | —   | storm   | off   |     — |   — |       — |
| 100 | **The Ice Exam**             | —   | passage | off🔒 |   150 |  38 |     97% |

Twenty Hailstorm levels, ten checkpoints, thirty that introduce keys.

Read the wpm column down the page and it does not climb smoothly — it **drops
every time a key arrives** and climbs back on the review lessons after it.
Lesson 50 asks for 25 wpm and lesson 51 asks for 16. That is not a bug in the
table. It is the truth about learning a new key, written into the pass mark so
that a child who has just met the number row is not measured against the person
they were yesterday. See §6.3.

---

## 6 · Passing

### 6.1 · Three bars, and why three

```ts
export type PassCriteria =
  | {
      kind: "lesson";
      /** Whole-lesson accuracy, 0–1. */
      accuracy: number;
      /** Gross words per minute. */
      wpm: number;
      /** Each newly-introduced key, at least this fraction correct… */
      keyAccuracy: number;
      /** …over at least this many strikes. The generator guarantees enough. */
      keyStrikes: number;
    }
  | {
      kind: "storm";
      /** Survive the wave. Always true — it is what a wave is for. */
      survive: true;
      accuracy: number;
    };
```

and the verdict a results screen renders:

```ts
export type Bar = { got: number; need: number; ok: boolean };
export type Verdict = {
  passed: boolean;
  accuracy: Bar;
  wpm: Bar;
  /** One per newly-introduced key. Empty on a review or a checkpoint. */
  keys: Array<Bar & { key: string }>;
};
```

Three bars rather than one score, for a reason that is about a seven-year-old
and not about statistics: **a single number tells you that you failed and not
what to do**. Three bars, each either full or not, say "you were fast enough
and not accurate enough" or "you have `x` but not `z`", which is an
instruction. A blended "net WPM" — the industry default — hides exactly the
distinction a beginner most needs.

The order they are shown in is the order they matter: accuracy, then the new
keys, then speed.

### 6.2 · Accuracy is nearly flat, and high

**95%** for a lesson, **97%** for a checkpoint, all the way up. It does not
scale with the material, and it does not scale with age.

The temptation is to make it easy at the start, because the child is five.
That gets it backwards: lesson 1 has _two keys_, and 95% of a two-key drill is
easier than 95% of anything that comes later. The bar being constant is what
makes it teach — it says accuracy is not the thing that varies, speed is.

The one exception is lesson 97, which asks for 99% at a deliberately modest
pace. It exists so that "slow down and get it right" is a thing the ladder has
asked for explicitly at least once.

### 6.3 · Speed scales, and dips

The wpm target runs roughly 8 → 38 across the hundred, with two shapes on top:

- **Blocks that add nothing new climb fastest** (5, 8, 9, 10). That is where
  speed is the lesson.
- **A lesson that introduces keys targets about 80% of its block's running
  figure.** You have just got slower, and you should have. Pretending
  otherwise makes the ladder punish exactly the moment it should encourage.

38 wpm at lesson 100 is a real, defensible target for a child who has worked
through this: comfortably above the ~33 wpm average adult hunt-and-peck typist,
comfortably below anything that would need years.

### 6.4 · The new-key gate

Accuracy and speed together still miss the thing the lesson was _for_. A
lesson that introduces `z` can be passed at 95% and 12 wpm while getting `z`
wrong every single time it appears, because `z` is 3% of the text.

So: **every character the lesson introduces must be struck correctly at least
`keyAccuracy` of the time, over at least `keyStrikes` strikes.** Defaults 90%
and 12. The generator is tested to guarantee at least that many occurrences at
every seed (§5.2), so the gate can never be unpassable through bad luck.

This is the criterion that turns a hundred typing tests into a hundred
lessons, and it is the one no other course on the internet has.

**Per-key stats come from the cards, not from keystrokes.** A `CardResult`
carries `answer` and `given`, so a word typed right contributes a hit to each
of its characters and a word typed wrong contributes a miss to each character
that differs. That is a deliberate, documented approximation: a key struck
wrong and then corrected with backspace counts as a hit.

Forgiving the correction is the right call here. Recording raw keystrokes
would mean a new field on `Session` — a shared engine type — for one game's
benefit, and it would mean the gate measures something the child cannot see on
the results screen. Measuring what ended up on the line is both simpler and
more explicable. If it ever proves too soft, the fix is a `noBackspace` flag on
the lesson rather than a schema change.

### 6.5 · "Passed" is stored nowhere

There is no `passedLessons` field, no new object store, and no `DB_VERSION`
bump. A lesson is passed if **a session exists for it that meets its
criteria** — which is a filter over sessions the hub has already loaded.

```ts
export function ladderProgress(sessions: Session[]): {
  /** Every lesson number cleared. */
  cleared: ReadonlySet<number>;
  /** The highest cleared. 0 if none. */
  best: number;
  /** best + 1, capped at 100. What the ladder points at. */
  next: number;
};
```

Three things fall out of deriving it rather than storing it, and all three are
worth more than the memoisation they cost:

- **No migration, ever.** Not for this and not when the criteria change.
- **It self-heals.** Tune lesson 40's wpm down and every child who was one wpm
  short is now through, without a backfill.
- **It cannot disagree with the record book.** A stored flag and a session list
  are two sources of truth for one fact, and they drift the first time a save
  half-fails.

The cost is a pass over up to `MAX_SESSIONS_PER_PROFILE` (2000) sessions,
memoised on the sessions array, which is already in memory.

### 6.6 · Unlock is `max`, not `count` — and checkpoints are the express lane

**Unlocked = highest cleared + 1.** Not "count of cleared", which would be
brittle: `MAX_SESSIONS_PER_PROFILE` drops the _oldest_ sessions, so a child
2000 runs in could lose the proof that they passed lesson 1 and be told to do
it again. Taking the maximum means losing old proof costs nothing as long as
one later run survives.

**Any checkpoint may be attempted at any time.** Lessons unlock one at a time;
the ten checkpoints are always open. Passing checkpoint 30 sets `best` to 30
and therefore clears 1–29 with it — which is the same `max` rule, not a special
case.

That single rule does the whole job of a placement test:

- A nine-year-old who already types is not made to do `fff jjj` for a week.
  They open checkpoint 40, pass it, and start at 41.
- Nobody has to guess their own level from a description. They just try one.
- Failing costs nothing at all, so trying one is free.

Retries are unlimited and unpenalised everywhere. It is practice.

### 6.7 · Badges

Additive to `BADGES` in `engine/progress.ts` — badge ids are persisted per
profile, so adding is safe and removing is not. Five, no more:

| id             | name         | how                                                 |
| -------------- | ------------ | --------------------------------------------------- |
| `home-keys`    | Home Keys    | 🏠 Clear checkpoint 10                              |
| `touch-typist` | Touch Typist | ✋ Clear checkpoint 50                              |
| `ice-exam`     | Ice Exam     | 🧊 Clear lesson 100                                 |
| `eyes-up`      | Eyes Up      | 👀 Pass a lesson with the keyboard hidden           |
| `unbroken`     | Unbroken     | 🛡️ Clear a Hailstorm wave with the shield untouched |

`eyes-up` is the one that matters. It is the only badge on the site that
rewards doing the work the harder way, and it exists because the whole course
is an argument for doing that.

**"Clear" means what the ladder means by it.** The three ladder badges are
asked of `ladderProgress` and read `best`, not `cleared`: passing checkpoint 50
clears 1–49 with it (§6.6), so a nine-year-old who takes the express lane holds
Home Keys as well as Touch Typist. A shelf that disagreed with the ladder next
to it about the same child would be the stored-flag bug of §6.5 in another
coat. They are asked on every finished run and not only on typing ones, because
`evaluateBadges` returns what is _true_ rather than what is new — which is also
how a child who cleared checkpoint 10 before LES12 shipped is handed the badge
by their next race, of anything.

**`eyes-up` asks what the run was typed under, minus the lessons that left no
choice.** Three things: the lesson did not force the board off, the run's own
`config.keyboard` is `off`, and it passed. The exclusion is about compulsion,
not authorship — every checkpoint forces the board off, so a badge that read
the resolved mode, or `config.keyboard` on a lesson that insists, would fire on
exactly the ten runs where being eyes-up was not optional, which is the inverse
of the badge. Whether a lesson insists is `forcedKeyboard` in
`engine/typing/lessons.ts` — one definition, read by the island's `keyboardFor`
to draw the board and by the badge to exclude the forced ten (decision 28).

**Hidden, not chosen, is where the line sits, and on purpose.** A lesson's mode
only _seeds_ the brief's control (§4.2) and Start hands over whatever the
control is showing, so on an unlocked lesson `config.keyboard` records the mode
the run was actually typed under whether or not the child touched the pills —
and twenty-three unlocked rows seed `off` themselves, so opening lesson 46,
pressing Start and passing earns this. That is the badge working: they typed a
lesson blind, which is what it says on the shelf ("Pass a lesson with the
keyboard hidden"). Insisting on authorship would mean comparing the config
against the lesson's seed and refusing a child for doing exactly what the ladder
asked, while rewarding the one who flipped a pill the ladder had already
flipped. A `keyboard` absent from the config is a different matter — free play,
or a run started without a brief in front of it — and absent is not evidence of
a hidden board, so `=== "off"` refuses it rather than guessing.

**`unbroken` is waiting for the waves, and the guard says so.** A storm level's
`wordCount` is its wave's `count` (§8.3) and every one of the twenty is `0`
until STM10 writes them — so `survived` is vacuously true and "cleared a wave"
is a claim about a wave that does not exist. The badge requires the wave to have
a length, which is a guard that retires itself the day the waves land rather
than a line someone has to remember to delete (decision 29). "Shield untouched"
is read as **no letter reached the bottom**, which is what takes a point off a
segment (§8.5): a storm's cards are its falling letters (§8.7), so a run with
nothing marked wrong is a run where nothing got through. That errs strict, and
strict is the right direction for a badge that, once in `Profile.badges`, is
never taken back.

---

## 7 · A lesson is not a race

The lesson run is the existing `TypingTrack` with the race taken out of it.
Concretely, on a lesson:

- **No ghost, no rival list, no `Lane`.** Nothing is chasing you.
- **No `WRONG_ANSWER_PENALTY_MS`.** Three seconds a miss is a race mechanic. On
  a lesson, accuracy is measured directly and a time penalty would double-count
  it _and_ make the wpm figure a lie — the number would no longer be words per
  minute of anything.
- **The HUD shows the three bars filling**, live, instead of a gap to a rival.
  The thing you are chasing is the criteria, and you can watch yourself do it.
- **The 3·2·1 stays.** It is the moment the hands go on the home row, and it is
  worth keeping for that alone. The copy under it becomes "fingers on home row"
  rather than a starting gun.
- **Space still commits a word.** Keeping the card-is-a-word model is what
  makes the record book, the splits, the trouble list, XP and the drill builder
  work on lessons for free. It is the single highest-leverage thing not to
  change.

Free play — today's five levels, ghosts, rivals and personal bests — is
untouched and stays on the same screen as the ladder. Nothing about a hundred
lessons should stop a child who just wants to type a psalm and race their
brother.

---

## 8 · Hailstorm

Letters fall. Your keyboard shoots them. What you miss breaks your shield, and
what gets through the shield gets you.

### 8.1 · What it is for

Blocks 5, 8, 9 and 10 introduce no new keys. They are forty lessons of pure
practice, which is exactly what a child needs and exactly what a child will not
do. Hailstorm is how those forty lessons stay survivable — and it is not a
bribe stapled on the side, because the thing it drills is real:

- It forces **eyes up**. The letters are at the top of the screen; the keyboard
  is not. You cannot look down and see what is coming.
- It drills **single-key reaction** rather than word rhythm, which is the one
  thing the passage lessons cannot exercise.
- It shows you **which finger is weak** as a hole in your own defences (§8.5).

### 8.2 · The field is the keyboard

A letter falls down **the column of the key that produces it**. `f` falls onto
`f`. `y` falls between `g` and `h`, because that is where `y` is.

That is the whole design, and it is why `KeyDef.x` is in the engine. The
horizontal position of a falling letter is a spatial hint about where its key
is, given a second or two before it has to be found — so the game is not merely
themed around a keyboard, it is _teaching the layout geometrically_ the entire
time it is being played.

The keyboard component sits at the bottom of the field, lit by the same
`useKeyEcho` the lessons use. It is literally the gun.

Lanes are key units, not pixels, so the field and the board scale together off
one `--key` custom property — **declared once, at the root**. It lived on
`.keyboard` until the field was built, and could not stay there: a custom
property inherits downwards only, so a value declared on the board is a value
the sky above it cannot read. The alternative was a second clamp with the same
numbers in the storm's own block, which is precisely the drift this is supposed
to rule out — a lane and the cap it names, free to disagree about how wide a
key is (decision 37).

They scale off it differently, though, and the difference had to be resolved
rather than inherited. `keyX` returns the centre of a key's **slot**, while the
drawn keycap is inset inside that slot: `game.css` gives it
`width: calc(var(--w) * var(--key) - var(--key-gap))`, with `--key-gap` set to
`calc(var(--key) * 0.09)`. So a cap's visual centre is `--key * (x + w/2 -
0.045)` while its lane is `--key * (x + w/2)` — a letter placed at
`left: calc(var(--lane) * var(--key))` and centred on that point would sit
**0.045 key units right of the centre of the cap it names**, about 1.7px at the
2.4rem ceiling of `--key` and about 0.8px at the 1.05rem floor.

**The field subtracts it** (decision 36):

```css
left: calc(var(--lane) * var(--key) - var(--key-gap) / 2);
```

Two reasons, and the second is the one that matters in a year. A child aims at
the plastic, not at the slot — "`f` falls onto `f`" is a claim about the thing
on screen called `f`, and the cap is the only `f` there is. And the offset is
not a constant of nature: it is half of whatever the board insets its caps by,
so `var(--key-gap) / 2` is the correction at any gap, while the 0.045 it
currently works out to would be a second number to keep in step with the first.
Written this way a chunkier keyboard moves the lanes with it and nothing has to
be remembered.

Sub-pixel, and therefore worth being explicit about what it is not: this is not
a fudge factor found by nudging until it looked right. It is the difference
between two positions the stylesheet computes, and `StormField.test.tsx`
computes both of them the way a browser would — reading the field's `left` and
the board's `left` and `width` out of `game.css` and evaluating them with
`--key` as the unit. `stoneCentre` and `capCentre` come out equal to ten
decimal places, and stop being equal the moment either declaration moves
without the other: inset the caps by `var(--key-gap) * 2` and the test fails by
the half gap the lane no longer matches, rather than the board quietly drifting
1.7px off every letter. In key units, so nothing here can be satisfied by a
pixel that happened to round the right way at one size.

### 8.3 · A wave, from a seed

```ts
export type WaveSpec = {
  /** Which characters can fall. Usually "everything unlocked by lesson n". */
  keys: string[];
  /** How many letters in the wave. */
  count: number;
  /** ms between spawns — sampled per letter from this range. */
  gap: [number, number];
  /** ms for a letter to cross the field — sampled per letter. */
  fall: [number, number];
  /** Shield hit points per finger zone. */
  shield: number;
  /** Combo needed to repair a zone. 0 = no repairs. */
  repairAt: number;
};
```

The whole wave — which letter, which lane, when it spawns, how fast it falls —
is generated up front from `mulberry32(seed)`, exactly as every deck on this
site is. That makes a run **replayable**, which matters more than it sounds: it
is what lets a child retry the level that beat them and meet the same storm,
and it is what makes the rules unit-testable without a browser.

`gap` and `fall` as ranges rather than numbers is what "sometimes even random
within the level" means. Early levels set `gap` wider than `fall`, so there is
never more than one letter on screen and the game is pure reaction. Later
levels overlap them, so two or three are falling at once and you have to work
bottom-up — which is reading ahead, which is the thing that makes a fast typist.

What it emits is the storm, decided:

```ts
export function buildWave(spec: WaveSpec, seed: number): Wave;

export type StormLetter = {
  /** The character, as it is drawn. */
  ch: string;
  /** The key that produces it — what a press is matched against. */
  code: string;
  /** The finger that types it: the shield segment it lands on (§8.5). */
  finger: ShieldFinger;
  /** `keyX(code)` — the column it falls down, in key units (§8.2). */
  lane: number;
  /** ms from the start of the wave. */
  spawnMs: number;
  /** ms to cross the field. */
  fallMs: number;
  /** `spawnMs + fallMs` — when it reaches the shield. */
  landMs: number;
};
```

Every letter is resolved against the keyboard **once, up front**: `strokeFor`
gives the key and the finger, `keyX` gives the lane. So the reducer never asks
the layout a question mid-run, the renderer does no arithmetic to place a
letter, and the finger the death screen names cannot disagree with the column
the letter fell down. `letters` is in spawn order and the index is a letter's
identity — the wave is built once and never grows, so nothing can shift under a
reducer's "which are in the air" or under a React key.

A letter is on the field over the **half-open** interval `[spawnMs, landMs)`:
there the instant it spawns, gone the instant it lands, because landing is the
tick that turns it into shield damage. That is what makes the early levels'
guarantee `gap[0] >= fall[1]` rather than `>` — at exactly equal, the outgoing
letter lands on the same millisecond the next one spawns, which is a handover
and not two letters on screen.

Two characters never fall, whatever `spec.keys` says: one this board cannot
produce (§3.3's null), because it could never be shot, and one typed with a
thumb — the unlocked alphabet always carries a space and the shield has no
thumb segment for it to damage (§8.5). A spec left with nothing to draw from
builds an **empty wave rather than throwing**, the same habit as `deckSpec`
never throwing: a storm with nothing in it is a screen that ends, and a throw
is a game loop that dies holding a child's run.

### 8.4 · The lowest letter is the target

**Only the lowest letter on screen can be shot.** Any other key is a miss.

Without that rule a child sprays the keyboard and the game rewards it. With it,
a wave with three letters in the air is a small exercise in prioritising, and
"firing the wrong letter out of sequence" is a definable thing that can cost
you something.

Lowest is the greatest **fall progress** — `(t - spawnMs) / fallMs` — and not
the earliest `landMs`. The two part company as soon as two letters fall at
different speeds, which is most of the ladder: a slow letter spawned early is
halfway down while a fast one spawned later has barely started, and yet the
fast one lands first. Aiming by the schedule would point the gun at a letter
that is visibly nearer the top of the screen, and the child is looking at the
field. On an exact tie — the single instant two letters cross — the earlier
spawn wins, because a letter's index is its identity (§8.3) and a replay has to
resolve a dead heat the same way every time.

Firing at an empty field is a miss too. It is the same spray by another route,
and a streak that survived it would have found the strategy again.

### 8.5 · The shield is your fingers

The shield spans the bottom of the field in **eight segments, one per finger**
(thumbs excluded — nothing falls on the space bar). Each has `shield` hit
points.

- A letter that reaches the bottom takes a point off the segment above it.
- A segment at zero is a **hole**.
- A letter that lands in a hole ends the run.

Finger zones rather than per-key segments, because a hole under `o` tells you
nothing and a hole under **right ring finger** tells you what to practise. When
the run ends, the screen says which finger let it through, and offers a drill
of exactly the keys that zone covers — which is the trouble-facts machinery
already in `records.ts`, pointed at a different question.

**The ending is a screen, and it stands where the board stood** (decision 47).
`.storm` is two tracks — a sky that gives and a board that never does — so the
panel takes the board's, because the board is the gun and the gun is dead. That
is what leaves the sky whole: the hail frozen where the clock stopped, and the
shield with the hole still open under the finger being named. Drawn over the
sky it would have covered the one picture that explains its own sentence, and
added as a third row it would have taken the space out of the sky instead —
which on a short viewport is the whole of it (§8.2). The gun stops listening
with the run for the same reason: `Space` and `Enter` are keys this board
carries, and a dead gun that went on swallowing them would leave a child on the
keyboard unable to press the buttons that replaced it — three after a breach,
two after a cleared wave, and on every ending the only way off this screen.

What it concludes is decided in `stormReport(state)` and rendered in
`StormOver`, which holds no rules at all:

- **Which finger, and how many it let through.** The finger is copied off the
  letter at the moment it got past (`StormEnding.breached`), and the count is
  `zoneTally` — a filter over `resolved`, never over `hasLanded`. After a
  breach the clock stops at the fatal `landMs`, so a letter from a higher index
  tying that exact millisecond is left unresolved while the clock reads it as
  landed; counting the clock would over-report what got through, on the one
  screen where the number is the whole point.
- **The keys to practise.** That finger's characters, out of `spec.keys` rather
  than off the whole board: a child who died at lesson 13 has met perhaps two
  of the right ring finger's keys, and a drill of `9` and `(` would be a
  practice deck of keys nobody has taught them. It can never be empty for a
  finger that just breached — the letter that got through came out of that same
  pool wearing that same finger.
- **What the run came to.** Shield left out of the eight-of-`shield` it started
  with, and the longest streak (recovered from `LetterOutcome.combo`, which
  only ever climbs by one).

Two of the four figures on the panel are **not** in the report, and `StormOver`
reads them elsewhere. The score is `state.score`, the run's own live number
taken straight off the state — it was on the HUD the whole time, and a report
field restating it would be a second copy of a figure nothing derives. The XP
is `stormXp(state)`, and it could not be in the report: `stormXp` lives in
`progress.ts`, which imports `decks/index.ts` and the lessons, and `storm.ts`
imports neither — it is kept a hop clear of the deck layer. The screen is
where both figures are already in reach, because it builds its drill through
`buildDrill`, which is that same front door.

**No score-shaming, and that is a criterion rather than a preference.** A run
that ended early is "the storm got through", not a mark. Everything on the two
endings that a child could read as a grade is identical: the same panel, in the
same order, with the same four figures in the same places, drawn in the same
colours. What differs is what there is to say and to offer — the heading, the
lede under it, and, after a breach only, an "Its keys" line and a third button
offering a drill of those keys. So nothing in the arrangement, the ordering or
the colour can be read as a mark for the child rather than a report of what the
weather did. The one hue a breach adds is the named finger's own, which is
identity and not judgement: the same colour as the block that broke and the
keys under it. `--lime` appears exactly once, on the XP, where it means
what it means everywhere else on this site — this is what you earned, and it
could not have gone down (§8.6).

**A zone is its finger's home-row span** (`FINGER_ZONES` in
`engine/keyboard.ts`, decision 41). That is a choice between four rows rather
than a derivation: every row divides into eight runs — no row hands a key back
to a finger it has already passed — but the rows are staggered, so they
disagree about where the divisions fall. The left pinky gives way to the left
ring at 2 on the number row, at 2.5 on the top row, at 2.75 on the home row and
at 3.25 on the bottom row, and a vertical seam can honour one of the four. The
home row wins because it is the row the hands are ON: `a s d f` and `j k l ;`
is where the fingers rest and what every reach returns to, so "your right ring
finger" and "the column over `l`" are the same sentence to the child being told
it. The eight spans tile the board exactly — 2.75 + 1 + 1 + 2 + 2 + 1 + 1 +
4.25 = 15 — which is what makes a hole a gap in a wall rather than a dark patch
beside one. Every other row is then off by the stagger and no further: a lane
is never more than a quarter unit outside its own segment, which
`keyboard.test.ts` pins at exactly that. `6` is the case to know — right index,
but a quarter unit left of where the right index's segment starts, because that
is where `6` really is.

The segments take the same half-`--key-gap` step back the lanes do (§8.2), so a
seam falls in the gutter between two keycaps instead of down the middle of one
— and because both halves step back by the same amount, a letter is over its
own segment exactly when its key is in its own zone.

How much is left is the **height** of the block: a skyline of eight, which is a
quantity that can be read across a field without counting, and which goes to
nothing at zero and leaves an empty socket. A hole keeps that socket, in
`--flare` — a child still has to be able to see WHICH finger the gap belongs
to, and a wrong is what `--flare` means everywhere else on this site.

That feedback is the best thing in this epic. A child watching their own right
ring finger crumble learns something about their hands that no accuracy
percentage will ever tell them.

`repairAt` gives it back: every _n_ consecutive hits restores a point to the
weakest segment. It is the comeback path, and it rewards the exact behaviour
the game exists to build. The weakest segment rather than the last one damaged,
because a segment at zero is simultaneously the one about to end the run and
the one a single point is worth most in — "weakest" reaches it with no special
case for holes.

Two edges of that, both decided in the reducer. **Consecutive means
consecutive**: a letter you let land breaks the streak exactly as a wrong key
does, because the streak is "are you keeping up" and a letter that got through
is the definition of not. And **a repair never lifts a segment above
`shield`** — repairs that outran damage would hand a strong player a shield
deeper than the level ever wrote down, and the eight-of-`shield` a run starts
with is what "the shield came through untouched" is reported against.

### 8.6 · Score can fall; XP cannot

Two numbers, deliberately:

- **Score** is the run's own, lives in the HUD, and **goes down** when you fire
  a wrong key. Losing points has to be visible and immediate or it isn't a
  consequence.
- **XP** is the profile's, is shared with every other game on the site, and is
  computed once at the end as `max(0, …)` from the run's hits.

They are separate because XP is cumulative across years and four games. A
mechanic that could take XP away would mean a child's level going backwards
because they had a bad five minutes in a shooter, which is not a thing this
site should ever do.

Per-hit XP reuses `cardXp(ms, streak)` unchanged. It already rewards speed
under four seconds and streaks up to ×2, which is exactly the shape a shooter
wants — and reusing it means a Hailstorm level and a flash-card race pay out on
the same scale, which they must, because it is one profile and one level ring.

**One streak, one multiplier, two currencies.** A hit is worth `HIT_POINTS`
(ten) scaled by `comboMultiplier(combo)` — the same ×1 to ×2 curve `cardXp`
folds into a card, moved into `engine/combo.ts` so both games read one copy of
it. So the `×1.6` a child watches climb in the HUD is the figure their XP is
being paid at, and the score and the payout cannot tell them two different
stories about one run. The storm may not import `progress.ts` to get it: that
module reaches `decks/index.ts`, the front door every island downloads, and
STM10 puts a `WaveSpec` on each storm lesson (§5.3, decision 7).

**A wrong key costs `MISS_POINTS` (ten) and the streak.** Equal to a plain hit
on purpose — one wrong key undoes one clean one, which is a sentence a
five-year-old can hold — while a hit on a long streak is worth two of them. The
real cost is the second half anyway: every later hit is paid at a multiplier
that has to be earned again. A letter that gets through costs the score
nothing; it has already cost a shield point, and one failure should not be
charged twice (decision 46).

The score is allowed to go negative, and is drawn negative. It is the run's own
number, it ends with the run, and a floor on it would be the game declining to
say what just happened.

**A stroke at an empty sky is a miss (§8.4), and the board says so**
(decision 43). That needed deciding rather than inheriting: with nothing in the
air there is no expected character, and `useKeyEcho` marks nothing wrong when
nothing is expected — so every key would have lit `--lime` for "that was
right" while the score fell by ten. The field passes `emptyIsWrong`, which
turns the echo's "nothing to judge" into "nothing that could be right", and
every key flares. It is unconditional because the board is: a run with an
ending has handed the board's place to the ending screen (§8.5, decision 47),
so there is no keyboard left to mark a child's keys against a letter nothing
can shoot.

**Key auto-repeat is not a shot** (decision 44). A held key repeats about
thirty times a second, and a gun that fired on it would let a child spray by
leaning on one key, drain a score they never pressed for, and strobe the miss
flash at 30Hz — which §8.10 forbids outright. `HELD` — shift, ctrl, alt, cmd —
is not a shot either, and it is imported from `useKeyEcho` rather than
restated, so the keys that never flare and the keys that never cost are one
list.

The HUD lives **inside the sky**, absolutely positioned over it and painted
behind the stones (decision 45). `.storm` is a two-track grid whose only
flexible track is the sky, and the sky is down to a few dozen pixels on a short
viewport (§8.2) — so a HUD row would come out of the one thing with nothing
left to give. It carries the two numbers a live run keeps and no more: what a
run PAID is the ending screen's line (§8.5), where there is room to put it
beside the finger that let the storm through.

### 8.7 · A run is a `Session`

A falling letter maps onto a `CardResult` with nothing forced: `prompt` and
`answer` are the character, `given` is what was pressed, `ms` is how long it
was in the air, `factId` is the character. So a Hailstorm run **is a session**,
with `mode = "typing:L45"` like any other lesson.

Everything downstream then works with no new code: the record book lists it,
XP and badges accrue, per-character trouble spots feed the drill builder, and
`deckSpec` names it in a record book two years later.

The one thing that is different: a run can **end early**. Dying at letter 18 of
40 saves a session with 18 cards. `correct`, `incorrect` and `durationMs` are
all honest; the pass criterion (`survive`) is simply not met.

### 8.8 · Hailstorm never gates the ladder

Game levels are **skippable**. Lesson 46 unlocks when lesson 44 is cleared,
whatever happened at 45.

Two reasons, and either alone is sufficient:

- **A tablet has no keys to press.** Hailstorm needs raw `keydown` with a
  `code`, and there is no software keyboard on screen during it. A child on an
  iPad can do the whole course and cannot play the game. Gating on it would
  lock them out at lesson 4.
- **A reward that blocks you is not a reward.** The forty practice lessons are
  the ones that need a reason to keep going; a game level that a child cannot
  beat would be the exact opposite of what it was put there for.

The ladder marks them clearly — a different tile, "worth playing, not
required" — and the tile is disabled with a reason on a device with no
keyboard, rather than failing mysteriously.

### 8.9 · DOM, not canvas

Ten falling letters, a shield and a keyboard, at 60fps, in DOM elements with
`transform: translateY` written straight from a `requestAnimationFrame` loop.

Not canvas, for a reason that is specific to this site: **the whole app changes
biome by swapping eleven custom properties** (CLAUDE.md), and a canvas is a
hole in that — every colour inside it would have to be read out of
`getComputedStyle` and re-plumbed by hand, and the first world added after this
would silently not apply to the one screen that most needs the scenery.

Writing transforms directly to the DOM rather than rendering them is the
pattern `useRaceClock`'s fuse already uses, and for the same reason: it has to
move at full frame rate, and it has to keep moving for players who have asked
for reduced motion.

The **rules** — spawn schedule, hit resolution, shield state, scoring — are in
`engine/typing/storm.ts` as a pure reducer over a tick. No React, no rAF, no
DOM. The loop calls it; the tests call it too.

`tick(state, dtMs)` resolves **every** landing inside the interval it is given,
however long that is — including letters that spawned and landed inside the
same tick and were airborne at no instant anybody sampled. A backgrounded tab
stops `requestAnimationFrame` and hands back seconds, and a dropped landing
would leave the shield quietly disagreeing with the storm that damaged it.
Whether a child should be held responsible for a tab they were not looking at
is a separate question, and it is the loop's: clamping the delta, or pausing on
`visibilitychange`, is a decision the clock can only make deliberately because
the rules underneath it are honest about the whole interval.

**The clock clamps at 100ms** (`MAX_STEP_MS`, decision 38). That is six frames
at 60Hz and three at 30Hz, so a step longer than it is not a slow frame but a
gap — a hidden tab, a resumed laptop, a stall. Under the clamp the wall clock
is authoritative for any rate a game could be played at, so the storm is not
quietly easier on a slower machine; over it the wave falls behind the clock
rather than teleporting a dozen letters through the shield in one frame. A
`visibilitychange` pause is deliberately _not_ taken as well: rAF is already
suspended while a tab is hidden, so the clamp is the thing that has to be right
on the way back, and unlike a listener it also covers the stalls that are not
tab switches. It also floors a non-finite delta, which `tick` cannot defend
itself against — `timeMs + NaN` is `NaN` for the rest of the run, and a run
whose letters can never land has no ending to leave by.

**The loop writes `--drop` and nothing else** (decision 39). The stylesheet
multiplies that fraction by the height of the sky, so the field's geometry
stays where the lanes and the keycaps already are — off one `--key` and the
sky's own size (§8.2) — and the loop never learns how tall the field is or gets
to hold a second opinion about it at some viewport width. The fall is a
transform rather than `top` for the reason `.fuse__fill` scales rather than
setting a width: the layout property is the expensive one to write, and twelve
stones moving sixty times a second is twelve layouts a frame. Because a
percentage inside a transform resolves against the element being _moved_, the
sky is a size container and the travel is written in `cqh`.

**The field re-renders on the picture, not on the frame** (decision 40).
Neither an empty `tick` nor a missed `fire` returns the object it was handed,
so `===` on the state says "changed" sixty times a second and means nothing.
What React is re-rendered for is every field of a `StormState` except the
clock and the wave — `resolved`, `shield`, `combo`, `score`, `misses` and
`ending` — plus the two things the clock alone moves: a letter appearing,
which no field records because it is a time crossing, and the target changing,
which two letters at different speeds can do mid-air with nothing happening at
all (decision 32). Miss that second one and the board goes on marking a child's
keys against a letter that is no longer the lowest. The wave is the field left
out on purpose: it is fixed for the life of a run, so it cannot change under a
running loop, and a screen handed a different wave is a different run — which
the effect notices for itself, starting the new storm from zero rather than
redrawing the old one.

### 8.10 · Motion, flashing and reduced motion

A falling-letter game cannot honour `prefers-reduced-motion` by removing the
falling. What it can and must do:

- **No screen shake, no parallax, no particles** under reduced motion. Those
  are decoration and they come off.
- **No strobe, ever, in any mode.** Damage is one 150 ms tint, not a flash
  sequence. A hail of red flashes at 60fps is a photosensitivity risk and this
  site's youngest player is five.

  The duration is the easy half. What would strobe is an animation _restarted_
  every frame, which reads identically in the stylesheet — so the tint is a
  child element mounted from a counter that only goes up: landings on that zone
  for the damage tint, repairs into it for the mend, and the run's own miss
  count for the `--flare` wash over the score (decision 42). A fresh
  element runs its animation once; an unchanged counter is the same element and
  does not restart it; and several letters landing on one zone inside a single
  `tick` move the counter by several and are still one element, so they are
  still one tint. Neither counter is stored — `resolved` says what landed and
  where, and hit points say what is left, so repairs fall out of the two
  (`zoneTally`).

  Measured rather than asserted: `e2e/smoke.mjs` counts `animationstart` over a
  whole run and holds it to one per letter that lands. Under a wave landing a
  letter every 15 ms, 54 damage events drew 29 visible episodes — consecutive
  hits on one zone re-peak a tint that is already lit rather than blinking it
  off and on, which is the safe direction for that failure to go in.

- **Fall speeds are capped** at the top of the ladder. "Whiteout" at lesson 89
  should be hard because there are many letters, not because one is a blur.

---

## 9 · Routes and screens

`/typing` keeps its hash router; the island grows three screens.

| Route             | Screen                                                     |
| ----------------- | ---------------------------------------------------------- |
| `#/`              | Player select (unchanged)                                  |
| `#/p/:id`         | **The ladder** — a hundred tiles, plus a Free play section |
| `#/p/:id/go`      | A lesson run, or a free-play run. Driven by `pending`.     |
| `#/p/:id/storm`   | A Hailstorm run                                            |
| `#/p/:id/results` | Results — lesson bars, or the free-play scoreline          |

The run routes are driven by `RaceContext.pending` exactly as today, so the
guards that stop a mid-navigation flicker (the ones documented at the top of
`TypingTrack` and `TypingResults`) keep working unchanged. That is deliberate —
those two guards were each written after a real bug, and reworking the routing
around them is how they come back.

**The ladder screen** is the ice world's own overworld: ten rows of ten,
blocks named down the side, cleared tiles filled, the next one lit with `--go`,
later ones dim, checkpoints marked, Hailstorm tiles a different shape. Choosing
a tile opens a brief: what it teaches, the three bars it wants, your best if
you have one, and Start.

It is the screen that makes a hundred lessons feel like a map rather than a
syllabus, and it is the one piece of UI in this epic worth spending real design
time on.

Component budget: `LessonLadder`, `LessonTile`, `LessonBrief`, `PassBars`,
`Keyboard`, `StormRun`, `StormField`, `StormShield`, `StormOver`. All under the
300-line cap;
the ladder is the only one that will come close, and the brief splitting out is
why it won't. `StormRun` is the route and `StormField` is the screen it draws:
the field is a pure function of one `StormState`, so the wave, the clock and
(later) the saving live above it and every frame it can be in is renderable
from a value.

---

## 10 · Storage — what changes

Almost nothing, and that is the design working.

|                   |                                                                       |
| ----------------- | --------------------------------------------------------------------- |
| `DB_VERSION`      | **unchanged.** No new store.                                          |
| New object stores | none                                                                  |
| `Session`         | unchanged                                                             |
| `Profile`         | `keyboard?: KeyboardMode` — optional, defaulted on read, no migration |
| `TypingConfig`    | `lessonId?: string` — optional, and the ghost-key discriminator       |
| `TypingConfig`    | `keyboard?: KeyboardMode` — the brief's choice; inert in `configKey`  |
| `configKey`       | unchanged for every config already saved (§5.4)                       |
| Lesson progress   | derived from sessions; stored nowhere (§6.5)                          |

Two existing runs saved before any of this must keep resolving, and the tests
that pin that (`decks/typing.test.ts`, `migrate.test.ts`) are the ones to run
first when either optional field is added.

---

## 11 · Decisions, recorded

|     | Decision                                                 | Because                                                                                                     |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | The keyboard layout is engine, not view                  | The curriculum, the generator and the game's lanes all need it; only the fourth consumer is a picture       |
| 2   | `code`, not `key`                                        | Shift+`4` produces `$` and there is no `$` key to light up                                                  |
| 3   | Keys release on a timer, not `keyup`                     | A missed `keyup` leaves a key stuck lit, which is a lie about where the hand is                             |
| 4   | The board is `aria-hidden`                               | Sixty announcing spans is not accessibility; the passage already carries the state                          |
| 5   | The visual keyboard is never tappable                    | A tappable board is a hunt-and-peck trainer, which is the thing this is against                             |
| 6   | Lesson text is generated, not written                    | A hundred hand-written pools is a hundred chances to use a key the child hasn't met                         |
| 7   | The lexicon must not be reachable from `decks/index.ts`  | The same import took the shared chunk 46 KB → 222 KB once already                                           |
| 8   | Ghost identity is the lesson, not the passage            | Every run generates different words; keying on them buckets every run alone                                 |
| 9   | Three pass bars, not one score                           | A single number says you failed; three say what to fix                                                      |
| 10  | Accuracy is flat and high; speed scales                  | An accuracy bar you can hammer past teaches hammering                                                       |
| 11  | The speed bar dips when a key arrives                    | You have just got slower and you should have                                                                |
| 12  | The new-key gate                                         | 95% and 12 wpm can both be met while getting the lesson's own key wrong every time                          |
| 13  | Per-key stats come from cards, not keystrokes            | Raw keystrokes would need a `Session` field for one game's benefit; corrections are fairly forgiven         |
| 14  | Progress is derived, never stored                        | No migration, self-heals when criteria change, cannot disagree with the record book                         |
| 15  | Unlock is `max(cleared) + 1`                             | Session pruning drops the oldest runs; counting would silently re-lock lesson 1                             |
| 16  | Any checkpoint, any time                                 | It is a placement test, a skip-ahead and an ordering rule in one sentence                                   |
| 17  | A lesson has no ghost and no time penalty                | A penalty double-counts accuracy and makes the wpm number a lie                                             |
| 18  | Hailstorm is a route in the typing island                | It is a level inside the ladder; a second island means a page load mid-progression and a second keyboard    |
| 19  | Letters fall down their key's column                     | The lane is a spatial hint — the game teaches the layout the whole time it is played                        |
| 20  | Only the lowest letter can be shot                       | Otherwise spraying the keyboard is a winning strategy                                                       |
| 21  | The shield is eight finger zones                         | A hole under `o` tells you nothing; a hole under the right ring finger tells you what to practise           |
| 22  | Score can fall, XP cannot                                | XP is cumulative across years and four games; a bad five minutes must not lower a level                     |
| 23  | A Hailstorm run is a `Session`                           | Record book, XP, badges and the drill builder all work with no new code                                     |
| 24  | Hailstorm never gates the ladder                         | A tablet has no keys, and a reward that blocks you is not a reward                                          |
| 25  | DOM, not canvas                                          | Eleven custom properties change the whole app's biome; a canvas is a hole in that                           |
| 26  | US ANSI only, and say so                                 | A UK keyboard would fail lessons 62 and 67 for a child doing everything right                               |
| 27  | A lesson's keyboard seeds; it does not overrule          | All hundred name a mode, so an override beats the player's own setting on every rung                        |
| 28  | `eyes-up` reads the board the run was typed under        | Checkpoints force it off, so the resolved mode alone awards it for the ten where it was compulsory          |
| 29  | `unbroken` is gated on the wave having a length          | "The wave exists" retires itself when STM10 lands; "no screen starts one" is a line someone must delete     |
| 30  | A falling letter is on the field on `[spawn, land)`      | Landing is the tick that resolves a letter, so `gap` exactly equal to `fall` is a handover, not two         |
| 31  | A letter carries its key, finger and lane                | Resolved against the layout once, so the lane, the shot and the finger named at death cannot drift          |
| 32  | The target is the greatest fall progress, not `landMs`   | Letters at different speeds cross; landing order aims at a letter visibly higher up the screen              |
| 33  | An exact tie goes to the earlier spawn                   | The index is the letter's identity, so a replay resolves the same dead heat the same way                    |
| 34  | A repair never lifts a zone above `spec.shield`          | "Untouched" has to keep meaning the eight-of-`shield` a run started with                                    |
| 35  | A tick resolves every landing inside it                  | A backgrounded tab hands back seconds; clamping the delta is the clock's call, not the rule's               |
| 36  | The field's lanes step back half a `--key-gap`           | `keyX` centres a key's slot; the child aims at the cap drawn inside it, and half the gap is the difference  |
| 37  | `--key` is declared once, at the root                    | It lived on the board, which the field above it cannot read — and a second clamp is two ideas of a key      |
| 38  | A frame is clamped to 100ms of wave time                 | A hidden tab hands back seconds; running slow below 10fps beats teleporting letters through the shield      |
| 39  | The loop writes `--drop`; the stylesheet owns the fall   | Geometry stays off one `--key` and the sky's own height, so the loop holds no second opinion about either   |
| 40  | The field re-renders on the picture, not on the frame    | `tick` and `fire` hand back a fresh object either way, so identity is not a "nothing changed" signal        |
| 41  | A shield segment is its finger's home-row span           | All four rows divide into eight, but the stagger moves the seams; the home row is the one the hands rest on |
| 42  | A tint is an element keyed by a counter, not a class     | A single-pass animation on a new node cannot restart on a frame where nothing happened, which is a strobe   |
| 43  | A stroke at an empty sky flares the whole board          | It costs ten points and the streak, and a key that costs a child points must not light `--lime`             |
| 44  | Key auto-repeat is not a shot                            | A held key is one stroke, not thirty a second of spraying, drained score and flashing red                   |
| 45  | The HUD is drawn inside the sky, not as a row of its own | `.storm`'s only flexible track is the sky, and on a short viewport it has nothing left to give              |
| 46  | A wrong key costs score; a letter through costs shield   | One failure, one cost — the landing has already taken the thing that ends runs                              |
| 47  | The ending stands where the board did                    | The gun is dead, and the sky it leaves whole is the shield with the hole in it that the sentence is about   |

---

## 12 · Tests

The four that carry this epic, in the order they are worth writing:

1. **Reachability** (§5.2). Every character of every lesson's generated text,
   at many seeds, is producible on the layout and unlocked by that lesson.
   This is the test that makes the ladder editable.
2. **The new key shows up enough.** Each introduced character occurs at least
   `pass.keyStrikes` times, at every seed, so the gate is never unpassable.
3. **`configKey` is frozen.** Every config shape saved before this epic
   produces byte-identical keys. Runs from before must still find their ghosts.
4. **The storm reducer.** Spawn schedule, lowest-target resolution, shield
   depletion, repair, scoring, death — all pure, all without a DOM.

Plus the ones that are cheap and catch the embarrassing failures: `strokeFor`
round-trips every character in every lesson; the hundred lessons have unique
ids and are numbered 1–100 with no gaps; every tenth is a checkpoint; the wpm
column is non-decreasing across blocks that introduce nothing.

---

## 13 · What to build, in what order

**KEY — the keyboard.** Ships on its own, under today's passage.

1. `engine/keyboard.ts` — the layout, `strokeFor`, `keyX`, and its tests.
2. `Keyboard.tsx` and finger-colour tokens.
3. `useKeyEcho` — press flash and wrong-key flash.
4. The next-key hint, including the opposite-hand shift.
5. `Profile.keyboard` and the toggle.
6. Wire it under the existing typing passage. **KEY is done here.**

**LESSON — the ladder.** Needs KEY.

7. `engine/typing/lessons.ts` — the hundred specs and their criteria.
8. `engine/typing/keys.ts` + `lexicon.ts` — unlocked sets, and the corpus.
9. `engine/typing/generate.ts` — spec + seed → words. **The reachability test.**
10. `TypingConfig.lessonId`, `modeOf`, `typingConfigKey`. Frozen-key test.
11. `engine/typing/verdict.ts` — the three bars.
12. `engine/typing/ladder.ts` — derived progress, `max`, checkpoints.
13. The lesson run — `TypingTrack` without the race (§7).
14. The lesson results — three bars, and what to do next.
15. The ladder screen and the brief.
16. Badges, and the keyboard toggle honouring lesson locks.

**STORM — Hailstorm.** Needs KEY. Runs alongside LESSON.

17. `engine/typing/storm.ts` — the wave from a seed, and the reducer.
18. The field: lanes off `keyX`, falling letters on rAF transforms.
19. The shield: eight finger zones, damage, holes, repair.
20. Firing: lowest-target resolution, combo, score.
21. Death, and the which-finger-let-it-through screen with its drill.
22. Saving a storm run as a `Session`.
23. Reduced motion, and the no-keyboard device path.

**WEAVE.** Needs both.

24. The twenty storm levels' `WaveSpec`s, keyed off each lesson's unlocked set.
25. Storm tiles on the ladder, non-gating, with the skip rule.
