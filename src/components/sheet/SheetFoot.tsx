import type { SheetFooter } from "@/engine/sheets/types";

/**
 * The bottom of the sheet: who made it, where to go next, and which sheet this
 * is.
 *
 * The seed is printed small on purpose. A parent who wants *this* sheet again
 * next week — not another one like it — can have it, because the seed is the
 * whole of what generated it (§7). The URL is plain text rather than a link:
 * it exists to be read off paper and typed, and a link on a catalog page that
 * points at the site the page is on earns nothing.
 */
export function SheetFoot({ footer }: { footer: SheetFooter }) {
  return (
    <footer className="sheet__foot">
      <span className="sheet__credit">{footer.credit}</span>
      {footer.note && <span className="sheet__note">{footer.note}</span>}
      {footer.url && <span className="sheet__link">{footer.url}</span>}
      <span className="sheet__seed">#{footer.seed}</span>
    </footer>
  );
}
