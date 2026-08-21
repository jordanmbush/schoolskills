import { describe, expect, it } from "vitest";

import { printedBlockBox } from "../chrome";
import { MARGINS, toInches } from "../paper";
import type {
  MarginSize,
  Net,
  NetConfig,
  NetEdge,
  NetStyle,
  PaperSize,
  Sheet,
} from "../types";
import { buildSheet, describeSheet, sheetSpec } from "../index";
import { describeSheetFamily } from "../contract";

import { CARD_STEP } from "./cards";
import {
  DICE_PAIR,
  DICE_TABS,
  JOINS,
  NET_SHEET,
  OPPOSITE,
  SECTORS,
  cubeEdge,
  netKeyed,
} from "./nets";

/**
 * The die, folded.
 *
 * `fold()` below walks the net face by face, carrying an orientation, and works
 * out which way each square ends up pointing in three dimensions — a completely
 * different route to the answer from the table in `nets.ts`, which is what
 * makes the claim independent rather than a restatement. Everything else about
 * the die falls out of the same walk: the seven joins are the seven cube edges
 * no fold covers, and the seven tabs are one per join.
 *
 * The spinner's one claim is a claim about arithmetic that isn't there — see
 * §11 — so what the suite checks is that the block carries no angles.
 */

const config = (over: Partial<NetConfig> = {}): NetConfig => ({
  kind: "net",
  style: "dice",
  paper: { size: "letter", orientation: "portrait", margin: "normal" },
  fontPt: 12,
  fields: [],
  ...over,
});

/** The one net on a sheet, or a failure that says so. */
function netOf(sheet: Sheet): Net {
  const blocks = sheet.blocks.filter((block) => block.kind === "net");
  expect(blocks).toHaveLength(1);
  return blocks[0].net;
}

const cubeOf = (sheet: Sheet) => {
  const net = netOf(sheet);
  if (net.shape !== "cube") throw new Error("not a cube net");
  return net;
};

const spinnerOf = (sheet: Sheet) => {
  const net = netOf(sheet);
  if (net.shape !== "spinner") throw new Error("not a spinner");
  return net;
};

/* ── Folding it up ─────────────────────────────────────────────────────── */

type Vec = readonly [number, number, number];
const negate = ([x, y, z]: Vec): Vec => [-x, -y, -z];
const name = (v: Vec) => v.join(",");

/** A face's orientation once the net is folded: where it points, and which way up. */
type Frame = { normal: Vec; up: Vec; right: Vec };

/**
 * The frame of the square next door, once the fold is made.
 *
 * Four rotations, one per direction on the paper, each a quarter turn about the
 * edge the two squares share. Reading the first: fold the square to the *right*
 * away from the reader, and it becomes the face pointing where "right" used to
 * point; its own right now points into the page, which is where the old normal
 * pointed from behind. Up is unchanged, because the fold was about a vertical
 * edge.
 */
function step(frame: Frame, towards: NetEdge): Frame {
  const { normal, up, right } = frame;
  switch (towards) {
    case "right":
      return { normal: right, right: negate(normal), up };
    case "left":
      return { normal: negate(right), right: normal, up };
    case "bottom":
      return { normal: negate(up), up: normal, right };
    case "top":
      return { normal: up, up: negate(normal), right };
  }
}

/** Which cube face an edge of a square borders, once it is all folded up. */
function beyond(frame: Frame, edge: NetEdge): Vec {
  if (edge === "top") return frame.up;
  if (edge === "bottom") return negate(frame.up);
  if (edge === "right") return frame.right;
  return negate(frame.right);
}

/**
 * Every face of the net, folded into three dimensions.
 *
 * A breadth-first walk from the middle square with a frame carried along, which
 * is exactly what a pair of hands does. Nothing here reads `OPPOSITE` or
 * `JOINS` — that is the point.
 */
function fold(net: Extract<Net, { shape: "cube" }>): Map<number, Frame> {
  const start = net.faces.findIndex((face) => face !== null);
  const frames = new Map<number, Frame>([
    [start, { normal: [0, 0, 1], up: [0, 1, 0], right: [1, 0, 0] }],
  ]);
  const queue = [start];

  while (queue.length > 0) {
    const at = queue.shift()!;
    const frame = frames.get(at)!;
    const column = at % net.columns;
    const moves: Array<[NetEdge, number]> = [
      ["right", column + 1 < net.columns ? at + 1 : -1],
      ["left", column > 0 ? at - 1 : -1],
      ["bottom", at + net.columns],
      ["top", at - net.columns],
    ];
    for (const [towards, next] of moves) {
      if (next < 0 || next >= net.faces.length) continue;
      if (!net.faces[next] || frames.has(next)) continue;
      frames.set(next, step(frame, towards));
      queue.push(next);
    }
  }
  return frames;
}

/** The edges of a square that no fold covers — the ones that get glued. */
function freeEdges(
  net: Extract<Net, { shape: "cube" }>,
): Array<[number, NetEdge]> {
  const out: Array<[number, NetEdge]> = [];
  net.faces.forEach((face, at) => {
    if (!face) return;
    const column = at % net.columns;
    const beside: Array<[NetEdge, number]> = [
      ["right", column + 1 < net.columns ? at + 1 : -1],
      ["left", column > 0 ? at - 1 : -1],
      ["bottom", at + net.columns],
      ["top", at - net.columns],
    ];
    for (const [edge, next] of beside) {
      const joined =
        next >= 0 && next < net.faces.length && Boolean(net.faces[next]);
      if (!joined) out.push([at, edge]);
    }
  });
  return out;
}

/** Which cube edge a free edge lies on: the two faces that meet along it. */
function cubeEdgeOf(
  frames: Map<number, Frame>,
  [at, edge]: [number, NetEdge],
): string {
  const frame = frames.get(at)!;
  return [name(frame.normal), name(beyond(frame, edge))].sort().join(" | ");
}

/* ── The die ───────────────────────────────────────────────────────────── */

describe("a die, folded up", () => {
  it("has six faces pointing six different ways", () => {
    const net = cubeOf(buildSheet(config(), 1));
    const frames = fold(net);
    expect(frames.size).toBe(6);
    expect(new Set([...frames.values()].map((f) => name(f.normal))).size).toBe(
      6,
    );
  });

  it("puts opposite faces opposite, and they add to seven", () => {
    // The claim the whole thing turns on, reached by folding rather than by
    // reading the table that wrote the numbers.
    const net = cubeOf(buildSheet(config(), 1));
    const frames = fold(net);
    const byNormal = new Map(
      [...frames].map(([at, frame]) => [name(frame.normal), at]),
    );

    const found: Array<[number, number]> = [];
    for (const [at, frame] of frames) {
      const across = byNormal.get(name(negate(frame.normal)));
      expect(across, `nothing opposite face ${at}`).toBeDefined();
      if (at < across!) found.push([at, across!]);
    }
    expect(found).toHaveLength(3);

    for (const [a, b] of found) {
      const pips = (net.faces[a]?.pips ?? 0) + (net.faces[b]?.pips ?? 0);
      expect(pips, `faces ${a} and ${b}`).toBe(DICE_PAIR);
    }

    // And the table the family derives its numbering from says the same three
    // pairs — which is the half of the claim the family is responsible for.
    const asSets = (pairs: Array<[number, number]>) =>
      new Set(pairs.map(([a, b]) => [a, b].sort((x, y) => x - y).join(":")));
    expect(asSets(found)).toEqual(asSets(OPPOSITE));
  });

  it("uses each of the six numbers once", () => {
    const net = cubeOf(buildSheet(config(), 1));
    const pips = net.faces
      .filter((face) => face !== null)
      .map((face) => face!.pips)
      .sort((a, b) => a - b);
    expect(pips).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("leaves fourteen free edges, which are seven joins", () => {
    // A cube has twelve edges; five of them are folds in this net; the other
    // seven have to be glued, and each is two free edges meeting.
    const net = cubeOf(buildSheet(config(), 1));
    const frames = fold(net);
    const free = freeEdges(net);
    expect(free).toHaveLength(14);

    const counted = new Map<string, number>();
    for (const edge of free) {
      const key = cubeEdgeOf(frames, edge);
      counted.set(key, (counted.get(key) ?? 0) + 1);
    }
    expect(counted.size).toBe(7);
    expect([...counted.values()].every((count) => count === 2)).toBe(true);
  });

  it("pairs the joins the way the family says it does", () => {
    // Each entry of `JOINS` claims two free edges meet. Folded up, the two have
    // to lie on the same cube edge — and the seven have to be seven different
    // ones, or a tab is glued to a tab.
    const net = cubeOf(buildSheet(config(), 1));
    const frames = fold(net);
    const seen = new Set<string>();

    for (const [left, right] of JOINS) {
      const a = cubeEdgeOf(frames, left);
      const b = cubeEdgeOf(frames, right);
      expect(a, `join ${left.join(".")} ↔ ${right.join(".")}`).toBe(b);
      expect(seen.has(a)).toBe(false);
      seen.add(a);
    }
    expect(seen.size).toBe(7);
  });

  it("puts exactly one tab on every join", () => {
    // Two tabs on a join is a lump that stops the cube closing; none is a hole.
    const net = cubeOf(buildSheet(config(), 1));
    const frames = fold(net);
    const free = new Set(freeEdges(net).map(([at, edge]) => `${at}.${edge}`));

    expect(net.tabs).toHaveLength(7);
    expect(DICE_TABS).toHaveLength(7);
    const joins = new Set<string>();
    for (const tab of net.tabs) {
      expect(
        free.has(`${tab.face}.${tab.edge}`),
        `${tab.face}.${tab.edge}`,
      ).toBe(true);
      joins.add(cubeEdgeOf(frames, [tab.face, tab.edge]));
    }
    expect(joins.size).toBe(7);
  });

  it("measures a whole number of eighths of an inch on a side", () => {
    // Quoted on the catalog page, so a ruler has to be able to settle it.
    for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
      for (const margin of Object.keys(MARGINS) as MarginSize[]) {
        const sheet = buildSheet(
          config({ paper: { size, orientation: "portrait", margin } }),
          1,
        );
        const net = sheet.blocks.find((block) => block.kind === "net")?.net;
        if (!net || net.shape !== "cube") continue;
        expect(net.edge % CARD_STEP, `${size}/${margin}`).toBe(0);
        // And the drawing, tabs included, is inside the page.
        const box = printedBlockBox(sheet);
        expect(net.columns * net.edge + 2 * net.tab).toBeLessThanOrEqual(
          box.width,
        );
        expect(net.rows * net.edge + net.tab).toBeLessThanOrEqual(box.height);
      }
    }
  });

  it("writes a parent's words on the faces instead of the spots", () => {
    // The version most homeschool rooms cut out. In the order a die counts, so
    // the first word is on the face somebody would call one.
    const net = cubeOf(
      buildSheet(
        config({ labels: ["one", "two", "three", "four", "five", "six"] }),
        1,
      ),
    );
    const written = net.faces.filter((face) => face !== null);
    expect(written).toHaveLength(6);
    expect(written.every((face) => face!.pips === 0)).toBe(true);
    // Face "one" is the one that would have carried a single spot.
    const numbering = cubeOf(buildSheet(config(), 1)).faces;
    net.faces.forEach((face, at) => {
      if (!face) return;
      const pips = numbering[at]!.pips;
      expect(face.label).toBe(
        ["one", "two", "three", "four", "five", "six"][pips - 1],
      );
    });
  });

  it("names the die by what a ruler would find", () => {
    const sheet = buildSheet(config(), 1);
    const net = cubeOf(sheet);
    expect(describeSheet(config())).toContain(String(toInches(net.edge)));
    expect(describeSheet(config())).toContain(`adding to ${DICE_PAIR}`);
    expect(cubeEdge(printedBlockBox(sheet))).toBe(net.edge);
  });
});

/* ── The spinner ───────────────────────────────────────────────────────── */

describe("a spinner", () => {
  it("carries no angles at all, so the sectors cannot be unequal", () => {
    // The design, stated as a test: a whole turn divided by how many labels
    // there are is the only geometry there is, and there is nowhere on the
    // block for a longer word to have talked its way into a wider slice.
    const net = spinnerOf(
      buildSheet(
        config({
          style: "spinner",
          sectors: 4,
          labels: ["a word that is very long indeed", "b", "c", "d"],
        }),
        1,
      ),
    );
    expect(net.sectors).toEqual([
      "a word that is very long indeed",
      "b",
      "c",
      "d",
    ]);
    expect(Object.keys(net)).toEqual(["shape", "radius", "sectors", "pointer"]);
  });

  it("numbers the sectors when nobody has named them", () => {
    const net = spinnerOf(
      buildSheet(config({ style: "spinner", sectors: 8 }), 1),
    );
    expect(net.sectors).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("holds the count inside what a spinner can be", () => {
    const few = spinnerOf(
      buildSheet(config({ style: "spinner", sectors: 1 }), 1),
    );
    expect(few.sectors).toHaveLength(SECTORS.min);
    const many = spinnerOf(
      buildSheet(config({ style: "spinner", sectors: 99 }), 1),
    );
    expect(many.sectors).toHaveLength(SECTORS.max);
  });

  it("leaves the pointer on the same page as the dial", () => {
    // Solved for rather than set: a dial sized to the page and a pointer added
    // underneath is a pointer below the bottom margin.
    for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
      for (const margin of Object.keys(MARGINS) as MarginSize[]) {
        const sheet = buildSheet(
          config({
            style: "spinner",
            paper: { size, orientation: "portrait", margin },
          }),
          1,
        );
        const net = sheet.blocks.find((block) => block.kind === "net")?.net;
        if (!net || net.shape !== "spinner") continue;
        const where = `${size}/${margin}`;
        const box = printedBlockBox(sheet);
        expect(2 * net.radius, where).toBeLessThanOrEqual(box.width);
        expect(
          2 * net.radius + net.pointer.width * 2,
          where,
        ).toBeLessThanOrEqual(box.height);
        expect(net.pointer.length).toBeLessThanOrEqual(2 * net.radius);
      }
    }
  });

  it("names the angle a sector actually is", () => {
    expect(describeSheet(config({ style: "spinner", sectors: 6 }))).toContain(
      "6 equal sectors of 60°",
    );
    expect(describeSheet(config({ style: "spinner", sectors: 4 }))).toContain(
      "4 equal sectors of 90°",
    );
  });

  it("quotes no angle where a whole turn does not divide into the count", () => {
    // Rounded, seven sectors read as "7 equal sectors of 51°" — a sum that
    // comes to 357, on the one object whose whole purpose is "do you think this
    // is fair?". Every count on offer either names an angle that multiplies
    // back to a whole turn, or names none.
    for (let sectors = SECTORS.min; sectors <= SECTORS.max; sectors++) {
      const said = describeSheet(config({ style: "spinner", sectors }));
      expect(said, `${sectors}`).toContain(`${sectors} equal sectors`);
      const quoted = /of (\d+)°/.exec(said);
      if (quoted) expect(Number(quoted[1]) * sectors, `${sectors}`).toBe(360);
      else expect(360 % sectors, `${sectors}`).not.toBe(0);
    }
  });
});

/* ── The promises every family makes ───────────────────────────────────── */

describeSheetFamily("net", {
  label: "Dice and spinners",
  spec: NET_SHEET,
  config,
  shapes: (["dice", "spinner"] as NetStyle[]).map((style) => ({
    style,
    labels: ["a", "b"],
  })),
  keyed: netKeyed,
});

describe("the nets family", () => {
  it("withholds nothing, and says so where a page can ask", () => {
    expect(netKeyed()).toBe(false);
    const sheet = buildSheet(config(), 1);
    const key = sheetSpec("net").key(sheet);
    expect(key.blocks).toEqual(sheet.blocks);
    expect(key.footer.note).toBe("Answer key");
  });

  it("prints a page from a config that arrived from outside this build", () => {
    const hostile = {
      ...config(),
      style: "valueOf" as NetStyle,
      sectors: Number.NaN,
      labels: [null, 7] as unknown as string[],
    };
    const net = netOf(buildSheet(hostile, 1));
    // An unknown style is a die, which is the family's own fallback.
    expect(net.shape).toBe("cube");
    expect(describeSheet(hostile)).not.toBe("");
  });
});
