import type { HeaderField, SheetHeader } from "@/engine/sheets/types";

/** What each blank is called on paper. */
const FIELD: Record<HeaderField, string> = {
  name: "Name",
  date: "Date",
  class: "Class",
};

/**
 * The top of the sheet: what it is, what to do, and the lines a child fills in.
 *
 * **The name line is printed blank, always.** It is the one field every
 * worksheet on earth asks for and the one thing this site refuses to hold: a
 * `HeaderField` is a marker rather than a value, so there is nowhere in a
 * config for a child's name to be typed and nothing in a shared URL for it to
 * leak through (§1). A pencil fills it in.
 *
 * The title is an `<h2>`. A catalog page is a page *about* a worksheet with the
 * worksheet on it, so its `<h1>` is the page's — and the same component has to
 * be droppable into the builder's preview, where there is no page heading at
 * all. Neither mount gets to be wrong about the outline.
 */
export function SheetHead({ header }: { header: SheetHeader }) {
  const hasLine = header.fields.length > 0 || header.score !== undefined;

  return (
    <header className="sheet__head">
      {header.title && <h2 className="sheet__title">{header.title}</h2>}

      {hasLine && (
        <div className="sheet__fields">
          {header.fields.map((field) => (
            <span className="sheet__field" key={field}>
              <span className="sheet__field-name">{FIELD[field]}</span>
              <span className="sheet__field-rule" />
            </span>
          ))}
          {header.score && (
            <span className="sheet__score">
              <span className="sheet__field-rule sheet__field-rule--short" />
              <span className="sheet__field-name">/ {header.score.outOf}</span>
            </span>
          )}
        </div>
      )}

      {header.instructions && (
        <p className="sheet__instructions">{header.instructions}</p>
      )}
    </header>
  );
}
