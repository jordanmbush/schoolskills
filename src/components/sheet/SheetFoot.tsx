import type { SheetFooter } from "@/engine/sheets/types";

/**
 * The bottom of the sheet: who made it, where to go next, and which sheet this
 * is.
 *
 * The seed is printed small, so a parent can have *this* sheet again rather
 * than another one like it (§7). The URL is plain text rather than a link: it
 * exists to be read off paper and typed, and a link on a catalog page that
 * points at the site the page is on earns nothing.
 *
 * `source` prints beside the note rather than instead of it, because an answer
 * key of a Scripture sheet has to say both things (§12).
 */
export function SheetFoot({
  footer,
  /** Which page of how many, on a sheet that ran to more than one. */
  page,
}: {
  footer: SheetFooter;
  page?: { at: number; of: number };
}) {
  return (
    <footer className="sheet__foot">
      <span className="sheet__credit">{footer.credit}</span>
      {footer.source && <span className="sheet__source">{footer.source}</span>}
      {footer.note && <span className="sheet__note">{footer.note}</span>}
      {footer.url && <span className="sheet__link">{footer.url}</span>}
      {page && (
        <span className="sheet__page">
          Page {page.at} of {page.of}
        </span>
      )}
      <span className="sheet__seed">#{footer.seed}</span>
    </footer>
  );
}
