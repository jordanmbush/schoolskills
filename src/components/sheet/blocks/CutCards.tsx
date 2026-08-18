import type { CSSProperties } from "react";

import type { CardFace, Mil } from "@/engine/sheets/types";

import { DASH_CUT, DASH_FOLD, HEAVY, RULE, inch, inside } from "../units";
import type { BlockProps } from "./block";

/** How many rules a face gets when it asks for more than a card can hold. */
const MAX_LINES = 12;

/**
 * Cards to cut out, at a stated size, with the cuts marked where they go.
 *
 * Two layers over one rectangle, and the split is the whole design. The cards
 * themselves are ordinary HTML in a grid whose track sizes are inches, so what
 * is printed on them is real text a crawler reads and a reader can select (§2).
 * The guides are one `<svg>` laid over the top, in a mil viewBox, so every cut
 * line lands exactly on a card boundary rather than near one.
 *
 * **The guides are not borders.** Two adjacent cards with a dashed border each
 * print two dashed lines a hairline apart, whose dashes do not line up, on the
 * one line somebody is about to follow with a pair of scissors. Drawn over the
 * top there is one line per boundary, and it is the boundary.
 *
 * **The outside edge is a cut line too.** A sheet whose outer trim is unmarked
 * is a sheet cut freehand, and freehand is where the white sliver down one side
 * of every other card comes from.
 *
 * The block is centred by `.sheet__cut`, which is the other half of the same
 * promise: whatever the cards did not use is split evenly to the left and the
 * right of them, so a stack of cut sheets is square with itself.
 */
export function CutCards({ block }: BlockProps<"cutcards">) {
  const { card, columns, rows, faces, frame, fold } = block;
  const width = columns * card.width;
  const height = rows * card.height;
  if (width <= 0 || height <= 0) return null;

  return (
    <div
      className="sheet__cut"
      style={{ width: inch(width), height: inch(height) }}
    >
      <ol
        className="sheet__cut-grid"
        style={
          {
            "--sheet-columns": columns,
            "--card-w": inch(card.width),
            "--card-h": inch(card.height),
          } as CSSProperties
        }
      >
        {faces.slice(0, columns * rows).map((face, index) => (
          <li className="sheet__cut-card" key={index}>
            {/* A tent is two panels of the same piece of paper, so they cannot
                be out of register with each other — which is the whole reason
                this is offered where a printed back is not. The upper one is
                turned round because folding it back and down turns it round. */}
            {fold && (
              <Panel face={face} frame={frame} ems={block.headingEms} flipped />
            )}
            <Panel face={face} frame={frame} ems={block.headingEms} />
          </li>
        ))}
      </ol>
      <Guides card={card} columns={columns} rows={rows} fold={fold === true} />
    </div>
  );
}

/**
 * One side of a card.
 *
 * The order is fixed and is the order a card is read in: what it says above the
 * big line, the big line, the words under it, then the places to write. A
 * certificate uses all four; a blank flashcard uses none of them and is a
 * rectangle, which is what it is for.
 */
function Panel({
  face,
  frame,
  ems,
  flipped = false,
}: {
  face: CardFace;
  frame: "plain" | "award";
  ems: number;
  flipped?: boolean;
}) {
  return (
    <div
      className={[
        "sheet__cut-panel",
        frame === "award" ? "sheet__cut-panel--award" : "",
        flipped ? "sheet__cut-panel--flipped" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {face.eyebrow && (
        <span className="sheet__cut-eyebrow">{face.eyebrow}</span>
      )}
      {face.heading && (
        <span className="sheet__cut-heading" style={{ fontSize: `${ems}em` }}>
          {face.heading}
        </span>
      )}
      {face.body && <span className="sheet__cut-body">{face.body}</span>}
      {(face.fields ?? []).map((field, index) => (
        <span className="sheet__cut-field" key={index}>
          <span className="sheet__cut-rule" />
          <span className="sheet__cut-for">{field}</span>
        </span>
      ))}
      {Array.from(
        { length: Math.min(MAX_LINES, Math.max(0, face.lines ?? 0)) },
        (_, index) => (
          <span className="sheet__cut-rule" key={`l${index}`} />
        ),
      )}
    </div>
  );
}

/**
 * Where to cut, and where to fold.
 *
 * `HEAVY` and the long dash for cutting, for the reason `Cutline` gives: a cut
 * line is read before it is used and must not be mistaken for a rule to write
 * on. A fold is a lighter weight and a finer dash, because it is the same
 * instruction one step down — and because a sheet on which the two looked alike
 * is a card cut in half.
 */
function Guides({
  card,
  columns,
  rows,
  fold,
}: {
  card: { width: Mil; height: Mil };
  columns: number;
  rows: number;
  fold: boolean;
}) {
  const width = columns * card.width;
  const height = rows * card.height;

  return (
    <svg
      className="sheet__ink sheet__cut-guides"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={
        fold
          ? "Cut along these lines and fold along the finer ones"
          : "Cut along these lines"
      }
    >
      {Array.from({ length: columns + 1 }, (_, index) => (
        <line
          className="sheet__rule sheet__rule--cut"
          key={`v${index}`}
          x1={inside(index * card.width, width, HEAVY)}
          x2={inside(index * card.width, width, HEAVY)}
          y1={0}
          y2={height}
          strokeWidth={HEAVY}
          strokeDasharray={DASH_CUT}
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, index) => (
        <line
          className="sheet__rule sheet__rule--cut"
          key={`h${index}`}
          x1={0}
          x2={width}
          y1={inside(index * card.height, height, HEAVY)}
          y2={inside(index * card.height, height, HEAVY)}
          strokeWidth={HEAVY}
          strokeDasharray={DASH_CUT}
        />
      ))}
      {fold &&
        Array.from({ length: rows }, (_, index) => {
          // Exactly halfway down the card, which is the whole of what makes the
          // two panels the same size when it is folded. Anywhere else and the
          // tent leans.
          const y = (index + 0.5) * card.height;
          return (
            <line
              className="sheet__rule sheet__rule--fold"
              key={`f${index}`}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              strokeWidth={RULE}
              strokeDasharray={DASH_FOLD}
            />
          );
        })}
    </svg>
  );
}
