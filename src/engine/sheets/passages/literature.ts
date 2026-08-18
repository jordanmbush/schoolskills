/**
 * Prose: the openings children know, and three fables.
 *
 * Copywork wants a paragraph that is worth having in your hand twice — once
 * read and once written — so these are first paragraphs rather than favourite
 * sentences. A first paragraph is a complete unit the author shaped, it can be
 * quoted without cutting anything, and it is the part of a book a child is
 * most likely to meet again.
 *
 * The fables carry their moral as a second line, because in Townsend's edition
 * that is how they are printed and because the moral is the reason the fable
 * is set for copywork at all.
 *
 * ── Provenance ──────────────────────────────────────────────────────────────
 * Every text is from the Project Gutenberg plain-text edition named in
 * `source.edition`, quoted paragraph for paragraph with no other change than
 * unwrapping the fixed-width line breaks of a text file, which are the
 * transcriber's and not the author's. Each work was published between 1813 and
 * 1911 and is in the public domain in the United States.
 *
 * Note that this is provenance for *this text*, not merely for the work. The
 * Gutenberg editions differ from one another in their typography — some use
 * curly quotation marks, some straight; some render an em dash as two hyphens.
 * Whatever the named edition does is kept, because "verbatim from a stated
 * source" is a claim that can be checked and "tidied up a bit" is not. Don't
 * normalise these by hand; change the edition and re-quote it if you must.
 *
 * Nothing here is later than 1911. That is deliberate slack rather than the
 * legal line — works published before 1931 are out of copyright in the US as
 * things stand — because a library children copy is a bad place to be sitting
 * one year from the edge of a term that has moved before.
 */
import type { Passage, PassageCollection } from "./types";

export const LITERATURE_COLLECTIONS: PassageCollection[] = [
  {
    id: "story-openings",
    name: "How the story starts",
    blurb: "First paragraphs — Alice, Peter Rabbit, Treasure Island.",
    kind: "prose",
  },
  {
    id: "fables",
    name: "Aesop's fables",
    blurb: "A short fable and its moral. The shortest whole thing to copy.",
    kind: "prose",
  },
];

export const LITERATURE: Passage[] = [
  {
    id: "alice-in-wonderland",
    title: "Down the Rabbit-Hole",
    attribution: "Lewis Carroll, 1865",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”",
    ],
    source: {
      work: "Alice's Adventures in Wonderland",
      author: "Lewis Carroll",
      year: "1865",
      edition:
        "Project Gutenberg eBook #11, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "wind-in-the-willows",
    title: "The River Bank",
    attribution: "Kenneth Grahame, 1908",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "The Mole had been working very hard all the morning, spring-cleaning his little home. First with brooms, then with dusters; then on ladders and steps and chairs, with a brush and a pail of whitewash; till he had dust in his throat and eyes, and splashes of whitewash all over his black fur, and an aching back and weary arms. Spring was moving in the air above and in the earth below and around him, penetrating even his dark and lowly little house with its spirit of divine discontent and longing. It was small wonder, then, that he suddenly flung down his brush on the floor, said “Bother!” and “O blow!” and also “Hang spring-cleaning!” and bolted out of the house without even waiting to put on his coat. Something up above was calling him imperiously, and he made for the steep little tunnel which answered in his case to the gravelled carriage-drive owned by animals whose residences are nearer to the sun and air. So he scraped and scratched and scrabbled and scrooged and then he scrooged again and scrabbled and scratched and scraped, working busily with his little paws and muttering to himself, “Up we go! Up we go!” till at last, pop! his snout came out into the sunlight, and he found himself rolling in the warm grass of a great meadow.",
    ],
    source: {
      work: "The Wind in the Willows",
      author: "Kenneth Grahame",
      year: "1908",
      edition:
        "Project Gutenberg eBook #289, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "peter-rabbit",
    title: "The Tale of Peter Rabbit",
    attribution: "Beatrix Potter, 1902",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "Once upon a time there were four little Rabbits, and their names were--",
      "Flopsy, Mopsy, Cotton-tail, and Peter.",
      "They lived with their Mother in a sand-bank, underneath the root of a very big fir-tree.",
    ],
    source: {
      work: "The Tale of Peter Rabbit",
      author: "Beatrix Potter",
      year: "1902",
      edition:
        "Project Gutenberg eBook #14838, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "treasure-island",
    title: "The Old Sea-Dog at the Admiral Benbow",
    attribution: "Robert Louis Stevenson, 1883",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "Squire Trelawney, Dr. Livesey, and the rest of these gentlemen having asked me to write down the whole particulars about Treasure Island, from the beginning to the end, keeping nothing back but the bearings of the island, and that only because there is still treasure not yet lifted, I take up my pen in the year of grace 17—, and go back to the time when my father kept the Admiral Benbow inn and the brown old seaman with the sabre cut first took up his lodging under our roof.",
    ],
    source: {
      work: "Treasure Island",
      author: "Robert Louis Stevenson",
      year: "1883",
      edition:
        "Project Gutenberg eBook #120, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "the-secret-garden",
    title: "There Is No One Left",
    attribution: "Frances Hodgson Burnett, 1911",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "When Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen. It was true, too. She had a little thin face and a little thin body, thin light hair and a sour expression. Her hair was yellow, and her face was yellow because she had been born in India and had always been ill in one way or another.",
    ],
    source: {
      work: "The Secret Garden",
      author: "Frances Hodgson Burnett",
      year: "1911",
      edition:
        "Project Gutenberg eBook #113, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "anne-of-green-gables",
    title: "Mrs. Rachel Lynde Is Surprised",
    attribution: "L. M. Montgomery, 1908",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "MRS. Rachel Lynde lived just where the Avonlea main road dipped down into a little hollow, fringed with alders and ladies’ eardrops and traversed by a brook that had its source away back in the woods of the old Cuthbert place; it was reputed to be an intricate, headlong brook in its earlier course through those woods, with dark secrets of pool and cascade; but by the time it reached Lynde’s Hollow it was a quiet, well-conducted little stream, for not even a brook could run past Mrs. Rachel Lynde’s door without due regard for decency and decorum; it probably was conscious that Mrs. Rachel was sitting at her window, keeping a sharp eye on everything that passed, from brooks and children up, and that if she noticed anything odd or out of place she would never rest until she had ferreted out the whys and wherefores thereof.",
    ],
    source: {
      work: "Anne of Green Gables",
      author: "L. M. Montgomery",
      year: "1908",
      edition:
        "Project Gutenberg eBook #45, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "little-women",
    title: "Playing Pilgrims",
    attribution: "Louisa May Alcott, 1868",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "“Christmas won’t be Christmas without any presents,” grumbled Jo, lying on the rug.",
      "“It’s so dreadful to be poor!” sighed Meg, looking down at her old dress.",
      "“I don’t think it’s fair for some girls to have plenty of pretty things, and other girls nothing at all,” added little Amy, with an injured sniff.",
      "“We’ve got Father and Mother, and each other,” said Beth contentedly from her corner.",
    ],
    source: {
      work: "Little Women",
      author: "Louisa May Alcott",
      year: "1868",
      edition:
        "Project Gutenberg eBook #514, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "a-christmas-carol",
    title: "Marley's Ghost",
    attribution: "Charles Dickens, 1843",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "MARLEY was dead: to begin with. There is no doubt whatever about that. The register of his burial was signed by the clergyman, the clerk, the undertaker, and the chief mourner. Scrooge signed it: and Scrooge's name was good upon 'Change, for anything he chose to put his hand to. Old Marley was as dead as a door-nail.",
    ],
    source: {
      work: "A Christmas Carol",
      author: "Charles Dickens",
      year: "1843",
      edition:
        "Project Gutenberg eBook #46, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "pride-and-prejudice",
    title: "A Truth Universally Acknowledged",
    attribution: "Jane Austen, 1813",
    kind: "prose",
    collection: "story-openings",
    lines: [
      "It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.",
      "However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.",
    ],
    source: {
      work: "Pride and Prejudice",
      author: "Jane Austen",
      year: "1813",
      edition:
        "Project Gutenberg eBook #1342, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "the-hare-and-the-tortoise",
    title: "The Hare and the Tortoise",
    attribution: "Aesop, translated by George Fyler Townsend",
    kind: "prose",
    collection: "fables",
    lines: [
      "A HARE one day ridiculed the short feet and slow pace of the Tortoise, who replied, laughing: “Though you be swift as the wind, I will beat you in a race.” The Hare, believing her assertion to be simply impossible, assented to the proposal; and they agreed that the Fox should choose the course and fix the goal. On the day appointed for the race the two started together. The Tortoise never for a moment stopped, but went on with a slow but steady pace straight to the end of the course. The Hare, lying down by the wayside, fell fast asleep. At last waking up, and moving as fast as he could, he saw the Tortoise had reached the goal, and was comfortably dozing after her fatigue.",
      "Slow but steady wins the race.",
    ],
    source: {
      work: "Three Hundred Aesop's Fables",
      author: "Aesop, translated by George Fyler Townsend",
      year: "1867",
      edition:
        "Project Gutenberg eBook #21, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "the-ants-and-the-grasshopper",
    title: "The Ants and the Grasshopper",
    attribution: "Aesop, translated by George Fyler Townsend",
    kind: "prose",
    collection: "fables",
    lines: [
      "THE ANTS were spending a fine winter’s day drying grain collected in the summertime. A Grasshopper, perishing with famine, passed by and earnestly begged for a little food. The Ants inquired of him, “Why did you not treasure up food during the summer?” He replied, “I had not leisure enough. I passed the days in singing.” They then said in derision: “If you were foolish enough to sing all the summer, you must dance supperless to bed in the winter.”",
    ],
    source: {
      work: "Three Hundred Aesop's Fables",
      author: "Aesop, translated by George Fyler Townsend",
      year: "1867",
      edition:
        "Project Gutenberg eBook #21, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
  {
    id: "the-crow-and-the-pitcher",
    title: "The Crow and the Pitcher",
    attribution: "Aesop, translated by George Fyler Townsend",
    kind: "prose",
    collection: "fables",
    lines: [
      "A CROW perishing with thirst saw a pitcher, and hoping to find water, flew to it with delight. When he reached it, he discovered to his grief that it contained so little water that he could not possibly get at it. He tried everything he could think of to reach the water, but all his efforts were in vain. At last he collected as many stones as he could carry and dropped them one by one with his beak into the pitcher, until he brought the water within his reach and thus saved his life.",
      "Necessity is the mother of invention.",
    ],
    source: {
      work: "Three Hundred Aesop's Fables",
      author: "Aesop, translated by George Fyler Townsend",
      year: "1867",
      edition:
        "Project Gutenberg eBook #21, gutenberg.org — plain-text edition",
      licence: "Public domain in the United States",
    },
  },
];
