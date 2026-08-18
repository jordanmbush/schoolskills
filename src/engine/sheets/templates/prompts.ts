/**
 * Writing prompts, written down rather than worked out.
 *
 * The one authored list on the paperwork shelf, and it is authored for the
 * reason the grammar bank and the phonics sentences are: no rule turns a topic
 * into a prompt. "Write about an animal" is a topic; "Your dog has learnt to
 * talk, and the first thing it says is that it has been lying to you" is a
 * prompt, and the difference between them is a whole page of writing.
 *
 * Three house rules, and they are all of the form *leave it out*:
 *
 *   - **Nothing that needs a childhood we have not got.** No prompts about
 *     holidays abroad, a bedroom of one's own, or what your family does at
 *     Christmas. A prompt a child cannot answer is a page they sit in front of.
 *   - **Nothing that asks a child to disclose.** "Write about the saddest day
 *     you have had" is a therapy exercise handed out as homework, and a sheet
 *     from a stranger has no business asking for it.
 *   - **A situation, not a subject.** Every entry puts something in motion,
 *     because "what happens next" is a question a seven-year-old can answer and
 *     "describe autumn" is not.
 *
 * Sorted by nothing. The seed picks one (§7), so "another prompt like this" is
 * `seed + 1` here exactly as "another sheet of sums" is on the maths shelf —
 * which is the whole reason this shelf has a seed at all.
 */

export const WRITING_PROMPTS: readonly string[] = [
  "You wake up and everyone in the house has swapped ages. You are the oldest. What is the first thing you do?",
  "A door has appeared in your kitchen that was not there yesterday. It is locked, and there is a note under it.",
  "Write the instructions for something you can do well, for somebody who has never done it. Do not skip a step.",
  "Your shadow gets up and walks off without you. Where does it go, and how do you get it back?",
  "The class pet has left a letter explaining why it is leaving. Write the letter.",
  "You find a key in the garden. It fits something, but not anything in your house.",
  "Somebody has invented a machine that makes exactly one thing. Say what it makes, and why that was a mistake.",
  "You are the last person awake in the house. The clock strikes a number it does not have.",
  "Two animals who would never meet have to work together to get home. Say which two, and what goes wrong.",
  "Write a day in the life of the person who has to clean up after a dragon.",
  "You are given a jar with one afternoon in it. Whose afternoon, and what happens when you open it?",
  "A parcel arrives with your name on it and no address. Inside is something that is definitely not for you.",
  "Describe your bedroom to somebody who cannot see it, using no colours.",
  "The sea has gone out and not come back. It is the third day.",
  "You have been asked to write the rules for a new playground game. Write them so an argument is impossible.",
  "Something very small in your house has been moving at night. Tonight you stay awake.",
  "Write a conversation between a person who is late and a person who is early. Neither says so.",
  "A bird lands on your windowsill with a ring on its leg and a message rolled up in it.",
  "You have to persuade somebody to change their mind about something small. Say what, and how.",
  "The lights have gone out in the whole town and nobody knows why. You are the only one outside.",
  "Write about a journey where the map turns out to be wrong on purpose.",
  "You can hear what one object in your house is thinking. Say which, and what it says all day.",
  "Somebody has left one shoe on a bench. Write how it got there.",
  "You have swapped places with somebody who does a job you have watched. It is your first morning.",
];

/**
 * One prompt, chosen by the seed.
 *
 * Modulo rather than a random draw, and that is the point: the same seed is the
 * same prompt on every machine that builds this page, which is what makes a
 * shared link (§14) and a catalog page reproducible. A negative or fractional
 * seed cannot reach here — `decodeSharedSheet` refuses one — but the guard is
 * cheap and a build that threw on a catalog page would take the whole shelf out.
 */
export function promptAt(seed: number): string {
  const index = Number.isSafeInteger(seed) ? Math.abs(seed) : 0;
  return WRITING_PROMPTS[index % WRITING_PROMPTS.length];
}
