import { points } from "@/engine/sheets/paper";
import type {
  Mil,
  Net as NetSpec,
  NetEdge,
  NetFace,
} from "@/engine/sheets/types";

import { DASH_CUT, DASH_FOLD, HEAVY, RULE, inch, inside } from "../units";

/** How big a pip is, as a share of the face it sits on. */
const PIP = 0.06;

/** Where the pips go, on a face divided into thirds. */
const SPOTS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

/** How far the ink may go: the drawing's own box, for `inside`. */
type Extent = { width: Mil; height: Mil };

/**
 * A cube net: six squares, five folds, seven glue tabs.
 *
 * Everything about where the squares are and which edges carry tabs comes off
 * the block, because both are facts about *folding* rather than about drawing
 * (`templates/nets.ts`). What this file owns is the ink: a heavy dashed outline
 * where the scissors go, a finer dashed line on every fold, and the spots.
 *
 * The outline is drawn as the outside edge of each face and tab rather than as
 * one traced path, which is the honest simplification: a stroke on a shared
 * edge is a fold and is drawn as one, and every other edge is a cut. Tracing
 * the silhouette would look identical and would be a second description of the
 * same shape.
 *
 * **The silhouette touches all four sides of its own box** — the tab above the
 * top row, the tabs beyond the left and right columns, and the bottom of the
 * last face — and an `<svg>` clips to its box, so each of those cut lines would
 * print at half the weight of the identical cut two inches away, on a drawing
 * whose whole content is where to cut. `inside` holds them the half-stroke in
 * for that reason; the trade it makes is written out in `units.ts`. Nothing
 * that decides the shape of the folded cube moves, because every fold line is
 * interior and is drawn exactly where it falls.
 */
export function Cube({
  net,
  fontPt,
}: {
  net: Extract<NetSpec, { shape: "cube" }>;
  fontPt: number;
}) {
  const { edge, columns, rows, faces, tabs, tab } = net;
  if (edge <= 0) return null;

  // The drawing is the grid plus the tabs that stick out past it: one to the
  // left of the left column, one to the right of the right column, one above
  // the top row. Everything is offset by that so nothing is drawn at a negative
  // coordinate, which an `<svg>` viewBox would clip away.
  const width = columns * edge + 2 * tab;
  const height = rows * edge + tab;
  const box: Extent = { width, height };
  const at = (index: number) => ({
    x: tab + (index % columns) * edge,
    y: tab + Math.floor(index / columns) * edge,
  });

  const drawn = faces.flatMap((face, index) =>
    face ? [[index, face] as [number, NetFace]] : [],
  );
  const label = points(fontPt);

  return (
    <svg
      className="sheet__ink sheet__net"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="A cube net to cut out and fold into a die"
    >
      {/* The tabs first, so a face's own outline is drawn over the join. */}
      {tabs.map((entry, index) => (
        <Tab
          key={`t${index}`}
          at={at(entry.face)}
          edge={edge}
          tab={tab}
          side={entry.edge}
          box={box}
        />
      ))}

      {drawn.map(([index]) => {
        const { x, y } = at(index);
        // Drawn from its four held-in edges rather than from a width and a
        // height, because only the ones on the boundary move: a face in the
        // middle of the net is still exactly `edge` on a side.
        const left = inside(x, width, HEAVY);
        const right = inside(x + edge, width, HEAVY);
        const top = inside(y, height, HEAVY);
        const bottom = inside(y + edge, height, HEAVY);
        return (
          <rect
            className="sheet__rule sheet__rule--cut"
            key={`f${index}`}
            x={left}
            y={top}
            width={right - left}
            height={bottom - top}
            strokeWidth={HEAVY}
            strokeDasharray={DASH_CUT}
          />
        );
      })}

      {/* The folds: every edge two faces share. Found by looking for the face
          next door rather than listed, so a net laid out differently would fold
          in the right places without anybody rewriting this. */}
      {drawn.flatMap(([index]) =>
        [
          [1, 0],
          [0, 1],
        ].flatMap(([dx, dy]) => {
          const column = index % columns;
          const neighbour = index + dx + dy * columns;
          if (dx === 1 && column === columns - 1) return [];
          if (!faces[neighbour]) return [];
          const { x, y } = at(index);
          return [
            <line
              className="sheet__rule sheet__rule--fold"
              key={`d${index}-${dx}`}
              x1={x + dx * edge}
              x2={x + dx * edge + dy * edge}
              y1={y + dy * edge}
              y2={y + dy * edge + dx * edge}
              strokeWidth={RULE}
              strokeDasharray={DASH_FOLD}
            />,
          ];
        }),
      )}

      {drawn.map(([index, face]) => {
        const { x, y } = at(index);
        if (face.pips > 0)
          return (
            <g className="sheet__pips" key={`p${index}`}>
              {(SPOTS[face.pips] ?? []).map(([column, row], spot) => (
                <circle
                  className="sheet__dot"
                  key={spot}
                  cx={x + (column + 1) * (edge / 4)}
                  cy={y + (row + 1) * (edge / 4)}
                  r={Math.max(1, Math.round(edge * PIP))}
                />
              ))}
            </g>
          );
        return (
          <text
            className="sheet__cell"
            key={`w${index}`}
            x={x + edge / 2}
            y={y + edge / 2}
            fontSize={label}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {face.label}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * One glue tab: a trapezium off the edge it hangs from.
 *
 * Tapered rather than square, and that is not decoration — a rectangular tab
 * binds against the tab beside it as the last face closes, and the cube stops
 * an eighth of an inch short of shut. The taper is what lets the two slide past
 * each other.
 */
function Tab({
  at,
  edge,
  tab,
  side,
  box,
}: {
  at: { x: Mil; y: Mil };
  edge: Mil;
  tab: Mil;
  side: NetEdge;
  box: Extent;
}) {
  const inset = Math.round(tab * 0.6);
  const { x, y } = at;
  const corners: Record<NetEdge, Array<[Mil, Mil]>> = {
    top: [
      [x, y],
      [x + inset, y - tab],
      [x + edge - inset, y - tab],
      [x + edge, y],
    ],
    bottom: [
      [x, y + edge],
      [x + inset, y + edge + tab],
      [x + edge - inset, y + edge + tab],
      [x + edge, y + edge],
    ],
    left: [
      [x, y],
      [x - tab, y + inset],
      [x - tab, y + edge - inset],
      [x, y + edge],
    ],
    right: [
      [x + edge, y],
      [x + edge + tab, y + inset],
      [x + edge + tab, y + edge - inset],
      [x + edge, y + edge],
    ],
  };

  return (
    <polygon
      className="sheet__rule sheet__rule--cut"
      points={corners[side]
        .map(
          ([px, py]) =>
            `${inside(px, box.width, HEAVY)},${inside(py, box.height, HEAVY)}`,
        )
        .join(" ")}
      strokeWidth={HEAVY}
      strokeDasharray={DASH_CUT}
    />
  );
}
