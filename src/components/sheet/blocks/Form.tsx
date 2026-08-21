import { faceOf } from "@/engine/sheets/faces";
import { points } from "@/engine/sheets/paper";
import type { FormField, Mil } from "@/engine/sheets/types";

import { fitText } from "../text";
import { HAIRLINE, RULE, inch } from "../units";
import type { BlockProps } from "./block";

/**
 * The share of the body size a field's heading is set at, and the leading it
 * sits on — trailing `.sheet__form-label` in sheet.css, exactly as `chrome.ts`
 * trails the header. Their product is what `templates/forms.ts` reserves per
 * row, so a change to either belongs in both places or in neither.
 */
const LABEL_EM = 0.85;

/** How much of its own width a heading may take before it is set smaller. */
const LABEL_FILL = 0.98;

/**
 * A blank form: labelled boxes to write in.
 *
 * The heading is real HTML text and the box under it is one `<svg>`, which is
 * the split every block on a sheet makes: what a reader reads is markup a
 * crawler can index (§2), and what a child writes on is a stroke, because a
 * stroke survives a printer with background graphics switched off (§5).
 *
 * **Nothing here decides how big a box is.** The width and the height of every
 * one come off the block — `templates/forms.ts` divided the page into them and
 * knows what fits — so a second opinion in this file would be a form an inch
 * too long, which `.sheet` hides because it is `min-height` and a printer does
 * not. What this file owns is where the rules go *inside* a box, and how small
 * a heading has to be set to stay in the box it names.
 */
export function Form({ block, metrics }: BlockProps<"form">) {
  // One size for every heading, measured field by field because the fields are
  // different widths — see `fitText`.
  const size = block.fields.reduce(
    (smallest, field) =>
      Math.min(
        smallest,
        fitText(
          [field.label],
          field.width,
          points(metrics.fontPt * LABEL_EM),
          faceOf(metrics.font),
          LABEL_FILL,
        ),
      ),
    points(metrics.fontPt * LABEL_EM),
  );

  return (
    <div className="sheet__form">
      {block.fields.map((field, index) => (
        <div
          className="sheet__form-field"
          key={index}
          style={{ width: inch(field.width) }}
        >
          <span className="sheet__form-label" style={{ fontSize: inch(size) }}>
            {field.label}
          </span>
          <Ruled field={field} />
        </div>
      ))}
    </div>
  );
}

/**
 * The box under a heading, and the lines in it.
 *
 * A box with `n` lines has `n − 1` rules drawn across it, because the bottom
 * edge of the box is the last line: a child writes *on* a rule, so a four-line
 * box is a rectangle with three rules through it and four places to write. The
 * alternative — four rules and a floating bottom edge — prints a box with an
 * empty strip along the bottom and a line to write on that is not attached to
 * anything.
 *
 * `lines: 0` is the box a child draws in. It gets the rectangle and nothing
 * else, which is the whole difference between "what I saw" and "what I noticed
 * about it" on an observation journal.
 */
function Ruled({ field }: { field: FormField }) {
  const { width, space, lines } = field;
  if (width <= 0 || space <= 0) return null;

  // Where each rule falls: the box divided by the number of places to write, so
  // every line in it is the same height and the last of them is the box's own
  // bottom edge. The family sized the box so that height is never less than
  // `answerLine` — a quarter of an inch, and never less than the type needs.
  const pitch: Mil = lines > 0 ? space / lines : 0;

  return (
    <svg
      className="sheet__ink sheet__form-box"
      width={inch(width)}
      height={inch(space)}
      viewBox={`0 0 ${width} ${space}`}
      aria-hidden="true"
    >
      {/* Inset by half a stroke at every edge, because a stroke straddles the
          line it is drawn on: a rectangle at x=0 loses the outer half of its
          left edge to the viewBox, and prints lighter down two sides than the
          other two. */}
      <rect
        className="sheet__box"
        x={HAIRLINE / 2}
        y={HAIRLINE / 2}
        width={Math.max(0, width - HAIRLINE)}
        height={Math.max(0, space - HAIRLINE)}
        strokeWidth={HAIRLINE}
      />
      {Array.from({ length: Math.max(0, lines - 1) }, (_, index) => (
        <line
          className="sheet__rule"
          key={index}
          x1={0}
          x2={width}
          y1={Math.round(pitch * (index + 1))}
          y2={Math.round(pitch * (index + 1))}
          strokeWidth={RULE}
        />
      ))}
    </svg>
  );
}
