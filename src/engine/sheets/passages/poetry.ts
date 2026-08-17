/**
 * Poems, which are the one thing in this library that is not prose-shaped.
 *
 * A poem's line breaks are the poem. So `lines` here is one entry per line of
 * verse, and a **stanza break is an empty string** — the only place in the
 * library where a blank line is data rather than a mistake. A renderer that
 * re-flowed these to fit the paper would be printing something the poet didn't
 * write, and a child copying it would learn the wrong shape.
 *
 * What is *not* kept is the printed indentation. Several of these editions
 * indent alternate lines, and a ruled copywork line starts where the rule
 * starts; there is nowhere for a hanging indent to go. Losing it changes how
 * the poem looks and not what it says, which is the line this library draws.
 *
 * ── Provenance ──────────────────────────────────────────────────────────────
 * Each poem is quoted from the Project Gutenberg plain-text edition named in
 * `source.edition`, line for line. Two things in those editions look like
 * errors and are not:
 *
 *   - **Double hyphens.** `--` is how a plain-text transcription writes an em
 *     dash, and it survives here ("Over the countryside--") because the rule
 *     across this directory is that a stated source is quoted, not improved.
 *     If they should print as em dashes, that is a decision for the renderer,
 *     made in one place, and not thirty hand edits to the data.
 *   - **"The Tiger", spelt so.** Blake's plate reads *The Tyger*; the 1794
 *     Songs of Innocence and of Experience edition transcribed here modernises
 *     the spelling throughout, and the title follows the text it belongs to.
 *
 * All eight were published between 1794 and 1916 and are public domain in the
 * United States. Frost is the closest to the line at 1916, and comfortably
 * clear of it.
 */
import type { Passage, PassageCollection } from "./types";

export const POETRY_COLLECTIONS: PassageCollection[] = [
  {
    id: "poems",
    name: "Poems to learn by heart",
    blurb: "Stevenson, Lear, Carroll, Frost — short enough to finish.",
    kind: "poetry",
  },
];

export const POETRY: Passage[] = [
  {
    id: "bed-in-summer",
    title: "Bed in Summer",
    attribution: "Robert Louis Stevenson",
    kind: "poetry",
    collection: "poems",
    lines: [
      "In winter I get up at night",
      "And dress by yellow candle-light.",
      "In summer, quite the other way,",
      "I have to go to bed by day.",
      "",
      "I have to go to bed and see",
      "The birds still hopping on the tree,",
      "Or hear the grown-up people's feet",
      "Still going past me in the street.",
      "",
      "And does it not seem hard to you,",
      "When all the sky is clear and blue,",
      "And I should like so much to play,",
      "To have to go to bed by day?",
    ],
    source: {
      work: "A Child's Garden of Verses",
      author: "Robert Louis Stevenson",
      year: "1885",
      edition:
        "Project Gutenberg eBook #25609, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "the-swing",
    title: "The Swing",
    attribution: "Robert Louis Stevenson",
    kind: "poetry",
    collection: "poems",
    lines: [
      "How do you like to go up in a swing,",
      "Up in the air so blue?",
      "Oh, I do think it the pleasantest thing",
      "Ever a child can do!",
      "",
      "Up in the air and over the wall,",
      "Till I can see so wide,",
      "Rivers and trees and cattle and all",
      "Over the countryside--",
      "",
      "Till I look down on the garden green,",
      "Down on the roof so brown--",
      "Up in the air I go flying again,",
      "Up in the air and down!",
    ],
    source: {
      work: "A Child's Garden of Verses",
      author: "Robert Louis Stevenson",
      year: "1885",
      edition:
        "Project Gutenberg eBook #25609, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "my-shadow",
    title: "My Shadow",
    attribution: "Robert Louis Stevenson",
    kind: "poetry",
    collection: "poems",
    lines: [
      "I have a little shadow that goes in and out with me,",
      "And what can be the use of him is more than I can see.",
      "He is very, very like me from the heels up to the head;",
      "And I see him jump before me, when I jump into my bed.",
      "",
      "The funniest thing about him is the way he likes to grow--",
      "Not at all like proper children, which is always very slow;",
      "For he sometimes shoots up taller like an india-rubber ball,",
      "And he sometimes gets so little that there's none of him at all.",
      "",
      "He hasn't got a notion of how children ought to play,",
      "And can only make a fool of me in every sort of way.",
      "He stays so close beside me, he's a coward you can see;",
      "I'd think shame to stick to nursie as that shadow sticks to me!",
      "",
      "One morning, very early, before the sun was up,",
      "I rose and found the shining dew on every buttercup;",
      "But my lazy little shadow, like an arrant sleepy-head,",
      "Had stayed at home behind me and was fast asleep in bed.",
    ],
    source: {
      work: "A Child's Garden of Verses",
      author: "Robert Louis Stevenson",
      year: "1885",
      edition:
        "Project Gutenberg eBook #25609, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "time-to-rise",
    title: "Time to Rise",
    attribution: "Robert Louis Stevenson",
    kind: "poetry",
    collection: "poems",
    lines: [
      "A birdie with a yellow bill",
      "Hopped upon the window sill,",
      "Cocked his shining eye and said:",
      "\"Ain't you 'shamed, you sleepy-head!\"",
    ],
    source: {
      work: "A Child's Garden of Verses",
      author: "Robert Louis Stevenson",
      year: "1885",
      edition:
        "Project Gutenberg eBook #25609, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "jabberwocky",
    title: "Jabberwocky",
    attribution: "Lewis Carroll, 1871",
    kind: "poetry",
    collection: "poems",
    lines: [
      "’Twas brillig, and the slithy toves",
      "Did gyre and gimble in the wabe;",
      "All mimsy were the borogoves,",
      "And the mome raths outgrabe.",
      "",
      "“Beware the Jabberwock, my son!",
      "The jaws that bite, the claws that catch!",
      "Beware the Jubjub bird, and shun",
      "The frumious Bandersnatch!”",
      "",
      "He took his vorpal sword in hand:",
      "Long time the manxome foe he sought—",
      "So rested he by the Tumtum tree,",
      "And stood awhile in thought.",
      "",
      "And as in uffish thought he stood,",
      "The Jabberwock, with eyes of flame,",
      "Came whiffling through the tulgey wood,",
      "And burbled as it came!",
      "",
      "One, two! One, two! And through and through",
      "The vorpal blade went snicker-snack!",
      "He left it dead, and with its head",
      "He went galumphing back.",
      "",
      "“And hast thou slain the Jabberwock?",
      "Come to my arms, my beamish boy!",
      "O frabjous day! Callooh! Callay!”",
      "He chortled in his joy.",
      "",
      "’Twas brillig, and the slithy toves",
      "Did gyre and gimble in the wabe;",
      "All mimsy were the borogoves,",
      "And the mome raths outgrabe.",
    ],
    source: {
      work: "Through the Looking-Glass",
      author: "Lewis Carroll",
      year: "1871",
      edition:
        "Project Gutenberg eBook #12, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "the-owl-and-the-pussy-cat",
    title: "The Owl and the Pussy-Cat",
    attribution: "Edward Lear, 1871",
    kind: "poetry",
    collection: "poems",
    lines: [
      "The Owl and the Pussy-Cat went to sea",
      "In a beautiful pea-green boat:",
      "They took some honey, and plenty of money",
      "Wrapped up in a five-pound note.",
      "The Owl looked up to the stars above,",
      "And sang to a small guitar,",
      '"O lovely Pussy, O Pussy, my love,',
      "What a beautiful Pussy you are,",
      "You are,",
      "You are!",
      'What a beautiful Pussy you are!"',
      "",
      'Pussy said to the Owl, "You elegant fowl,',
      "How charmingly sweet you sing!",
      "Oh! let us be married; too long we have tarried:",
      'But what shall we do for a ring?"',
      "They sailed away, for a year and a day,",
      "To the land where the bong-tree grows;",
      "And there in a wood a Piggy-wig stood,",
      "With a ring at the end of his nose,",
      "His nose,",
      "His nose,",
      "With a ring at the end of his nose.",
      "",
      '"Dear Pig, are you willing to sell for one shilling',
      'Your ring?" Said the Piggy, "I will."',
      "So they took it away, and were married next day",
      "By the Turkey who lives on the hill.",
      "They dined on mince and slices of quince,",
      "Which they ate with a runcible spoon;",
      "And hand in hand, on the edge of the sand,",
      "They danced by the light of the moon,",
      "The moon,",
      "The moon,",
      "They danced by the light of the moon.",
    ],
    source: {
      work: "Nonsense Songs",
      author: "Edward Lear",
      year: "1871",
      edition:
        "Project Gutenberg eBook #13647, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "the-road-not-taken",
    title: "The Road Not Taken",
    attribution: "Robert Frost, 1916",
    kind: "poetry",
    collection: "poems",
    lines: [
      "Two roads diverged in a yellow wood,",
      "And sorry I could not travel both",
      "And be one traveler, long I stood",
      "And looked down one as far as I could",
      "To where it bent in the undergrowth;",
      "",
      "Then took the other, as just as fair,",
      "And having perhaps the better claim,",
      "Because it was grassy and wanted wear;",
      "Though as for that the passing there",
      "Had worn them really about the same,",
      "",
      "And both that morning equally lay",
      "In leaves no step had trodden black.",
      "Oh, I kept the first for another day!",
      "Yet knowing how way leads on to way,",
      "I doubted if I should ever come back.",
      "",
      "I shall be telling this with a sigh",
      "Somewhere ages and ages hence:",
      "Two roads diverged in a wood, and I--",
      "I took the one less traveled by,",
      "And that has made all the difference.",
    ],
    source: {
      work: "Mountain Interval",
      author: "Robert Frost",
      year: "1916",
      edition:
        "Project Gutenberg eBook #29345, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "the-tiger",
    title: "The Tiger",
    attribution: "William Blake, 1794",
    kind: "poetry",
    collection: "poems",
    lines: [
      "Tiger, tiger, burning bright",
      "In the forests of the night,",
      "What immortal hand or eye",
      "Could frame thy fearful symmetry?",
      "",
      "In what distant deeps or skies",
      "Burnt the fire of thine eyes?",
      "On what wings dare he aspire?",
      "What the hand dare seize the fire?",
      "",
      "And what shoulder and what art",
      "Could twist the sinews of thy heart?",
      "And, when thy heart began to beat,",
      "What dread hand and what dread feet?",
      "",
      "What the hammer? what the chain?",
      "In what furnace was thy brain?",
      "What the anvil? what dread grasp",
      "Dare its deadly terrors clasp?",
      "",
      "When the stars threw down their spears,",
      "And watered heaven with their tears,",
      "Did He smile His work to see?",
      "Did He who made the lamb make thee?",
      "",
      "Tiger, tiger, burning bright",
      "In the forests of the night,",
      "What immortal hand or eye",
      "Dare frame thy fearful symmetry?",
    ],
    source: {
      work: "Songs of Innocence and of Experience",
      author: "William Blake",
      year: "1794",
      edition:
        "Project Gutenberg eBook #1934, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
];
