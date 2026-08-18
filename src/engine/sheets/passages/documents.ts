/**
 * Historical documents, for the copywork that doubles as a history lesson.
 *
 * All five are United States founding or Civil War texts, which is a narrowness
 * worth naming rather than pretending away: they are the documents this
 * audience's curricula actually set for copywork, and they are also the ones
 * whose text can be taken straight from a government transcript or a
 * photographed manuscript rather than from somebody's retyping. A passage that
 * cannot be sourced that well doesn't belong in a library children copy by
 * hand — a stray comma here becomes a stray comma in a hundred exercise books.
 *
 * Where a passage is part of a longer document, `source.edition` says which
 * part. An excerpt that names itself is honest; a silently truncated paragraph
 * is the kind of error nobody finds, because the result still reads correctly.
 *
 * Provenance, per passage, in `source`:
 *   - The Gettysburg Address is the **Bliss copy** — the only one Lincoln
 *     signed, and the version carved at the Lincoln Memorial. Its punctuation
 *     differs in small ways from the newspaper transcriptions that circulate,
 *     which is exactly why the copy is named.
 *   - The Declaration, the Preamble and the First Amendment come from the U.S.
 *     National Archives transcripts, which follow the engrossed originals —
 *     including "defence" and the capitalised nouns that look like errors and
 *     are not.
 *   - The Second Inaugural closing is from the Wikisource text of Lincoln's
 *     *Life and Works*.
 *
 * Federal government works carry no copyright (17 U.S.C. §105); the two Lincoln
 * texts are also long out of copyright by age. There is nothing here whose
 * status turns on a judgement call, which is the standard for this directory.
 */
import type { Passage, PassageCollection } from "./types";

export const DOCUMENT_COLLECTIONS: PassageCollection[] = [
  {
    id: "founding-documents",
    name: "Founding documents",
    blurb: "The Gettysburg Address, the Declaration, the Preamble.",
    kind: "document",
  },
];

export const DOCUMENTS: Passage[] = [
  {
    id: "gettysburg-address",
    title: "The Gettysburg Address",
    attribution: "Abraham Lincoln, 1863",
    kind: "document",
    collection: "founding-documents",
    lines: [
      "Four score and seven years ago our fathers brought forth, on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.",
      "Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure. We are met on a great battle-field of that war. We have come to dedicate a portion of that field, as a final resting place for those who here gave their lives that that nation might live. It is altogether fitting and proper that we should do this.",
      "But, in a larger sense, we can not dedicate—we can not consecrate—we can not hallow—this ground. The brave men, living and dead, who struggled here, have consecrated it, far above our poor power to add or detract. The world will little note, nor long remember what we say here, but it can never forget what they did here. It is for us the living, rather, to be dedicated here to the unfinished work which they who fought here have thus far so nobly advanced. It is rather for us to be here dedicated to the great task remaining before us—that from these honored dead we take increased devotion to that cause for which they gave the last full measure of devotion—that we here highly resolve that these dead shall not have died in vain—that this nation, under God, shall have a new birth of freedom—and that government of the people, by the people, for the people, shall not perish from the earth.",
    ],
    source: {
      work: "The Gettysburg Address",
      author: "Abraham Lincoln",
      year: "1863",
      edition:
        "Bliss copy, from the Wikisource transcription of the signed manuscript",
      licence: "Public domain — published 1863",
    },
  },
  {
    id: "declaration-of-independence",
    title: "The Declaration of Independence",
    attribution: "The Continental Congress, 1776",
    kind: "document",
    collection: "founding-documents",
    lines: [
      "When in the Course of human events, it becomes necessary for one people to dissolve the political bands which have connected them with another, and to assume among the powers of the earth, the separate and equal station to which the Laws of Nature and of Nature's God entitle them, a decent respect to the opinions of mankind requires that they should declare the causes which impel them to the separation.",
      "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.",
    ],
    source: {
      work: "The Declaration of Independence",
      author: "Thomas Jefferson and the Continental Congress",
      year: "1776",
      edition:
        "Opening two paragraphs, from the U.S. National Archives transcript",
      licence: "Public domain — a work of the United States government",
    },
  },
  {
    id: "constitution-preamble",
    title: "The Preamble to the Constitution",
    attribution: "The Constitutional Convention, 1787",
    kind: "document",
    collection: "founding-documents",
    lines: [
      "We the People of the United States, in Order to form a more perfect Union, establish Justice, insure domestic Tranquility, provide for the common defence, promote the general Welfare, and secure the Blessings of Liberty to ourselves and our Posterity, do ordain and establish this Constitution for the United States of America.",
    ],
    source: {
      work: "The Constitution of the United States",
      author: "The Constitutional Convention",
      year: "1787",
      edition: "Preamble, from the U.S. National Archives transcript",
      licence: "Public domain — a work of the United States government",
    },
  },
  {
    id: "first-amendment",
    title: "The First Amendment",
    attribution: "The Bill of Rights, 1791",
    kind: "document",
    collection: "founding-documents",
    lines: [
      "Congress shall make no law respecting an establishment of religion, or prohibiting the free exercise thereof; or abridging the freedom of speech, or of the press; or the right of the people peaceably to assemble, and to petition the Government for a redress of grievances.",
    ],
    source: {
      work: "The Bill of Rights",
      author: "The First Congress of the United States",
      year: "1791",
      edition: "Amendment I, from the U.S. National Archives transcript",
      licence: "Public domain — a work of the United States government",
    },
  },
  {
    id: "with-malice-toward-none",
    title: "With malice toward none",
    attribution: "Abraham Lincoln, 1865",
    kind: "document",
    collection: "founding-documents",
    lines: [
      "With malice toward none; with charity for all; with firmness in the right, as God gives us to see the right, let us strive on to finish the work we are in; to bind up the nation's wounds; to care for him who shall have borne the battle, and for his widow, and his orphan—to do all which may achieve and cherish a just and lasting peace among ourselves, and with all nations.",
    ],
    source: {
      work: "Second Inaugural Address",
      author: "Abraham Lincoln",
      year: "1865",
      edition:
        "Closing paragraph, from the Wikisource text of Lincoln's Life and Works",
      licence: "Public domain — a work of the United States government",
    },
  },
];
