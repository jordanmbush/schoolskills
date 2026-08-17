import type { CSSProperties } from "react";

import { points } from "@/engine/sheets/paper";
import {
  SHAPE_BOX_EMS,
  SHAPE_BOX_GAP_EMS,
  SHAPE_ROW_EMS,
  shapeBand,
} from "@/engine/sheets/words/shapes";
import type { WordShape } from "@/engine/sheets/types";

import { HAIRLINE, inch } from "../units";
import type { BlockProps } from "./block";

/**
 * Words as the outline their letters make, one row of boxes each.
 *
 * The boxes are drawn rather than typed, and that is the whole reason this is a
 * block: a tall box and a small box next to each other is a picture of a word,
 * and there is no arrangement of text that produces it. They are `<rect>`
 * strokes — foreground paint — so they survive a printer with "Background
 * graphics" unticked (§5), which is the setting most people never find and the
 * reason word boxes from elsewhere so often come out as one grey smudge.
 *
 * The word is printed beside its boxes because it is the question. A child
 * copying it in has to decide, letter by letter, which of the three bands each
 * one belongs in — which is the exercise — and the key writes the letters into
 * the boxes so a parent can see where each one was meant to go.
 *
 * Every proportion here comes out of `words/shapes.ts` rather than being chosen
 * again: the family reserved the row against those numbers, and a second set
 * would be a row of boxes overhanging the one beneath it.
 */
export function WordShapes({ block, metrics }: BlockProps<"wordshapes">) {
  const columns = Math.max(1, Math.floor(block.columns));

  return (
    <ol
      className="sheet__wordshapes"
      style={{ "--sheet-columns": columns } as CSSProperties}
    >
      {block.words.map((shape, index) => (
        <li className="sheet__wordshape" key={`${index}-${shape.word}`}>
          <span className="sheet__number">{index + 1}.</span>
          <span className="sheet__prompt">{shape.word}</span>
          <Boxes
            shape={shape}
            fontPt={metrics.fontPt}
            answers={metrics.answers}
          />
        </li>
      ))}
    </ol>
  );
}

/** One word's boxes: a rectangle per letter, in the band that letter sits in. */
function Boxes({
  shape,
  fontPt,
  answers,
}: {
  shape: WordShape;
  fontPt: number;
  answers: boolean;
}) {
  const em = points(fontPt);
  const height = Math.round(em * SHAPE_ROW_EMS);
  const box = Math.round(em * SHAPE_BOX_EMS);
  const gap = Math.round(em * SHAPE_BOX_GAP_EMS);
  const width = shape.letters.length * box + gap * (shape.letters.length - 1);
  if (width <= 0) return null;

  return (
    <svg
      className="sheet__ink sheet__boxes"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Named with a `<title>` rather than `role="img"`: on a key the letters
          are `<text>` inside this `<svg>`, and `role="img"` would replace the
          answer with this one sentence. */}
      <title>{`Boxes for the letters of "${shape.word}"`}</title>

      {shape.letters.map((letter, at) => {
        const band = shapeBand(letter);
        const top = Math.round(height * band.top);
        const tall = Math.round(height * band.bottom) - top;
        const left = at * (box + gap);
        return (
          <g key={at}>
            <rect
              className="sheet__box"
              x={left}
              y={top}
              width={box}
              height={tall}
              strokeWidth={HAIRLINE}
            />
            {answers && (
              <text
                className="sheet__cell sheet__cell--answered"
                x={left + box / 2}
                y={top + tall / 2}
                fontSize={em}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {shape.word[at]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
