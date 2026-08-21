/**
 * A whole cut into equal parts, as strokes and one fill.
 *
 * The bar and the circle a naming sheet asks about. Unlike every other drawing
 * on a sheet this one has ink *inside* it — the shaded parts are the question,
 * so they have to be visible on the blank sheet a child is handed, not only on
 * the key.
 *
 * That is why the shading is an SVG `fill` and not a CSS background: a browser
 * drops background paint when printing (§5), and a naming sheet whose pictures
 * came out as a row of empty boxes asks a question that isn't there. `fill` is
 * graphics content and prints either way. It is set at a fraction of the ink so
 * that thirty of these a week is not thirty pages of toner.
 *
 * The sizes come from the engine (`fractionart.ts`), which is the same module
 * the family reserved the row height with — so the drawing cannot come out
 * taller than the space that was kept for it.
 */
import { artHeight, artWidth } from "@/engine/sheets/fractionart";
import type { FractionArt, Mil } from "@/engine/sheets/types";

import { HAIRLINE, RULE, inch } from "./units";

/** Half the outline, so a stroke on the edge of the box isn't cut in half. */
const INSET = Math.round(RULE / 2);

export function FractionArtView({ art }: { art: FractionArt }) {
  const width = artWidth(art);
  const height = artHeight(art);
  if (art.parts < 1) return null;

  return (
    <svg
      className="sheet__ink sheet__art"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      // The picture *is* the question, so describing it is not giving anything
      // away — it is handing a child who can't see it exactly what a child who
      // can is looking at. The fraction itself is never said.
      aria-label={`A ${art.shape} in ${art.parts} equal parts, ${art.shaded} shaded`}
    >
      {art.shape === "circle" ? (
        <Pie art={art} size={Math.min(width, height)} />
      ) : (
        <Bar art={art} width={width} height={height} />
      )}
    </svg>
  );
}

/**
 * A bar in `parts` equal cells, the first `shaded` of them filled.
 *
 * The cuts are computed from the index rather than accumulated, exactly as the
 * rule positions on a page are: the last cell is then as wide as the first,
 * whatever the rounding did in between.
 */
function Bar({
  art,
  width,
  height,
}: {
  art: FractionArt;
  width: Mil;
  height: Mil;
}) {
  const span = width - INSET * 2;
  const at = (part: number) => INSET + Math.round((part * span) / art.parts);

  return (
    <>
      {art.shaded > 0 && (
        <rect
          className="sheet__shade"
          x={at(0)}
          y={INSET}
          width={at(art.shaded) - at(0)}
          height={height - INSET * 2}
        />
      )}
      <rect
        className="sheet__shape"
        x={INSET}
        y={INSET}
        width={span}
        height={height - INSET * 2}
        strokeWidth={RULE}
      />
      {/* One line per cut, which is one fewer than there are parts: the two
          ends of the bar are its own outline. */}
      {Array.from({ length: art.parts - 1 }, (_, cut) => (
        <line
          className="sheet__rule"
          key={cut}
          x1={at(cut + 1)}
          x2={at(cut + 1)}
          y1={INSET}
          y2={height - INSET}
          strokeWidth={HAIRLINE}
        />
      ))}
    </>
  );
}

/**
 * A circle cut into `parts` equal slices, the first `shaded` of them filled.
 *
 * The shading is one wedge rather than one per slice — the shaded parts are
 * always the first of them, so a single arc is the whole region and there are
 * no seams between two fills at the same opacity.
 */
function Pie({ art, size }: { art: FractionArt; size: Mil }) {
  const radius = Math.round(size / 2) - INSET;
  const centre = Math.round(size / 2);
  const step = 360 / art.parts;
  const at = (degrees: number) => ({
    x: Math.round(centre + radius * Math.sin((degrees * Math.PI) / 180)),
    y: Math.round(centre - radius * Math.cos((degrees * Math.PI) / 180)),
  });

  const filled = art.shaded * step;
  const start = at(0);
  const end = at(filled);

  return (
    <>
      {art.shaded >= art.parts ? (
        // A whole circle shaded. Drawn as a circle rather than as a 360° wedge,
        // because an arc that ends where it began draws nothing at all.
        <circle className="sheet__shade" cx={centre} cy={centre} r={radius} />
      ) : (
        art.shaded > 0 && (
          <path
            className="sheet__shade"
            d={`M ${centre} ${centre} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${
              filled > 180 ? 1 : 0
            } 1 ${end.x} ${end.y} Z`}
          />
        )
      )}
      <circle
        className="sheet__shape"
        cx={centre}
        cy={centre}
        r={radius}
        strokeWidth={RULE}
      />
      {/* A cut from the middle to the edge for each slice. Every one of them is
          drawn, including the one at twelve o'clock: a circle in halves needs
          the line across it, and the outline is not that line. */}
      {Array.from({ length: art.parts }, (_, cut) => {
        const edge = at(cut * step);
        return (
          <line
            className="sheet__rule"
            key={cut}
            x1={centre}
            y1={centre}
            x2={edge.x}
            y2={edge.y}
            strokeWidth={HAIRLINE}
          />
        );
      })}
    </>
  );
}
