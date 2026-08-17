/**
 * The words phonics may put on a page, each one cut into the spellings it is
 * actually made of.
 *
 * Hand-segmented, for the reason `words/bank.ts` gives for hand-authoring its
 * answers and then some: **there is no algorithm that cuts an English word into
 * graphemes.** `ea` is one spelling in `bread` and two in `react`; the `e` of
 * `cake` belongs to the `a` four letters earlier; `think` has no /n/ in it. A
 * generator reaching for a rule would decide that `duck` needs `c` and `k`
 * separately and hand it to a child who has been taught neither — which is the
 * exact failure the sound inventory exists to prevent, arriving through the
 * back door.
 *
 * So every word below was cut by hand, and `phonics.test.ts` puts the pieces
 * back together and checks they spell the word again. That test is what makes
 * the constraint trustworthy: a mis-cut word is a word that gets offered to the
 * wrong child, and it is invisible in a diff.
 *
 * ── Words that are not here, on purpose ────────────────────────────────────
 *
 * A sheet is printed on both sides of the Atlantic, and a word whose sounds
 * depend on the reader's accent cannot be put on a sound-matching line without
 * marking somebody's child wrong. Those words are excluded here rather than
 * guarded against later:
 *
 *   - **The `bath` set.** `bath`, `grass`, `class`, `ask`, `after`, `last`,
 *     `can't`, `half`, `path` — `/a/` in America, `/ah/` in southern England.
 *     There is no cut that is true in both places.
 *   - **`with`.** Ends in the sound of `thin` for most Americans and the sound
 *     of `this` in England, and those are two different tick boxes.
 *   - **`new`, `tune`, `duke`, `stew`.** After `t`, `d` and `n` the `y` of
 *     `few` is said in England and dropped in most of America. `few`, `cube`
 *     and `cute` keep it everywhere, so those are the ones here.
 *   - **`was` and `water`.** The `a` after a `w` is a different vowel in the
 *     two places — `was` has the vowel of `cup` for many Americans and of `dog`
 *     in England, and `water` has the vowel of `saw` in England. `want`,
 *     `wash` and `watch`, which agree, are here.
 *
 * Words whose *vowel* differs while its identity doesn't — everything using
 * `/o/`, `/aw/` or an r-coloured vowel — are fine and are here, because both
 * varieties agree about which words share a vowel. `variesByAccent` names them
 * for the one sheet style that has to care: hearing two sounds apart.
 */
import { CORRESPONDENCE_BY_ID, PHONEME_BY_ID, spellingId } from "./sounds";

export type Word = {
  /** As it is printed. Lower case; a sheet decides its own capitals. */
  word: string;
  /**
   * The spellings it is made of, in reading order, as correspondence ids.
   * `cake` is `["c:k", "a_e:ai", "k:k"]` — the split vowel owns the final `e`.
   */
  parts: string[];
};

/**
 * One word, written the way it is read: the spellings, spaced apart.
 *
 * A bare grapheme means its commonest sound, so `c a t` is exactly what it
 * looks like and only the surprises are spelled out — `b r ea:e d` is `bread`,
 * and the `ea:e` is the whole reason the word is worth having. See
 * `spellingId` for what a part that names nothing does, which is fail a test
 * rather than print.
 */
const w = (word: string, spelling: string): Word => ({
  word,
  parts: spelling.split(" ").map(spellingId),
});

/* ── The short vowels, three sounds at a time ─────────────────────────────
   Where every programme starts and where most of a first year is spent. The
   order inside each vowel is roughly the order the letters are taught in, so
   a parent who has ticked six letters gets the words at the top of the list
   rather than a scattering from the bottom.                                */

const SHORT_A: Word[] = [
  w("at", "a t"),
  w("sat", "s a t"),
  w("pat", "p a t"),
  w("cat", "c a t"),
  w("hat", "h a t"),
  w("mat", "m a t"),
  w("bat", "b a t"),
  w("rat", "r a t"),
  w("fat", "f a t"),
  w("an", "a n"),
  w("man", "m a n"),
  w("can", "c a n"),
  w("pan", "p a n"),
  w("ran", "r a n"),
  w("fan", "f a n"),
  w("van", "v a n"),
  w("tap", "t a p"),
  w("map", "m a p"),
  w("cap", "c a p"),
  w("lap", "l a p"),
  w("gap", "g a p"),
  w("nap", "n a p"),
  w("bag", "b a g"),
  w("tag", "t a g"),
  w("rag", "r a g"),
  w("wag", "w a g"),
  w("bad", "b a d"),
  w("sad", "s a d"),
  w("mad", "m a d"),
  w("pad", "p a d"),
  w("ham", "h a m"),
  w("jam", "j a m"),
  w("ram", "r a m"),
  w("cab", "c a b"),
  w("lad", "l a d"),
];

const SHORT_I: Word[] = [
  w("it", "i t"),
  w("sit", "s i t"),
  w("pit", "p i t"),
  w("hit", "h i t"),
  w("bit", "b i t"),
  w("fit", "f i t"),
  w("in", "i n"),
  w("pin", "p i n"),
  w("tin", "t i n"),
  w("win", "w i n"),
  w("bin", "b i n"),
  w("fin", "f i n"),
  w("pig", "p i g"),
  w("big", "b i g"),
  w("dig", "d i g"),
  w("fig", "f i g"),
  w("wig", "w i g"),
  w("lid", "l i d"),
  w("did", "d i d"),
  w("hid", "h i d"),
  w("kid", "k i d"),
  w("lip", "l i p"),
  w("tip", "t i p"),
  w("rip", "r i p"),
  w("dip", "d i p"),
  w("hip", "h i p"),
  w("zip", "z i p"),
  w("rib", "r i b"),
  w("six", "s i x"),
  w("mix", "m i x"),
  w("fix", "f i x"),
];

const SHORT_E: Word[] = [
  w("bed", "b e d"),
  w("red", "r e d"),
  w("fed", "f e d"),
  w("led", "l e d"),
  w("ten", "t e n"),
  w("hen", "h e n"),
  w("pen", "p e n"),
  w("men", "m e n"),
  w("den", "d e n"),
  w("net", "n e t"),
  w("pet", "p e t"),
  w("wet", "w e t"),
  w("get", "g e t"),
  w("jet", "j e t"),
  w("let", "l e t"),
  w("leg", "l e g"),
  w("peg", "p e g"),
  w("beg", "b e g"),
  w("web", "w e b"),
  w("yes", "y e s"),
];

const SHORT_O: Word[] = [
  w("on", "o n"),
  w("dog", "d o g"),
  w("log", "l o g"),
  w("fog", "f o g"),
  w("hop", "h o p"),
  w("top", "t o p"),
  w("mop", "m o p"),
  w("pop", "p o p"),
  w("cot", "c o t"),
  w("dot", "d o t"),
  w("hot", "h o t"),
  w("pot", "p o t"),
  w("not", "n o t"),
  w("rod", "r o d"),
  w("nod", "n o d"),
  w("job", "j o b"),
  w("sob", "s o b"),
  w("box", "b o x"),
  w("fox", "f o x"),
  w("ox", "o x"),
];

const SHORT_U: Word[] = [
  w("up", "u p"),
  w("us", "u s"),
  w("bug", "b u g"),
  w("hug", "h u g"),
  w("mug", "m u g"),
  w("rug", "r u g"),
  w("jug", "j u g"),
  w("bun", "b u n"),
  w("fun", "f u n"),
  w("run", "r u n"),
  w("sun", "s u n"),
  w("cup", "c u p"),
  w("pup", "p u p"),
  w("cut", "c u t"),
  w("but", "b u t"),
  w("hut", "h u t"),
  w("nut", "n u t"),
  w("mud", "m u d"),
  w("bud", "b u d"),
  w("tub", "t u b"),
  w("rub", "r u b"),
  w("cub", "c u b"),
];

/* ── Two letters, one sound ───────────────────────────────────────────────
   The doubles at the end of a short word, and `ck` — a child who has been
   taught `k` has not been taught `duck`, which is why the doubles are their
   own tick boxes rather than a spelling rule applied quietly. The same two
   letters land in the middle of a longer word for the same reason (`rabbit`
   keeps its vowel short), so those live here too rather than in a group of
   their own.                                                                */

const DOUBLED: Word[] = [
  w("duck", "d u ck"),
  w("sock", "s o ck"),
  w("rock", "r o ck"),
  w("lock", "l o ck"),
  w("kick", "k i ck"),
  w("pick", "p i ck"),
  w("sick", "s i ck"),
  w("back", "b a ck"),
  w("sack", "s a ck"),
  w("pack", "p a ck"),
  w("neck", "n e ck"),
  w("bell", "b e ll"),
  w("tell", "t e ll"),
  w("well", "w e ll"),
  w("fell", "f e ll"),
  w("hill", "h i ll"),
  w("will", "w i ll"),
  w("fill", "f i ll"),
  w("doll", "d o ll"),
  w("miss", "m i ss"),
  w("kiss", "k i ss"),
  w("mess", "m e ss"),
  w("less", "l e ss"),
  w("off", "o ff"),
  w("puff", "p u ff"),
  w("cliff", "c l i ff"),
  w("buzz", "b u zz"),
  w("fizz", "f i zz"),
  w("egg", "e gg"),
  w("rabbit", "r a bb i t"),
];

/* ── The consonant digraphs ───────────────────────────────────────────────
   `sh`, `ch`, `th` twice over, `ng`, `wh`, `ph` — and the `n` of `think`,
   which is a /ng/ nobody writes down. The two `th` sets are kept apart
   deliberately: `this` is not readable to a child who has only met `thin`.  */

const DIGRAPHS: Word[] = [
  w("ship", "sh i p"),
  w("shop", "sh o p"),
  w("shed", "sh e d"),
  w("shut", "sh u t"),
  w("shell", "sh e ll"),
  w("fish", "f i sh"),
  w("dish", "d i sh"),
  w("wish", "w i sh"),
  w("cash", "c a sh"),
  w("dash", "d a sh"),
  w("rush", "r u sh"),
  w("chin", "ch i n"),
  w("chip", "ch i p"),
  w("chop", "ch o p"),
  w("chat", "ch a t"),
  w("chick", "ch i ck"),
  w("much", "m u ch"),
  w("such", "s u ch"),
  w("rich", "r i ch"),
  w("thin", "th i n"),
  w("thick", "th i ck"),
  w("moth", "m o th"),
  w("this", "th:dh i s"),
  w("that", "th:dh a t"),
  w("then", "th:dh e n"),
  w("them", "th:dh e m"),
  w("king", "k i ng"),
  w("ring", "r i ng"),
  w("sing", "s i ng"),
  w("wing", "w i ng"),
  w("long", "l o ng"),
  w("song", "s o ng"),
  w("bang", "b a ng"),
  w("hang", "h a ng"),
  w("sung", "s u ng"),
  w("think", "th i n:ng k"),
  w("bank", "b a n:ng k"),
  w("pink", "p i n:ng k"),
  w("sink", "s i n:ng k"),
  w("junk", "j u n:ng k"),
  w("thank", "th a n:ng k"),
  w("when", "wh e n"),
  w("whip", "wh i p"),
  w("which", "wh i ch"),
  w("quit", "qu i t"),
  w("quick", "qu i ck"),
  w("quiz", "qu i z"),
];

/* ── Blends ───────────────────────────────────────────────────────────────
   No new spellings at all — two consonants said one after the other, each
   still saying its own sound. Which is exactly why they belong in the bank
   rather than in the tick list: a child who has `s` and `t` can read `stop`,
   and an inventory that made them tick `st` would be teaching a fiction.    */

const BLENDS: Word[] = [
  w("stop", "s t o p"),
  w("step", "s t e p"),
  w("spin", "s p i n"),
  w("spot", "s p o t"),
  w("snap", "s n a p"),
  w("slip", "s l i p"),
  w("slam", "s l a m"),
  w("sled", "s l e d"),
  w("swim", "s w i m"),
  w("skip", "s k i p"),
  w("flag", "f l a g"),
  w("flat", "f l a t"),
  w("flip", "f l i p"),
  w("plan", "p l a n"),
  w("plum", "p l u m"),
  w("clap", "c l a p"),
  w("club", "c l u b"),
  w("glad", "g l a d"),
  w("grin", "g r i n"),
  w("grab", "g r a b"),
  w("crab", "c r a b"),
  w("crib", "c r i b"),
  w("drum", "d r u m"),
  w("drip", "d r i p"),
  w("trip", "t r i p"),
  w("frog", "f r o g"),
  w("from", "f r o m"),
  w("brick", "b r i ck"),
  w("black", "b l a ck"),
  w("stand", "s t a n d"),
  w("stamp", "s t a m p"),
  w("string", "s t r i ng"),
  w("strong", "s t r o ng"),
  w("spring", "s p r i ng"),
  w("hand", "h a n d"),
  w("land", "l a n d"),
  w("sand", "s a n d"),
  w("band", "b a n d"),
  w("bend", "b e n d"),
  w("send", "s e n d"),
  w("lend", "l e n d"),
  w("pond", "p o n d"),
  w("jump", "j u m p"),
  w("lamp", "l a m p"),
  w("camp", "c a m p"),
  w("damp", "d a m p"),
  w("tent", "t e n t"),
  w("went", "w e n t"),
  w("sent", "s e n t"),
  w("best", "b e s t"),
  w("nest", "n e s t"),
  w("rest", "r e s t"),
  w("test", "t e s t"),
  w("must", "m u s t"),
  w("dust", "d u s t"),
  w("just", "j u s t"),
  w("lost", "l o s t"),
  w("list", "l i s t"),
  w("fist", "f i s t"),
  w("milk", "m i l k"),
  w("silk", "s i l k"),
  w("help", "h e l p"),
  w("belt", "b e l t"),
  w("melt", "m e l t"),
  w("gift", "g i f t"),
  w("lift", "l i f t"),
  w("soft", "s o f t"),
  w("desk", "d e s k"),
];

/* ── A vowel that says its own name ───────────────────────────────────────
   The split vowel first — `a_e` is one spelling with a consonant standing in
   the middle of it, which is why `graphemeParts` exists — then the letters
   that go long at the end of a syllable.                                    */

const SPLIT_VOWELS: Word[] = [
  w("cake", "c a_e k"),
  w("lake", "l a_e k"),
  w("make", "m a_e k"),
  w("take", "t a_e k"),
  w("name", "n a_e m"),
  w("game", "g a_e m"),
  w("came", "c a_e m"),
  w("gate", "g a_e t"),
  w("late", "l a_e t"),
  w("date", "d a_e t"),
  w("wave", "w a_e v"),
  w("cave", "c a_e v"),
  w("save", "s a_e v"),
  w("snake", "s n a_e k"),
  w("plate", "p l a_e t"),
  w("grape", "g r a_e p"),
  w("shape", "sh a_e p"),
  w("time", "t i_e m"),
  w("five", "f i_e v"),
  w("nine", "n i_e n"),
  w("line", "l i_e n"),
  w("bike", "b i_e k"),
  w("like", "l i_e k"),
  w("ride", "r i_e d"),
  w("side", "s i_e d"),
  w("wide", "w i_e d"),
  w("hide", "h i_e d"),
  w("smile", "s m i_e l"),
  w("white", "wh i_e t"),
  w("bite", "b i_e t"),
  w("kite", "k i_e t"),
  w("home", "h o_e m"),
  w("hope", "h o_e p"),
  w("rope", "r o_e p"),
  w("nose", "n o_e s:z"),
  w("rose", "r o_e s:z"),
  w("bone", "b o_e n"),
  w("stone", "s t o_e n"),
  w("hole", "h o_e l"),
  w("note", "n o_e t"),
  w("those", "th:dh o_e s:z"),
  w("cube", "c u_e:y-oo b"),
  w("cute", "c u_e:y-oo t"),
  w("use", "u_e:y-oo s:z"),
  w("flute", "f l u_e t"),
  w("rule", "r u_e l"),
  w("these", "th:dh e_e s:z"),
  w("go", "g o:oa"),
  w("no", "n o:oa"),
  w("so", "s o:oa"),
  w("me", "m e:ee"),
  w("be", "b e:ee"),
  w("he", "h e:ee"),
  w("we", "w e:ee"),
  w("she", "sh e:ee"),
  w("cold", "c o:oa l d"),
  w("old", "o:oa l d"),
  w("gold", "g o:oa l d"),
  w("told", "t o:oa l d"),
  w("hold", "h o:oa l d"),
  w("wild", "w i:ie l d"),
  w("mild", "m i:ie l d"),
  w("kind", "k i:ie n d"),
  w("find", "f i:ie n d"),
  w("mind", "m i:ie n d"),
  w("child", "ch i:ie l d"),
];

/* ── Vowel teams ──────────────────────────────────────────────────────────
   Two letters that make one vowel, and the place the many-to-many in
   `sounds.ts` stops being theoretical: `bread` and `eat` are the same two
   letters and a year apart.                                                 */

const VOWEL_TEAMS: Word[] = [
  w("rain", "r ai n"),
  w("train", "t r ai n"),
  w("wait", "w ai t"),
  w("paint", "p ai n t"),
  w("tail", "t ai l"),
  w("nail", "n ai l"),
  w("sail", "s ai l"),
  w("chain", "ch ai n"),
  w("snail", "s n ai l"),
  w("day", "d ay"),
  w("play", "p l ay"),
  w("say", "s ay"),
  w("way", "w ay"),
  w("may", "m ay"),
  w("stay", "s t ay"),
  w("tray", "t r ay"),
  w("away", "a:uh w ay"),
  w("see", "s ee"),
  w("tree", "t r ee"),
  w("feet", "f ee t"),
  w("feel", "f ee l"),
  w("week", "w ee k"),
  w("sleep", "s l ee p"),
  w("green", "g r ee n"),
  w("three", "th r ee"),
  w("deep", "d ee p"),
  w("keep", "k ee p"),
  w("sweet", "s w ee t"),
  w("street", "s t r ee t"),
  w("eat", "ea t"),
  w("sea", "s ea"),
  w("tea", "t ea"),
  w("leaf", "l ea f"),
  w("clean", "c l ea n"),
  w("dream", "d r ea m"),
  w("teach", "t ea ch"),
  w("beach", "b ea ch"),
  w("each", "ea ch"),
  w("meat", "m ea t"),
  w("seat", "s ea t"),
  w("speak", "s p ea k"),
  w("bread", "b r ea:e d"),
  w("head", "h ea:e d"),
  w("boat", "b oa t"),
  w("coat", "c oa t"),
  w("road", "r oa d"),
  w("soap", "s oa p"),
  w("toast", "t oa s t"),
  w("goat", "g oa t"),
  w("snow", "s n ow:oa"),
  w("blow", "b l ow:oa"),
  w("grow", "g r ow:oa"),
  w("slow", "s l ow:oa"),
  w("throw", "th r ow:oa"),
  w("yellow", "y e ll ow:oa"),
  w("toe", "t oe"),
  w("night", "n igh t"),
  w("light", "l igh t"),
  w("right", "r igh t"),
  w("bright", "b r igh t"),
  w("fight", "f igh t"),
  w("high", "h igh"),
  w("pie", "p ie:ie"),
  w("tie", "t ie:ie"),
  w("my", "m y:ie"),
  w("by", "b y:ie"),
  w("cry", "c r y:ie"),
  w("dry", "d r y:ie"),
  w("fly", "f l y:ie"),
  w("sky", "s k y:ie"),
  w("try", "t r y:ie"),
  w("why", "wh y:ie"),
  w("moon", "m oo n"),
  w("soon", "s oo n"),
  w("food", "f oo d"),
  w("room", "r oo m"),
  w("pool", "p oo l"),
  w("tooth", "t oo th"),
  w("spoon", "s p oo n"),
  w("zoo", "z oo"),
  w("broom", "b r oo m"),
  w("book", "b oo:uu k"),
  w("look", "l oo:uu k"),
  w("took", "t oo:uu k"),
  w("cook", "c oo:uu k"),
  w("foot", "f oo:uu t"),
  w("wood", "w oo:uu d"),
  w("good", "g oo:uu d"),
  w("stood", "s t oo:uu d"),
  w("put", "p u:uu t"),
  w("blue", "b l ue"),
  w("glue", "g l ue"),
  w("true", "t r ue"),
  w("fruit", "f r ui:oo t"),
  w("juice", "j ui:oo c:s e:-"),
  w("flew", "f l ew"),
  w("grew", "g r ew"),
  w("chew", "ch ew"),
  w("screw", "s c r ew"),
  w("few", "f ew:y-oo"),
  w("out", "ou t"),
  w("loud", "l ou d"),
  w("cloud", "c l ou d"),
  w("round", "r ou n d"),
  w("sound", "s ou n d"),
  w("found", "f ou n d"),
  w("mouth", "m ou th"),
  w("shout", "sh ou t"),
  w("house", "h ou s e:-"),
  // Both sounds of `ow` are written out in full, here and in the `snow` group
  // above. The bare shorthand would resolve to whichever row `sounds.ts` lists
  // first — and `ow` is the one grapheme in the table whose two sounds are both
  // ordinary, so there is no "commonest" to lean on and no reading of `c ow`
  // that isn't a guess about the table's order.
  w("cow", "c ow:ow"),
  w("how", "h ow:ow"),
  w("now", "n ow:ow"),
  w("down", "d ow:ow n"),
  w("town", "t ow:ow n"),
  w("brown", "b r ow:ow n"),
  w("clown", "c l ow:ow n"),
  w("crown", "c r ow:ow n"),
  w("coin", "c oi n"),
  w("join", "j oi n"),
  w("point", "p oi n t"),
  w("boil", "b oi l"),
  w("soil", "s oi l"),
  w("boy", "b oy"),
  w("toy", "t oy"),
  w("joy", "j oy"),
  w("saw", "s aw"),
  w("paw", "p aw"),
  w("draw", "d r aw"),
  w("straw", "s t r aw"),
  w("claw", "c l aw"),
  w("lawn", "l aw n"),
  w("yawn", "y aw n"),
  w("crawl", "c r aw l"),
  w("haul", "h au l"),
  w("sauce", "s au c:s e:-"),
  w("ball", "b a:aw ll"),
  w("call", "c a:aw ll"),
  w("fall", "f a:aw ll"),
  w("tall", "t a:aw ll"),
  w("wall", "w a:aw ll"),
  w("small", "s m a:aw ll"),
  w("walk", "w al k"),
  w("talk", "t al k"),
  w("chalk", "ch al k"),
  w("happy", "h a pp y:ee"),
  w("sunny", "s u nn y:ee"),
  w("funny", "f u nn y:ee"),
  w("puppy", "p u pp y:ee"),
  w("silly", "s i ll y:ee"),
  // The doubled `r`, and the one place it can be put without picking an
  // accent: the vowel of `bed` before it is the same on both sides, where
  // `sorry` and `carry` are the vowel of `dog` or of `cat` in one place and
  // something else in the other. See the note at the top of this file.
  w("cherry", "ch e rr y:ee"),
  w("baby", "b a:ai b y:ee"),
  w("paper", "p a:ai p er"),
  w("hello", "h e ll o:oa"),
];

/* ── The r-coloured vowels ────────────────────────────────────────────────
   Three spellings for the vowel of `her` and three sounds for the letters of
   `ear`, which between them make the case for the whole model. Rhotic or not,
   the letters are the same — see the accent note in `sounds.ts`.             */

const R_VOWELS: Word[] = [
  w("car", "c ar"),
  w("far", "f ar"),
  w("star", "s t ar"),
  w("jar", "j ar"),
  w("arm", "ar m"),
  w("farm", "f ar m"),
  w("card", "c ar d"),
  w("hard", "h ar d"),
  w("yard", "y ar d"),
  w("park", "p ar k"),
  w("dark", "d ar k"),
  w("shark", "sh ar k"),
  w("sharp", "sh ar p"),
  w("start", "s t ar t"),
  w("part", "p ar t"),
  w("smart", "s m ar t"),
  w("barn", "b ar n"),
  w("garden", "g ar d e:uh n"),
  w("for", "f or"),
  w("fork", "f or k"),
  w("corn", "c or n"),
  w("horn", "h or n"),
  w("born", "b or n"),
  w("sort", "s or t"),
  w("short", "sh or t"),
  w("sport", "s p or t"),
  w("storm", "s t or m"),
  w("north", "n or th"),
  w("more", "m ore"),
  w("store", "s t ore"),
  w("score", "s c ore"),
  w("door", "d oor"),
  w("floor", "f l oor"),
  w("four", "f our"),
  w("your", "y our"),
  w("her", "h er"),
  w("herd", "h er d"),
  w("term", "t er m"),
  w("father", "f a:ah th:dh er"),
  w("letter", "l e tt er"),
  w("summer", "s u mm er"),
  w("sister", "s i s t er"),
  w("better", "b e tt er"),
  w("under", "u n d er"),
  w("over", "o:oa v er"),
  w("never", "n e v er"),
  w("winter", "w i n t er"),
  w("bird", "b ir d"),
  w("girl", "g ir l"),
  w("first", "f ir s t"),
  w("shirt", "sh ir t"),
  w("third", "th ir d"),
  w("dirt", "d ir t"),
  w("turn", "t ur n"),
  w("burn", "b ur n"),
  w("hurt", "h ur t"),
  w("curl", "c ur l"),
  w("nurse", "n ur s e:-"),
  w("church", "ch ur ch"),
  w("earth", "ear:er th"),
  w("learn", "l ear:er n"),
  w("heard", "h ear:er d"),
  w("hair", "h air"),
  w("chair", "ch air"),
  w("care", "c are"),
  w("share", "sh are"),
  w("bear", "b ear:air"),
  w("pear", "p ear:air"),
  w("wear", "w ear:air"),
  w("hear", "h ear:eer"),
  w("near", "n ear:eer"),
  w("year", "y ear:eer"),
  w("ear", "ear:eer"),
  w("dear", "d ear:eer"),
  w("clear", "c l ear:eer"),
  w("deer", "d eer"),
  w("cheer", "ch eer"),
  w("here", "h ere:eer"),
];

/* ── The letters that hide ────────────────────────────────────────────────
   `kn`, `gn`, `wr`, `mb`, and the endings that only ever come after a short
   vowel. All of them are spellings with a rule behind them, so all of them
   are tickable — the words that follow no rule at all are the next group
   down.                                                                     */

const QUIET_LETTERS: Word[] = [
  w("knee", "kn ee"),
  w("know", "kn ow:oa"),
  w("knit", "kn i t"),
  w("knock", "kn o ck"),
  w("knife", "kn i_e f"),
  w("gnat", "gn a t"),
  w("write", "wr i_e t"),
  w("wrong", "wr o ng"),
  w("wrap", "wr a p"),
  w("wrist", "wr i s t"),
  w("comb", "c o:oa mb"),
  w("thumb", "th u mb"),
  w("lamb", "l a mb"),
  w("climb", "c l i:ie mb"),
  w("catch", "c a tch"),
  w("match", "m a tch"),
  w("watch", "w a:o tch"),
  w("fetch", "f e tch"),
  w("ditch", "d i tch"),
  w("kitchen", "k i tch e:uh n"),
  w("bridge", "b r i dge"),
  w("edge", "e dge"),
  w("badge", "b a dge"),
  w("judge", "j u dge"),
  w("fudge", "f u dge"),
  w("large", "l ar ge"),
  w("age", "a:ai ge"),
  w("cage", "c a:ai ge"),
  w("page", "p a:ai ge"),
  w("huge", "h u:y-oo ge"),
  w("stage", "s t a:ai ge"),
  w("city", "c:s i t y:ee"),
  w("ice", "i_e c:s"),
  w("nice", "n i_e c:s"),
  w("mice", "m i_e c:s"),
  w("rice", "r i_e c:s"),
  w("face", "f a_e c:s"),
  w("race", "r a_e c:s"),
  w("place", "p l a_e c:s"),
  w("prince", "p r i n c:s e:-"),
  w("fence", "f e n c:s e:-"),
  w("since", "s i n c:s e:-"),
  w("giant", "g:j i:ie a:uh n t"),
  w("magic", "m a g:j i c"),
  w("little", "l i tt le"),
  w("apple", "a pp le"),
  w("table", "t a:ai b le"),
  w("bottle", "b o tt le"),
  w("middle", "m i dd le"),
  w("candle", "c a n d le"),
  w("phone", "ph o_e n"),
  w("dolphin", "d o l ph i n"),
  w("elephant", "e l e:uh ph a:uh n t"),
  w("school", "s ch:k oo l"),
];

/* ── Spellings that only happen somewhere ─────────────────────────────────
   A letter can be told what to say by the letter in front of it. `w` is the
   loudest of them — it turns `a` into the vowel of `wash` and `ar` into the
   vowel of `warm` — and the silent `e` on the end of `have` is the same kind
   of fact: not a sound, a position. Each is a tick box of its own, because a
   child reading `was` as if it rhymed with `gas` has been taught `w`, `a` and
   `s` and nothing that would tell them otherwise.                           */

const POSITIONS: Word[] = [
  w("have", "h a v e:-"),
  w("give", "g i v e:-"),
  w("live", "l i v e:-"),
  w("gone", "g o n e:-"),
  w("because", "b e:uh c au s:z e:-"),
  w("the", "th:dh e:uh"),
  w("want", "w a:o n t"),
  w("wash", "w a:o sh"),
  w("word", "w or:er d"),
  w("work", "w or:er k"),
  w("war", "w ar:or"),
  w("warm", "w ar:or m"),
  w("music", "m u:y-oo s:z i c"),
  w("eight", "eigh t"),
  w("key", "k ey"),
  w("chief", "ch ie f"),
];

/* ── The ones that follow nothing ─────────────────────────────────────────
   Every word here uses a spelling marked `odd` in `sounds.ts`, which is what
   makes it unreachable by ticking sounds — the only way one of these reaches
   a page is a parent putting the word itself on their `tricky` list, which is
   exactly how a programme teaches them. The cuts are still honest: `ai`
   really does say /e/ in `said`, and saying so is how a sheet can print the
   awkward part in a different weight (§13).                                 */

const TRICKY: Word[] = [
  w("said", "s ai:e d"),
  w("again", "a:uh g ai:e n"),
  w("money", "m o:u n ey"),
  w("any", "a:e n y:ee"),
  w("many", "m a:e n y:ee"),
  w("one", "o:w-u n e:-"),
  w("two", "t w:- o:oo"),
  w("to", "t o:oo"),
  w("do", "d o:oo"),
  w("who", "wh:h o:oo"),
  w("love", "l o:u v e:-"),
  w("come", "c o:u m e:-"),
  w("some", "s o:u m e:-"),
  w("done", "d o:u n e:-"),
  w("month", "m o:u n th"),
  w("mother", "m o:u th:dh er"),
  w("other", "o:u th:dh er"),
  w("brother", "b r o:u th:dh er"),
  w("touch", "t ou:u ch"),
  w("young", "y ou:u ng"),
  w("friend", "f r ie:e n d"),
  w("build", "b ui:i l d"),
  w("gym", "g:j y:i m"),
  w("where", "wh ere:air"),
  w("there", "th:dh ere:air"),
  w("were", "w ere:er"),
  w("great", "g r ea:ai t"),
  w("listen", "l i s t:- e:uh n"),
];

/**
 * Every word this build may print, in teaching order.
 *
 * One flat list rather than a map of groups, because the groups above are a
 * writing aid and not a curriculum: what a word is available for is decided by
 * the sounds in it and nothing else, and a sheet that drew from "the digraph
 * group" would hand a child `chick` because of the `ch` and the `ck` they
 * hadn't been taught.
 */
export const WORDS: Word[] = [
  ...SHORT_A,
  ...SHORT_I,
  ...SHORT_E,
  ...SHORT_O,
  ...SHORT_U,
  ...DOUBLED,
  ...DIGRAPHS,
  ...BLENDS,
  ...SPLIT_VOWELS,
  ...VOWEL_TEAMS,
  ...R_VOWELS,
  ...QUIET_LETTERS,
  ...POSITIONS,
  ...TRICKY,
];

export const WORD_BY_SPELLING = new Map(
  WORDS.map((entry) => [entry.word, entry]),
);

/** The sounds a word is made of, in order — what a blending line says aloud. */
export function wordSounds(entry: Word): string[] {
  return entry.parts.flatMap(
    (part) => CORRESPONDENCE_BY_ID.get(part)?.phonemes ?? [],
  );
}

/**
 * True when the word can't be reached by ticking sounds.
 *
 * Derived rather than authored, so the two can't disagree: a word is tricky
 * exactly when one of its spellings is one no inventory may hold. Which means
 * marking a spelling `odd` in `sounds.ts` moves every word that uses it in one
 * edit, rather than leaving a flag behind on each.
 */
export function isTricky(entry: Word): boolean {
  return entry.parts.some((part) => CORRESPONDENCE_BY_ID.get(part)?.odd);
}

/**
 * True when General American and RP disagree about one of the word's sounds.
 *
 * Not a defect and not a reason to drop a word — `dog` and `car` are here and
 * are fine. It matters for exactly one kind of exercise: asking a child to
 * *tell two sounds apart*, where a merged pair makes the question unanswerable
 * for half the children who see it. A sheet that asks that can filter on this;
 * everything else can ignore it.
 */
export function variesByAccent(entry: Word): boolean {
  return wordSounds(entry).some((sound) => PHONEME_BY_ID.get(sound)?.varies);
}
