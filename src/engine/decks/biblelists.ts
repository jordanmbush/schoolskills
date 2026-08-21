/**
 * Bible memory work as word lists: the books in order, the names, the places,
 * and the words the stories are told in.
 *
 * The same `WordList` shape the Dolch lists are, and that is the whole design.
 * A list in this file is picked from the same control, printed by the same
 * seven spelling styles and the same three puzzles, resolved by the same
 * `WORD_LISTS_BY_ID`, and — when the games take them (PRINT31) — played by the
 * same deck family. Nothing here is a second kind of list, because a second
 * kind of list would be a second picker, a second sanitiser and a second answer
 * to what a word is (docs/printables.md §12).
 *
 * ── Which Bible, and why that has to be said ────────────────────────────────
 * These are the **sixty-six books of the Protestant canon** — thirty-nine in
 * the Old Testament, twenty-seven in the New. Catholic Bibles carry seventy-
 * three, adding Tobit, Judith, Wisdom, Sirach, Baruch and 1–2 Maccabees and
 * the longer Esther and Daniel; Orthodox canons carry more again, and differ
 * between churches. This is not a footnote to be tidied away: a child learns
 * this list by heart, and a child taught sixty-six books from a family whose
 * Bible has seventy-three has been taught something they will have to unlearn.
 * The list says which canon it follows, in the blurb a parent reads before
 * pressing anything.
 *
 * The release these names come from ships the deuterocanon itself, filed
 * between Malachi and Matthew, which is the plainest evidence that sixty-six is
 * an editorial choice rather than the shape of the file. It is our choice, and
 * it is stated.
 *
 * ── Where the spellings come from ───────────────────────────────────────────
 *   Source      the running heads (`\h`) and long titles (`\toc1`) of eBible's
 *               own USFM release of the World English Bible Updated —
 *               https://ebible.org/Scriptures/engwebu_usfm.zip, files dated
 *               14 August 2026, pulled 17 August 2026.
 *   Why that    it is the same release `sheets/passages/scripture.ts` quotes,
 *               so the book named at the top of a copywork sheet and the book
 *               spelt on a memory list cannot be two different spellings.
 *
 * `biblelists.test.ts` pins that: every book the passage library references —
 * forty-eight of the sixty-six, each already checked character for character
 * against the release — must appear in these lists spelt identically. Rename
 * one and the suite fails, which is the same mechanism the verses have.
 *
 * A numbered book is written as the release writes it: `1 Samuel`, not `First
 * Samuel` and not `I Samuel`. Two consequences on the puzzle shelf, both
 * deliberate and neither hidden. `puzzleWords` folds a list onto its grid form
 * — letters only, upper case — so a numbered pair is one entry on all three
 * puzzles: a books word search holds SAMUEL once, and so does a scramble. And
 * in a jumble the digit and the space are shuffled in with the letters, which
 * is a fair puzzle and an odd-looking one. Both are better than a books list
 * that cannot say which Samuel it means, and the seven spelling styles — which
 * are where a memory list actually gets used — print every one of the sixty-six
 * as it is written here.
 *
 * One of those seven needs to know what a space is to do that. Word shapes
 * draws a box per character, and a box is a thing a child writes a letter into,
 * so a space is a `gap` in `words/shapes.ts` rather than a box: the slot is
 * still reserved, so the boxes either side of it stay put, and nothing is drawn
 * in it. Without that, `1 Samuel` asks for a letter where the space is.
 *
 * ── Why these lists break two of the Dolch rules ────────────────────────────
 * `wordlists.ts` holds its entries to lower case and to one word each, and the
 * reason is stated there: a spoken spelling card cannot signal that a capital
 * or a space is expected, so a proper noun on one is a trap. That reasoning is
 * about the card, not about the list. Here the capital *is* the fact — Nahum
 * is a name and not a noun — and the exercise is remembering which books there
 * are and in what order, which is a memory-work exercise a sheet of paper does
 * better than a microphone. Marking, when the games do take these, forgives
 * case and collapsed spacing (`normaliseWord`), so nothing a child types is
 * marked wrong for a capital nobody told them about.
 *
 * ── The house rules for a clue, and two this file adds ──────────────────────
 * Everything `wordlists.ts` says about a sentence holds: one `_`, the word
 * never printed beside its own gap, short enough to read out on a clock, and
 * no sentence used twice anywhere in the build. Two more, because these lists
 * make factual claims where Dolch's make none:
 *
 *   1. **A word belongs to exactly one shipped list.** `shippedClue` indexes
 *      every sentence this build ships by its word, so a word in two lists
 *      would have two clues and a crossword would print whichever was
 *      registered last. Which is why Ruth, Esther, Daniel, Jonah, Joshua and
 *      Job are books here and not also people: the book is named after the
 *      person, so one entry carries both and its sentence is written to be
 *      true of each.
 *   2. **Nothing that is a matter of dispute between traditions.** Every claim
 *      below is one the text states and the churches agree on — Noah built a
 *      boat, Amos kept sheep, Obadiah is the shortest book in the Old
 *      Testament. What baptism accomplishes, what happens at communion, how
 *      the days of Genesis 1 are counted: all real questions, none of them a
 *      thing to hand a seven-year-old as a definition to memorise. The
 *      vocabulary list is short for exactly that reason, and it is the right
 *      trade — a definition a child learns and later finds was one side of an
 *      argument teaches them to distrust the sheet.
 */
import type { WordList } from "./wordlists";

/**
 * The books, in order, with the five groupings memory work actually uses.
 *
 * The comment headings below are the divisions every "books of the Bible" song
 * and wall chart uses — Law, History, Poetry, Major and Minor Prophets — and
 * they are comments rather than data because a division is how the list is
 * *taught*, not what it is. A child recites sixty-six names in one run; a
 * parent chunks them into five. Splitting the list into five shipped lists
 * would make the recitation impossible to practise, which is the exercise.
 */
export const BIBLE_LISTS: WordList[] = [
  {
    id: "bible-books-ot",
    name: "Books of the Old Testament",
    group: "Memory work",
    blurb:
      "Genesis to Malachi, in order — the thirty-nine books of the Protestant Old Testament.",
    emoji: "📜",
    entries: [
      /* ── The Law ─────────────────────────────────────────────────────── */
      { word: "Genesis", clue: "_ is the first book of the Bible." },
      { word: "Exodus", clue: "_ tells how Israel left Egypt." },
      { word: "Leviticus", clue: "_ gives the laws for the priests." },
      { word: "Numbers", clue: "_ counts the tribes in the desert." },
      { word: "Deuteronomy", clue: "In _, Moses speaks one last time." },

      /* ── History ─────────────────────────────────────────────────────── */
      { word: "Joshua", clue: "_ led Israel into the promised land." },
      { word: "Judges", clue: "_ tells about Gideon and Samson." },
      { word: "Ruth", clue: "_ gleaned in the fields of Boaz." },
      // The clue goes round the front of a numbered book rather than starting
      // with it: "1 Samuel" fills two slots of the eight a sentence may run to.
      { word: "1 Samuel", clue: "Saul is made king in _." },
      { word: "2 Samuel", clue: "David reigns as king in _." },
      { word: "1 Kings", clue: "Solomon builds the temple in _." },
      { word: "2 Kings", clue: "Elijah goes up to heaven in _." },
      { word: "1 Chronicles", clue: "David's line is listed in _." },
      { word: "2 Chronicles", clue: "The kings of Judah fill _." },
      { word: "Ezra", clue: "_ led exiles home from Babylon." },
      { word: "Nehemiah", clue: "_ rebuilt the wall of Jerusalem." },
      { word: "Esther", clue: "_ became queen and saved her people." },

      /* ── Poetry and wisdom ───────────────────────────────────────────── */
      { word: "Job", clue: "_ lost everything and kept trusting God." },
      { word: "Psalms", clue: "_ is the songbook of the Bible." },
      { word: "Proverbs", clue: "_ is full of short wise sayings." },
      { word: "Ecclesiastes", clue: "There is a time for everything in _." },
      { word: "Song of Solomon", clue: "_ is a poem about love." },

      /* ── The major prophets ──────────────────────────────────────────── */
      { word: "Isaiah", clue: "_ promised a child would be born." },
      { word: "Jeremiah", clue: "_ warned Jerusalem before it fell." },
      { word: "Lamentations", clue: "_ is a sad song for Jerusalem." },
      { word: "Ezekiel", clue: "_ saw a valley of dry bones." },
      { word: "Daniel", clue: "_ was thrown to the lions." },

      /* ── The minor prophets ──────────────────────────────────────────── */
      { word: "Hosea", clue: "_ is first of the twelve minor prophets." },
      { word: "Joel", clue: "_ wrote about locusts eating the crops." },
      { word: "Amos", clue: "_ was a shepherd who spoke for God." },
      { word: "Obadiah", clue: "_ is the shortest Old Testament book." },
      { word: "Jonah", clue: "_ was swallowed by a great fish." },
      { word: "Micah", clue: "_ said the king would come from Bethlehem." },
      { word: "Nahum", clue: "_ said Nineveh would fall." },
      { word: "Habakkuk", clue: "_ asked God why the wicked win." },
      { word: "Zephaniah", clue: "_ wrote about a coming day of judgement." },
      { word: "Haggai", clue: "_ told the people to rebuild the temple." },
      { word: "Zechariah", clue: "_ saw visions of a coming king." },
      { word: "Malachi", clue: "_ ends the Old Testament." },
    ],
  },
  {
    id: "bible-books-nt",
    name: "Books of the New Testament",
    group: "Memory work",
    blurb:
      "Matthew to Revelation, in order — the Gospels, Acts, the letters, and one book of visions.",
    emoji: "📖",
    entries: [
      /* ── The Gospels, and what happened next ─────────────────────────── */
      { word: "Matthew", clue: "_ opens the New Testament." },
      { word: "Mark", clue: "_ is the shortest of the four Gospels." },
      { word: "Luke", clue: "_ was a doctor who wrote carefully." },
      { word: "John", clue: "_ was written so people would believe." },
      { word: "Acts", clue: "_ tells what the apostles did next." },

      /* ── The letters Paul wrote ──────────────────────────────────────── */
      { word: "Romans", clue: "_ is the longest letter Paul wrote." },
      { word: "1 Corinthians", clue: "The chapter about love is in _." },
      { word: "2 Corinthians", clue: "God loves a cheerful giver, says _." },
      { word: "Galatians", clue: "The fruit of the Spirit is in _." },
      { word: "Ephesians", clue: "The armour of God is in _." },
      { word: "Philippians", clue: "Paul wrote _ from a prison cell." },
      { word: "Colossians", clue: "_ says Christ is over everything." },
      { word: "1 Thessalonians", clue: "Pray without ceasing comes from _." },
      { word: "2 Thessalonians", clue: "_ tells the lazy to work." },
      { word: "1 Timothy", clue: "Paul wrote _ to a young pastor." },
      { word: "2 Timothy", clue: "Every Scripture is God-breathed, says _." },
      { word: "Titus", clue: "Paul left _ on the island of Crete." },
      { word: "Philemon", clue: "_ asks mercy for a runaway servant." },

      /* ── The letters everyone else wrote, and the visions ─────────────── */
      { word: "Hebrews", clue: "_ says Jesus is the better priest." },
      { word: "James", clue: "_ says faith without works is dead." },
      { word: "1 Peter", clue: "Cast your worries on him, says _." },
      { word: "2 Peter", clue: "The Lord is patient, says _." },
      { word: "1 John", clue: "God is love, says _." },
      { word: "2 John", clue: "_ is written to a chosen lady." },
      { word: "3 John", clue: "_ praises a friend called Gaius." },
      { word: "Jude", clue: "_ warns about false teachers creeping in." },
      { word: "Revelation", clue: "_ is the last book of the Bible." },
    ],
  },
  {
    id: "bible-people",
    name: "People in the Bible",
    group: "Names to know",
    blurb: "Adam to Lydia — the names a child meets first, and one fact each.",
    emoji: "👥",
    // Names only, and never one that is also a book: see rule 1 in the header.
    // The Bible reuses its names — there are three Marys at the cross and two
    // Josephs in the Christmas story — so each sentence names the one meant.
    entries: [
      { word: "Adam", clue: "God made _ from the dust." },
      { word: "Eve", clue: "_ was the first woman." },
      { word: "Noah", clue: "_ built a boat before the flood." },
      { word: "Abraham", clue: "God promised _ a great family." },
      { word: "Sarah", clue: "_ laughed when she heard the news." },
      { word: "Isaac", clue: "_ was the son God promised." },
      { word: "Jacob", clue: "_ had twelve sons." },
      { word: "Joseph", clue: "_ was sold by his brothers." },
      { word: "Moses", clue: "_ was found in a basket." },
      { word: "Aaron", clue: "_ was the first high priest." },
      { word: "Miriam", clue: "_ sang after crossing the sea." },
      { word: "Rahab", clue: "_ hid the spies in Jericho." },
      { word: "Deborah", clue: "_ judged Israel under a palm tree." },
      { word: "Gideon", clue: "_ won with three hundred men." },
      { word: "Samson", clue: "_ was the strongest man." },
      { word: "Naomi", clue: "_ went home to Bethlehem with Ruth." },
      { word: "Hannah", clue: "_ prayed for a son." },
      { word: "Samuel", clue: "_ heard God call at night." },
      { word: "Saul", clue: "_ was the first king of Israel." },
      { word: "David", clue: "_ killed a giant with a sling." },
      { word: "Goliath", clue: "_ was the giant from Gath." },
      { word: "Solomon", clue: "_ asked God for wisdom." },
      { word: "Elijah", clue: "_ was fed by ravens." },
      { word: "Elisha", clue: "_ took over from Elijah." },
      { word: "Mary", clue: "_ was the mother of Jesus." },
      { word: "Elizabeth", clue: "_ was the mother of John the Baptist." },
      { word: "Jesus", clue: "_ was born in Bethlehem." },
      { word: "Peter", clue: "_ walked on the water." },
      { word: "Andrew", clue: "_ was the brother of Peter." },
      { word: "Thomas", clue: "_ wanted to see for himself." },
      { word: "Nicodemus", clue: "_ came to Jesus at night." },
      { word: "Martha", clue: "_ was busy with the serving." },
      { word: "Lazarus", clue: "_ came out of the tomb." },
      { word: "Zacchaeus", clue: "_ climbed a tree to see." },
      { word: "Paul", clue: "_ was blinded on the Damascus road." },
      { word: "Barnabas", clue: "_ travelled with Paul." },
      { word: "Timothy", clue: "_ had a mother and grandmother of faith." },
      { word: "Lydia", clue: "_ sold purple cloth." },
    ],
  },
  {
    id: "bible-places",
    name: "Places in the Bible",
    group: "Names to know",
    blurb: "Eden to Patmos — where the story happens, in the order it happens.",
    emoji: "🗺️",
    // "In the order it happens" is a promise the list has to keep, and the order
    // is the one the sentence beside each place puts it in rather than a rough
    // sense of era: Nineveh before Babylon because Jonah is generations before
    // the exile, the Jordan before Capernaum because the baptism is what Jesus
    // goes to Galilee from, Athens before Corinth and Ephesus because that is
    // Acts 17, 18 and 19 in that order.
    entries: [
      { word: "Eden", clue: "God planted a garden in _." },
      { word: "Ararat", clue: "The ark came to rest on _." },
      { word: "Ur", clue: "Abraham left the city of _." },
      { word: "Canaan", clue: "The promised land was called _." },
      { word: "Egypt", clue: "Joseph was taken down to _." },
      { word: "Sinai", clue: "The commandments were given at _." },
      { word: "Jericho", clue: "The walls fell down at _." },
      { word: "Bethlehem", clue: "David and Jesus were both born in _." },
      { word: "Jerusalem", clue: "David made _ his capital city." },
      { word: "Zion", clue: "Another name for Jerusalem is _." },
      { word: "Nineveh", clue: "Jonah did not want to go to _." },
      { word: "Babylon", clue: "Daniel was carried away to _." },
      { word: "Nazareth", clue: "Jesus grew up in _." },
      { word: "Jordan", clue: "Jesus was baptised in the river _." },
      { word: "Galilee", clue: "Jesus called fishermen beside the sea of _." },
      { word: "Capernaum", clue: "Jesus made his home in _." },
      { word: "Samaria", clue: "The woman at the well came from _." },
      { word: "Bethany", clue: "Lazarus and Martha lived in _." },
      { word: "Gethsemane", clue: "Jesus prayed in the garden of _." },
      { word: "Damascus", clue: "Paul saw a bright light near _." },
      { word: "Antioch", clue: "Believers were first called Christians at _." },
      { word: "Athens", clue: "Paul preached about the unknown god in _." },
      { word: "Corinth", clue: "Paul wrote two letters to _." },
      { word: "Ephesus", clue: "Paul stayed three years at _." },
      { word: "Rome", clue: "Paul was kept under guard in _." },
      { word: "Patmos", clue: "John saw his visions on _." },
    ],
  },
  {
    id: "bible-words",
    name: "Bible words",
    group: "Words to know",
    blurb:
      "Covenant, parable, disciple — the words the stories are told in, each with what it means.",
    emoji: "🕊️",
    // The one list here a spelling card could take as it stands: ordinary
    // lower-case words, one each, and a sentence that is a definition rather
    // than a context. Nothing on it is disputed between traditions — see rule 2
    // in the header for what that leaves out and why.
    entries: [
      { word: "covenant", clue: "A promise God makes is a _." },
      { word: "disciple", clue: "A follower who learns is a _." },
      { word: "apostle", clue: "An _ was sent out with the news." },
      { word: "gospel", clue: "The good news about Jesus is the _." },
      { word: "parable", clue: "A short story that teaches is a _." },
      { word: "psalm", clue: "A song sung to God is a _." },
      { word: "proverb", clue: "A short wise saying is a _." },
      { word: "prophet", clue: "A _ spoke God's messages to people." },
      { word: "temple", clue: "God's house in Jerusalem was the _." },
      { word: "tabernacle", clue: "The tent they carried was the _." },
      { word: "altar", clue: "Offerings were laid on the _." },
      { word: "sacrifice", clue: "Something given up for God is a _." },
      { word: "priest", clue: "A _ offered gifts for the people." },
      { word: "angel", clue: "A messenger from heaven is an _." },
      { word: "ark", clue: "A big wooden boat is an _." },
      { word: "manger", clue: "A box animals eat from is a _." },
      { word: "shepherd", clue: "A _ looks after the sheep." },
      { word: "miracle", clue: "Something only God could do is a _." },
      { word: "faith", clue: "Trusting what you cannot see is _." },
      { word: "grace", clue: "A kindness nobody has earned is _." },
      { word: "mercy", clue: "Not being punished as you deserve is _." },
      { word: "forgive", clue: "To let a wrong go is to _." },
      { word: "repent", clue: "To turn away from wrong is to _." },
      { word: "worship", clue: "Giving God honour and praise is _." },
      { word: "praise", clue: "Saying how great God is means _." },
      { word: "prayer", clue: "Talking with God is called _." },
      { word: "blessing", clue: "A good gift from God is a _." },
      { word: "holy", clue: "Set apart for God means _." },
      { word: "commandment", clue: "A rule God gave is a _." },
      { word: "scripture", clue: "Words written in the Bible are _." },
      { word: "salvation", clue: "Being rescued from sin is _." },
      { word: "resurrection", clue: "Coming back to life is the _." },
      { word: "exile", clue: "Being taken far from home is _." },
      { word: "idol", clue: "A statue people worship is an _." },
      { word: "sin", clue: "Going against what God says is _." },
      { word: "testament", clue: "Each half of the Bible is a _." },
      { word: "amen", clue: "Saying _ means let it be so." },
    ],
  },
];
