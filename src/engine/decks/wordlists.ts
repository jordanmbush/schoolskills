/**
 * The Dolch sight words, graded, each with a sentence to hear it in.
 *
 * Edward Dolch's 1936 lists are the standard set of high-frequency words that
 * don't reliably yield to phonics — "said", "because", "one" — which is
 * exactly why they're worth drilling by recall rather than sounding out.
 *
 * Graded by AGE rather than by school year on purpose. Dolch's own grades are
 * American ("pre-primer", "primer", "first grade"), this codebase is written
 * in British English, and the mapping between the two systems is approximate
 * anyway. An age band means the same thing in both, and it's what a parent
 * picking a list for their own child actually reasons about.
 *
 * Fry's first 100 is deliberately NOT here as well: roughly four fifths of it
 * is already in Dolch, so a second near-identical list is choice paralysis
 * rather than choice. Parent-authored lists are the answer for anything these
 * don't cover.
 *
 * ── Why every word carries a sentence ───────────────────────────────────────
 * A spoken word on its own is not a fair spelling test, for two reasons that
 * both bite hardest on exactly these lists.
 *
 * The first is homophones. "Their", "there" and "they're" are one sound. So
 * are its/it's, to/too/two, one/won, ate/eight, no/know, our/hour, buy/by,
 * right/write, new/knew, four/for, some/sum, been/bean, made/maid,
 * night/knight, flower/flour, bear/bare, horse/hoarse, sun/son, way/weigh,
 * wood/would. A child asked to spell the sound cannot be wrong, because there
 * is no answer — and Dolch's lists are dense with them, since the commonest
 * words are the ones English has most collisions in.
 *
 * its/it's is the one people query, so: "The dog wagged _ tail" is possessive,
 * and possessive pronouns take no apostrophe — my, your, his, her, its, our,
 * their. "it's" is only ever a contraction of "it is", which cannot follow
 * "wagged". The card is doing what the card for their/there does, and the
 * sentence is what makes either answerable. Don't soften this one into
 * something that fits both spellings; a clue that fits both settles nothing.
 *
 * The second is the voice. These are read by whatever speech engine the device
 * happens to have, and those enunciate unevenly: "sleep" and "sleeve" are one
 * mumbled consonant apart on several of them. A sentence repairs a mis-heard
 * phoneme the way context always does.
 *
 * So the sentence is not decoration; it's what makes the card answerable. It
 * is a template with `_` marking the slot, which lets one string do both jobs:
 * spoken it reads naturally with the word in place, and on screen it's shown
 * with the slot blank, so a reader gets the context without the spelling.
 *
 * ── House rules for writing one ─────────────────────────────────────────────
 *   - Short. Three to seven words; it is read aloud on a clock.
 *   - Exactly one `_`, and the word must not appear anywhere else in it.
 *   - Not sentence-initial where it can be avoided, so the displayed sentence
 *     starts with a capital rather than a blank.
 *   - For a homophone, the sentence must actually settle which word is meant.
 *     "It is _ hot" for "too" earns its place; "I like _" would not.
 *   - No sentence twice, across all the lists. One that fits two answers isn't
 *     naming its word, it's just context — and a child who meets both cards
 *     sees one screen with two different right answers and concludes, fairly,
 *     that the game is broken.
 *   - Things a child of that age can picture. Concrete beats clever.
 * `wordlists.test.ts` enforces the mechanical half of that list.
 */

import { BIBLE_LISTS } from "./biblelists";

export type WordEntry = {
  word: string;
  /**
   * The word in a short sentence, with `_` where the word goes.
   *
   * One template, two jobs: `_` is replaced by the word to be spoken, and
   * rendered as a blank on screen. See the note above for why both.
   */
  clue: string;
};

export type WordList = {
  id: string;
  name: string;
  /**
   * Who it's for, in the terms a parent will pick by — an age band on a graded
   * list, and what the list is for on one that isn't graded ("Memory work").
   */
  group: string;
  blurb: string;
  emoji: string;
  entries: WordEntry[];
};

/** Just the words, for the places that count or list them. */
export const listWords = (list: WordList): string[] =>
  list.entries.map((e) => e.word);

export const WORD_LISTS: WordList[] = [
  {
    id: "dolch-1",
    name: "First words",
    group: "Ages 4–5",
    blurb: "The first forty. Mostly two and three letters.",
    emoji: "🌱",
    entries: [
      { word: "a", clue: "Would you like _ biscuit?" },
      { word: "and", clue: "Fish _ chips for tea." },
      { word: "away", clue: "The cat ran _." },
      { word: "big", clue: "That is a _ dog." },
      { word: "blue", clue: "The sky is _ today." },
      { word: "can", clue: "I _ ride my bike." },
      { word: "come", clue: "Please _ inside now." },
      { word: "down", clue: "We slid _ the hill." },
      { word: "find", clue: "Can you _ my shoe?" },
      { word: "for", clue: "This present is _ you." },
      { word: "funny", clue: "That joke was very _." },
      { word: "go", clue: "Time to _ home." },
      { word: "help", clue: "Can you _ me, please?" },
      { word: "here", clue: "Put your bag _." },
      { word: "I", clue: "My sister and _ are twins." },
      { word: "in", clue: "The milk is _ the fridge." },
      { word: "is", clue: "This _ my house." },
      { word: "it", clue: "I found _ under the bed." },
      { word: "jump", clue: "Watch me _ over the puddle." },
      { word: "little", clue: "A _ mouse ran past." },
      { word: "look", clue: "Come and _ at this." },
      { word: "make", clue: "Let's _ a cake." },
      { word: "me", clue: "Please pass it to _." },
      { word: "my", clue: "That is _ coat." },
      { word: "not", clue: "It is _ raining." },
      { word: "one", clue: "I only have _ apple." },
      { word: "play", clue: "Let's _ in the garden." },
      { word: "red", clue: "Her coat is bright _." },
      { word: "run", clue: "I can _ very fast." },
      { word: "said", clue: "Dad _ it was bedtime." },
      { word: "see", clue: "I can _ a rainbow." },
      { word: "the", clue: "Shut _ door, please." },
      { word: "three", clue: "I have _ pencils." },
      { word: "to", clue: "We walked _ school." },
      { word: "two", clue: "I have _ hands." },
      { word: "up", clue: "The balloon floated _." },
      { word: "we", clue: "Tomorrow _ are going swimming." },
      { word: "where", clue: "Tell me _ you live." },
      { word: "yellow", clue: "Bananas are _." },
      { word: "you", clue: "Are _ coming with us?" },
    ],
  },
  {
    id: "dolch-2",
    name: "Next steps",
    group: "Ages 5–6",
    blurb: "Colours, numbers and the words that hold a sentence together.",
    emoji: "🚗",
    entries: [
      { word: "all", clue: "We ate _ the cake." },
      { word: "am", clue: "I _ nearly seven." },
      { word: "are", clue: "You _ my best friend." },
      { word: "at", clue: "Meet me _ the gate." },
      { word: "ate", clue: "The dog _ my dinner." },
      { word: "be", clue: "I want to _ a vet." },
      { word: "black", clue: "Our cat is _." },
      { word: "brown", clue: "The bear has _ fur." },
      { word: "but", clue: "I'm tired, _ happy." },
      { word: "came", clue: "Grandma _ to visit." },
      { word: "did", clue: "When _ you get home?" },
      { word: "do", clue: "What shall we _ today?" },
      { word: "eat", clue: "Let's _ our lunch." },
      { word: "four", clue: "A dog has _ legs." },
      { word: "get", clue: "Please _ your coat." },
      { word: "good", clue: "That was a _ film." },
      { word: "have", clue: "I _ a new bike." },
      { word: "he", clue: "Then _ ran away." },
      { word: "into", clue: "She jumped _ the pool." },
      { word: "like", clue: "I _ chocolate ice cream." },
      { word: "must", clue: "We _ leave now." },
      { word: "new", clue: "I have _ shoes." },
      { word: "no", clue: "There is _ milk left." },
      { word: "now", clue: "We are leaving right _." },
      { word: "on", clue: "The cat sat _ the mat." },
      { word: "our", clue: "Come to _ party." },
      { word: "out", clue: "The sun came _." },
      { word: "please", clue: "Pass the salt, _." },
      { word: "pretty", clue: "What a _ flower." },
      { word: "ran", clue: "The dog _ down the street." },
      { word: "ride", clue: "Let's _ our bikes." },
      { word: "saw", clue: "I _ a fox last night." },
      { word: "say", clue: "What did you _?" },
      { word: "she", clue: "Then _ smiled at me." },
      { word: "so", clue: "It was _ cold outside." },
      { word: "soon", clue: "We will be there _." },
      { word: "that", clue: "Look at _ big dog." },
      { word: "there", clue: "Put your bag over _." },
      { word: "they", clue: "Where are _ going?" },
      { word: "this", clue: "I made _ for you." },
      { word: "too", clue: "It is _ hot today." },
      { word: "under", clue: "The cat hid _ the bed." },
      { word: "want", clue: "I _ a glass of water." },
      { word: "was", clue: "It _ very windy." },
      { word: "well", clue: "You did that very _." },
      { word: "went", clue: "We _ to the park." },
      { word: "what", clue: "Tell me _ happened." },
      { word: "white", clue: "Snow is _." },
      { word: "who", clue: "Guess _ I saw today." },
      { word: "will", clue: "I _ tidy my room." },
      { word: "with", clue: "Come _ me." },
      { word: "yes", clue: "She said _." },
    ],
  },
  {
    id: "dolch-3",
    name: "Building up",
    group: "Ages 6–7",
    blurb: "Where phonics starts letting you down — “could”, “know”, “once”.",
    emoji: "🧱",
    entries: [
      { word: "after", clue: "We will play _ tea." },
      { word: "again", clue: "Sing that song _." },
      { word: "an", clue: "I ate _ orange." },
      { word: "any", clue: "Are there _ biscuits left?" },
      // Not "as tall as" — the word would print next to its own blank.
      { word: "as", clue: "She dressed _ a pirate." },
      { word: "ask", clue: "Go and _ your dad." },
      { word: "by", clue: "The bag _ the door is mine." },
      { word: "could", clue: "I wish I _ swim." },
      { word: "every", clue: "I brush my teeth _ night." },
      { word: "fly", clue: "Birds _ south in winter." },
      { word: "from", clue: "A letter _ Grandma." },
      { word: "give", clue: "Please _ me the pen." },
      { word: "going", clue: "We are _ swimming." },
      { word: "had", clue: "I _ toast for breakfast." },
      { word: "has", clue: "She _ a red bike." },
      { word: "her", clue: "That is _ book." },
      { word: "him", clue: "I sat next to _." },
      { word: "his", clue: "This is _ coat." },
      { word: "how", clue: "Show me _ it works." },
      { word: "just", clue: "I _ finished my book." },
      { word: "know", clue: "I _ the answer." },
      { word: "let", clue: "Please _ me help." },
      { word: "live", clue: "We _ near the sea." },
      { word: "may", clue: "You _ come in now." },
      { word: "of", clue: "A cup _ tea." },
      { word: "old", clue: "My gran is very _." },
      { word: "once", clue: "I met her _ before." },
      { word: "open", clue: "Please _ the window." },
      { word: "over", clue: "The ball went _ the fence." },
      { word: "put", clue: "Please _ that down." },
      { word: "round", clue: "The moon is _." },
      { word: "some", clue: "Would you like _ juice?" },
      { word: "stop", clue: "The bus will _ here." },
      { word: "take", clue: "Please _ my hand." },
      { word: "thank", clue: "I want to _ you." },
      { word: "them", clue: "Give the sweets to _." },
      { word: "then", clue: "We ate, _ we left." },
      { word: "think", clue: "I _ it is Tuesday." },
      { word: "walk", clue: "Let's _ to school." },
      { word: "were", clue: "You _ very brave." },
      { word: "when", clue: "Tell me _ you are ready." },
    ],
  },
  {
    id: "dolch-4",
    name: "Getting fluent",
    group: "Ages 7–8",
    blurb: "Longer words, and the ones everyone spells wrong first.",
    emoji: "🏃",
    entries: [
      { word: "always", clue: "She is _ late." },
      { word: "around", clue: "We ran _ the field." },
      { word: "because", clue: "I am cold _ it is snowing." },
      { word: "been", clue: "I have _ to Spain." },
      { word: "before", clue: "Wash your hands _ tea." },
      { word: "best", clue: "You are my _ friend." },
      { word: "both", clue: "I hurt _ my knees." },
      { word: "buy", clue: "I want to _ a comic." },
      { word: "call", clue: "Please _ me tomorrow." },
      { word: "cold", clue: "My hands are _." },
      { word: "does", clue: "What _ that mean?" },
      { word: "don't", clue: "I _ like sprouts." },
      { word: "fast", clue: "That car is very _." },
      { word: "first", clue: "I came _ in the race." },
      { word: "five", clue: "I have _ fingers." },
      { word: "found", clue: "I _ my lost glove." },
      { word: "gave", clue: "She _ me a present." },
      { word: "goes", clue: "This _ on the shelf." },
      { word: "green", clue: "The grass is _." },
      { word: "its", clue: "The dog wagged _ tail." },
      { word: "made", clue: "I _ this cake myself." },
      { word: "many", clue: "How _ apples are there?" },
      { word: "off", clue: "Take your coat _." },
      { word: "or", clue: "Tea _ coffee?" },
      { word: "pull", clue: "Help me _ this rope." },
      { word: "read", clue: "I like to _ in bed." },
      { word: "right", clue: "Turn _ at the shop." },
      { word: "sing", clue: "Let's _ a song." },
      { word: "sit", clue: "Please _ down." },
      { word: "sleep", clue: "Time to go to _." },
      { word: "tell", clue: "Please _ me a story." },
      { word: "their", clue: "This is _ house." },
      { word: "these", clue: "I like _ biscuits." },
      { word: "those", clue: "Look at _ clouds." },
      { word: "upon", clue: "Once _ a time." },
      { word: "us", clue: "Come with _." },
      { word: "use", clue: "May I _ your pen?" },
      { word: "very", clue: "I am _ tired." },
      { word: "wash", clue: "Please _ your face." },
      { word: "which", clue: "Tell me _ way to go." },
      { word: "why", clue: "Tell me _ you are sad." },
      { word: "wish", clue: "I _ it was summer." },
      { word: "work", clue: "Mum has gone to _." },
      { word: "would", clue: "I _ love to come." },
      { word: "write", clue: "I will _ a letter." },
      { word: "your", clue: "Is this _ bag?" },
    ],
  },
  {
    id: "dolch-5",
    name: "Tricky ones",
    group: "Ages 8–9",
    blurb: "“Laugh”, “together”, “myself”. The last of the sight words.",
    emoji: "🔥",
    entries: [
      { word: "about", clue: "A book _ dinosaurs." },
      { word: "better", clue: "I feel _ today." },
      { word: "bring", clue: "Please _ your swimming kit." },
      { word: "carry", clue: "Can you _ this bag?" },
      { word: "clean", clue: "My room is _ now." },
      { word: "cut", clue: "I _ the paper in half." },
      { word: "done", clue: "Have you _ your homework?" },
      { word: "draw", clue: "I like to _ pictures." },
      { word: "drink", clue: "Would you like a _?" },
      { word: "eight", clue: "I am _ years old." },
      { word: "fall", clue: "Mind you don't _." },
      { word: "far", clue: "The shop is not _." },
      { word: "full", clue: "My cup is _." },
      { word: "got", clue: "She _ a prize." },
      { word: "grow", clue: "Sunflowers _ very tall." },
      { word: "hold", clue: "I can _ my breath." },
      { word: "hot", clue: "The soup is too _." },
      { word: "hurt", clue: "I _ my knee." },
      { word: "if", clue: "Come _ you want to." },
      { word: "keep", clue: "You can _ the pen." },
      { word: "kind", clue: "She is very _ to me." },
      { word: "laugh", clue: "That made me _." },
      { word: "light", clue: "Please turn the _ on." },
      { word: "long", clue: "That is a _ queue." },
      { word: "much", clue: "How _ does it cost?" },
      { word: "myself", clue: "I made it all by _." },
      { word: "never", clue: "I have _ been there." },
      { word: "only", clue: "I have _ one left." },
      { word: "own", clue: "This is my _ room." },
      { word: "pick", clue: "Please _ a card." },
      { word: "seven", clue: "There are _ days in a week." },
      { word: "shall", clue: "What _ we do?" },
      { word: "show", clue: "Please _ me your drawing." },
      { word: "six", clue: "I have _ crayons." },
      { word: "small", clue: "That shirt is too _." },
      { word: "start", clue: "The race will _ soon." },
      { word: "ten", clue: "I have _ toes." },
      { word: "today", clue: "It is my birthday _." },
      { word: "together", clue: "Let's sing _." },
      { word: "try", clue: "Please _ your best." },
      { word: "warm", clue: "The bath is nice and _." },
    ],
  },
  {
    id: "dolch-nouns",
    name: "Everyday things",
    group: "Ages 5–7",
    blurb:
      "Things you can point at. Good for a reader who's still building up.",
    emoji: "🧸",
    // Dolch's noun list, less "Christmas" and "Santa Claus": a spelling deck
    // has no way to signal that a capital is required, and one of them isn't
    // a single word.
    entries: [
      { word: "apple", clue: "I ate a green _." },
      { word: "baby", clue: "The _ is asleep." },
      { word: "back", clue: "I hurt my _ lifting that." },
      { word: "ball", clue: "Throw me the _." },
      { word: "bear", clue: "A brown _ lives in the woods." },
      { word: "bed", clue: "I climbed into _." },
      { word: "bell", clue: "The school _ rang." },
      { word: "bird", clue: "A _ sang outside." },
      { word: "birthday", clue: "It is my _ today." },
      { word: "boat", clue: "We rowed the _." },
      { word: "box", clue: "Put it in the _." },
      { word: "boy", clue: "The _ waved at me." },
      { word: "bread", clue: "A slice of _ and butter." },
      { word: "brother", clue: "My big _ is twelve." },
      { word: "cake", clue: "A slice of birthday _." },
      { word: "car", clue: "We drove the _ home." },
      { word: "cat", clue: "Our _ is called Tom." },
      { word: "chair", clue: "Sit on the _." },
      { word: "chicken", clue: "The _ laid an egg." },
      { word: "children", clue: "The _ played outside." },
      { word: "coat", clue: "My _ has a hood." },
      { word: "corn", clue: "The field of _ is tall." },
      { word: "cow", clue: "The _ gave us milk." },
      { word: "day", clue: "What a lovely _." },
      { word: "dog", clue: "Our _ likes long walks." },
      { word: "doll", clue: "She dressed her _." },
      { word: "door", clue: "Someone knocked on the _." },
      { word: "duck", clue: "A _ swam on the pond." },
      { word: "egg", clue: "I had a boiled _." },
      { word: "eye", clue: "I got soap in my _." },
      { word: "farm", clue: "Cows live on a _." },
      { word: "farmer", clue: "The _ drives a tractor." },
      { word: "father", clue: "My _ makes pancakes." },
      { word: "feet", clue: "My _ are cold." },
      { word: "fire", clue: "We sat by the _." },
      { word: "fish", clue: "We caught a big _." },
      { word: "floor", clue: "The toys are on the _." },
      { word: "flower", clue: "I picked a yellow _." },
      { word: "game", clue: "Shall we play a _?" },
      { word: "garden", clue: "We planted seeds in the _." },
      { word: "girl", clue: "The _ next door is nine." },
      { word: "goodbye", clue: "Wave _ to Grandma." },
      { word: "grass", clue: "The _ needs cutting." },
      { word: "ground", clue: "I sat on the _." },
      { word: "hand", clue: "I waved my _." },
      { word: "head", clue: "I bumped my _." },
      { word: "hill", clue: "We ran up the _." },
      { word: "home", clue: "We walked all the way _." },
      { word: "horse", clue: "The _ ate an apple." },
      { word: "house", clue: "We live in a big _." },
      { word: "kitty", clue: "The little _ purred." },
      { word: "leg", clue: "The table has a broken _." },
      { word: "letter", clue: "I posted a _." },
      { word: "man", clue: "A _ in a blue hat." },
      { word: "men", clue: "Two _ carried the sofa." },
      { word: "milk", clue: "A glass of cold _." },
      { word: "money", clue: "I saved my pocket _." },
      { word: "morning", clue: "I got up early this _." },
      { word: "mother", clue: "My _ reads to me." },
      { word: "name", clue: "Write your _ at the top." },
      { word: "nest", clue: "Birds built a _ up there." },
      { word: "night", clue: "The stars come out at _." },
      { word: "paper", clue: "I drew on the _." },
      { word: "party", clue: "We danced at the _." },
      { word: "picture", clue: "I painted a _." },
      { word: "pig", clue: "The _ rolled in the mud." },
      { word: "rabbit", clue: "A _ hopped past." },
      { word: "rain", clue: "The _ soaked my coat." },
      { word: "ring", clue: "She wore a gold _." },
      { word: "robin", clue: "A _ sat on the fence." },
      { word: "school", clue: "I learn to read at _." },
      { word: "seed", clue: "I planted one _." },
      { word: "sheep", clue: "The _ are in the field." },
      { word: "shoe", clue: "I lost one _." },
      { word: "sister", clue: "My little _ is four." },
      { word: "snow", clue: "The _ is deep today." },
      { word: "song", clue: "She sang my favourite _." },
      { word: "squirrel", clue: "A _ buried a nut." },
      { word: "stick", clue: "The dog fetched a _." },
      { word: "street", clue: "We live on a quiet _." },
      { word: "sun", clue: "The _ is very bright." },
      { word: "table", clue: "Put the plates on the _." },
      { word: "thing", clue: "What is that _?" },
      { word: "time", clue: "What _ is it?" },
      { word: "top", clue: "I climbed to the _." },
      { word: "toy", clue: "My favourite _ is a train." },
      { word: "tree", clue: "A bird sat in the _." },
      { word: "watch", clue: "I wear a _ on my wrist." },
      { word: "water", clue: "I drank some cold _." },
      { word: "way", clue: "Which _ is the park?" },
      { word: "wind", clue: "The _ blew my hat off." },
      { word: "window", clue: "Look out of the _." },
      { word: "wood", clue: "The table is made of _." },
    ],
  },
];

/**
 * Every list this build ships, whatever it teaches.
 *
 * `WORD_LISTS` is the graded sight-word set and stays that: the typing pools,
 * the age lookup below and the spelling shelf all mean *Dolch* when they say
 * word list, and a Bible book in a "common words" typing level would be a
 * proper noun in a pool of the hundred commonest words. What every list has in
 * common is the machinery — one picker, one id space, one sentence per word —
 * and that is what this is for. The Bible lists are `biblelists.ts`, one source
 * among several (docs/printables.md §12).
 */
export const SHIPPED_LISTS: WordList[] = [...WORD_LISTS, ...BIBLE_LISTS];

/**
 * By id, across every shipped list.
 *
 * The id is what a saved session, a saved sheet and a shared link all carry, so
 * this is the lookup that decides whether a list is one of ours or one a parent
 * typed in (`services/decks.ts`). Built from the whole shelf rather than from
 * Dolch alone: a run saved on a books-of-the-Bible list has to be able to name
 * itself in the record book.
 */
export const WORD_LISTS_BY_ID = new Map(SHIPPED_LISTS.map((l) => [l.id, l]));

/** The list a child of this age is most likely to be working on. */
export function wordListForAge(age: number): WordList {
  if (age <= 5) return WORD_LISTS[0];
  if (age <= 6) return WORD_LISTS[1];
  if (age <= 7) return WORD_LISTS[2];
  if (age <= 8) return WORD_LISTS[3];
  return WORD_LISTS[4];
}
