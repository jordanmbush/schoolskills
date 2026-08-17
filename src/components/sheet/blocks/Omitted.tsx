/**
 * The words a puzzle could not hold, printed under it.
 *
 * The one line on a sheet whose whole job is to admit a failure, and it earns
 * its ink twice over. A word that silently vanished out of a word search is a
 * child hunting for something that was never there, and a parent marking
 * against a key that does not mention it — the failure looks exactly like
 * success from every angle except the one nobody checks, which is the paper.
 * Naming it turns an invisible bug into a visible one.
 *
 * Shared by both grids rather than written twice, because it is one sentence
 * and it has to be the same sentence: "not in the grid" is the only thing the
 * person marking the sheet needs to know, and it is equally true of a word the
 * placer could not fit and one the page had no room for.
 *
 * The sentence itself comes from the engine (`missingTokens`) rather than from
 * here, for the reason `searchCell` does: the family reserves the page against
 * the rows this line will wrap onto, and a paragraph measured at one length and
 * printed at another is the last line of a sheet on a second sheet of paper.
 * `more` is what the reservation could not name — see `Block.omittedMore`.
 */
import { missingTokens } from "@/engine/sheets/words/puzzles";

export function Omitted({ words, more }: { words?: string[]; more?: number }) {
  const named = words ?? [];
  const rest = more ?? 0;
  if (named.length === 0 && rest === 0) return null;
  return (
    <p className="sheet__missing">{missingTokens(named, rest).join(" ")}</p>
  );
}
