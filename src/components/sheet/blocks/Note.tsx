import { ASIDE_EM, noteHeight } from "@/engine/sheets/layout";

import { inch } from "../units";
import type { BlockProps } from "./block";

/**
 * A boxed panel of short sentences: the idea a lesson is about, or the steps
 * of a worked example (§23).
 *
 * The box is a border, not a background, so it prints (§5), and it is drawn
 * exactly as tall as the family reserved — `lines` counted from the characters
 * at the column width, never measured — for the reason every row on a sheet
 * is (§4). An estimate a line short shows here as text crossing the bottom
 * rule, which is the failure a reader can see; a box that grew to fit would
 * push the last block of the page onto a second sheet, which is the one they
 * cannot.
 *
 * The steps are a numbered list whose numbers are written as text, as every
 * list on a sheet writes them: `base.css` strips markers, and this stylesheet
 * has to hold on a page that never loaded it.
 */
export function Note({ block, metrics }: BlockProps<"note">) {
  const pt = block.aside ? metrics.fontPt * ASIDE_EM : metrics.fontPt;
  return (
    <div
      className={`sheet__panel${block.aside ? " sheet__panel--aside" : ""}`}
      style={{ height: inch(noteHeight(block.lines, pt)) }}
    >
      {block.heading && <p className="sheet__panel-heading">{block.heading}</p>}
      {block.text.map((paragraph, index) => (
        <p className="sheet__panel-text" key={index}>
          {paragraph}
        </p>
      ))}
      {block.items && block.items.length > 0 && (
        <ol className="sheet__panel-list">
          {block.items.map((item, index) => (
            <li className="sheet__panel-item" key={index}>
              <span className="sheet__number">{index + 1}.</span>
              {item}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
