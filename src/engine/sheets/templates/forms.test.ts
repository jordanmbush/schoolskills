import { describe, expect, it } from "vitest";

import { printedBlockBox } from "../chrome";
import { answerLine } from "../layout";
import { MARGINS, inches, rulePitch, toInches } from "../paper";
import type {
  FormConfig,
  FormField,
  FormStyle,
  MarginSize,
  PaperSize,
  Sheet,
} from "../types";
import { buildSheet, describeSheet, sheetSpec } from "../index";

import { WRITING_PROMPTS, promptAt } from "./prompts";
import { MAX_FORM_ROWS, formKeyed } from "./forms";

/**
 * The forms, and the one thing a blank form can get wrong.
 *
 * There are no answers on any of these sheets, so most of what a maths suite
 * checks does not apply. What is left is geometry, and it is the geometry that
 * hides: a form whose boxes come to an inch more than the page is invisible on
 * screen — `.sheet` is `min-height`, so nothing overflows — and prints its last
 * question on a second sheet of paper.
 *
 * So every claim below is made against `printedBlockBox`, which asks the header
 * and footer that were actually printed rather than the ones the family
 * reserved for. Checking against the reservation cannot fail: capacity is
 * floored against the same number.
 *
 * The air between the rows is `FIELD_GAP` in forms.ts, trailing `.sheet__form`
 * in sheet.css. It is written out here rather than imported, deliberately: a
 * suite that took the family's own constant would agree with the family about
 * how much room the browser leaves, which is the assumption being tested.
 */

const FIELD_GAP = inches(0.14);

const STYLES: FormStyle[] = [
  "reading-log",
  "book-report",
  "story-map",
  "paragraph-frame",
  "writing-prompt",
  "lab-report",
  "scientific-method",
  "observation-journal",
  "timeline",
];

/** The styles that are a set of headings rather than a list of rows. */
const FORMS = STYLES.filter(
  (style) => !["reading-log", "timeline", "writing-prompt"].includes(style),
);

const config = (over: Partial<FormConfig> = {}): FormConfig => ({
  kind: "form",
  style: "book-report",
  paper: { size: "letter", orientation: "portrait", margin: "normal" },
  fontPt: 12,
  fields: ["name", "date"],
  ...over,
});

/** The one form block on a sheet, or a failure that says so. */
function fieldsOf(sheet: Sheet): FormField[] {
  const forms = sheet.blocks.filter((block) => block.kind === "form");
  expect(forms).toHaveLength(1);
  return forms[0].fields;
}

/** The one table on a sheet. */
function tableOf(sheet: Sheet) {
  const tables = sheet.blocks.filter((block) => block.kind === "table");
  expect(tables).toHaveLength(1);
  return tables[0];
}

/**
 * How tall a form stands: its rows of boxes, their headings, and the gaps.
 *
 * Recovered from the finished fields rather than from the arithmetic that made
 * them — a row is a run of fields whose spans add up to the form's columns, so
 * this counts the page the way a browser lays it out.
 */
function formHeight(fields: FormField[], columns: number, fontPt: number) {
  const label = Math.round((fontPt * 0.85 * 1.4 * 1000) / 72);
  let rows = 0;
  let used = columns;
  let height = 0;
  for (const field of fields) {
    if (used + field.span > columns) {
      rows += 1;
      used = 0;
      height += field.space + label;
    }
    used += field.span;
  }
  return height + Math.max(0, rows - 1) * FIELD_GAP;
}

/* ── It fits ───────────────────────────────────────────────────────────── */

describe("a form", () => {
  it("closes the page at every size, on every stock", () => {
    // The failure this exists for cannot be seen in a preview, only in a tray.
    for (const style of FORMS) {
      for (const size of Object.keys({
        letter: 0,
        a4: 0,
        legal: 0,
      }) as PaperSize[]) {
        for (const margin of Object.keys(MARGINS) as MarginSize[]) {
          for (const fontPt of [8, 12, 18, 36]) {
            for (const space of [1, 2, 3]) {
              const built = config({
                style,
                fontPt,
                space,
                paper: { size, orientation: "portrait", margin },
              });
              const sheet = buildSheet(built, 1);
              const fields = fieldsOf(sheet);
              const columns = sheet.blocks.find(
                (block) => block.kind === "form",
              )?.columns;
              expect(
                formHeight(fields, columns ?? 1, fontPt),
                `${style} at ${fontPt}pt on ${size}/${margin}, room ${space}`,
              ).toBeLessThanOrEqual(printedBlockBox(sheet).height);
            }
          }
        }
      }
    }
  });

  it("gives every line at least the height a child writes on", () => {
    // A box of four lines is a box divided into four, so this is the claim the
    // whole "shares rather than line counts" design exists to make true. A line
    // shorter than the type in it is writing that overflows downwards.
    for (const style of FORMS) {
      for (const fontPt of [8, 12, 18, 36]) {
        for (const field of fieldsOf(
          buildSheet(config({ style, fontPt }), 1),
        )) {
          if (field.lines === 0) continue;
          expect(
            field.space / field.lines,
            `${style} at ${fontPt}pt: "${field.label}"`,
          ).toBeGreaterThanOrEqual(answerLine(fontPt));
        }
      }
    }
  });

  it("makes the lines taller and fewer when asked for more room", () => {
    const tight = fieldsOf(buildSheet(config({ space: 1 }), 1));
    const roomy = fieldsOf(buildSheet(config({ space: 3 }), 1));
    const lines = (fields: FormField[]) =>
      fields.reduce((total, field) => total + field.lines, 0);
    expect(lines(roomy)).toBeLessThan(lines(tight));
    // And the same questions, in the same order: room to write is not a
    // different form.
    expect(roomy.map((field) => field.label)).toEqual(
      tight.map((field) => field.label),
    );
  });

  it("leaves a drawing box unruled, and gives it real height", () => {
    const fields = fieldsOf(
      buildSheet(config({ style: "observation-journal" }), 1),
    );
    const drawing = fields.find((field) => field.lines === 0);
    expect(drawing?.label).toBe("What I saw");
    expect(drawing?.space).toBeGreaterThan(inches(2));
    // And it is the widest thing on the page — a naturalist's page is half
    // drawing, so a box the width of one column would be the wrong sheet.
    expect(drawing?.span).toBe(3);
  });

  it("keeps every field inside the width of the page", () => {
    for (const style of FORMS) {
      const sheet = buildSheet(config({ style }), 1);
      const box = printedBlockBox(sheet);
      for (const field of fieldsOf(sheet)) {
        expect(field.width, `${style}: "${field.label}"`).toBeLessThanOrEqual(
          box.width,
        );
        expect(field.width).toBeGreaterThan(0);
      }
    }
  });
});

/* ── The two lists ─────────────────────────────────────────────────────── */

describe("a reading log", () => {
  it("rules five columns that add up to the page exactly", () => {
    // A table drawn from widths that do not sum to the box has a right edge
    // that is not the margin, which is a line a reader sees against the paper.
    const sheet = buildSheet(config({ style: "reading-log" }), 1);
    const table = tableOf(sheet);
    expect(table.columns.map((column) => column.label)).toEqual([
      "Date",
      "What I read",
      "Pages",
      "Minutes",
      "Signed",
    ]);
    expect(
      table.columns.reduce((total, column) => total + column.width, 0),
    ).toBe(printedBlockBox(sheet).width);
  });

  it("prints the rows asked for, and no more than fit", () => {
    expect(
      tableOf(buildSheet(config({ style: "reading-log", rows: 14 }), 1)).rows,
    ).toBe(14);
    // A request, not a promise: at the largest type a config may ask for, forty
    // rows is more than a page of Letter holds.
    const crowded = tableOf(
      buildSheet(
        config({ style: "reading-log", rows: MAX_FORM_ROWS, fontPt: 36 }),
        1,
      ),
    );
    expect(crowded.rows).toBeLessThan(MAX_FORM_ROWS);
  });

  it("leaves every cell blank, because that is what the sheet is", () => {
    const table = tableOf(buildSheet(config({ style: "reading-log" }), 1));
    expect(table.cells).toHaveLength(table.columns.length * table.rows);
    expect(table.cells.every((cell) => !cell.text && !cell.corner)).toBe(true);
  });

  it("fits the page it was fitted to", () => {
    for (const style of ["reading-log", "timeline"] as FormStyle[]) {
      for (const fontPt of [8, 12, 18, 36]) {
        for (const rows of [1, 10, MAX_FORM_ROWS]) {
          const sheet = buildSheet(config({ style, rows, fontPt }), 1);
          const table = tableOf(sheet);
          expect(
            table.headRow + table.rows * table.row,
            `${style}, ${rows} rows at ${fontPt}pt`,
          ).toBeLessThanOrEqual(printedBlockBox(sheet).height);
        }
      }
    }
  });
});

describe("a timeline", () => {
  it("draws its spine where the two columns meet", () => {
    // The one thing that makes it a timeline rather than a two-column table: a
    // line events are written *against*, not a box they sit beside.
    const table = tableOf(buildSheet(config({ style: "timeline" }), 1));
    expect(table.columns).toHaveLength(2);
    expect(table.spine).toBe(1);
  });

  it("never puts the spine outside the table", () => {
    const table = tableOf(buildSheet(config({ style: "timeline" }), 1));
    expect(table.spine).toBeGreaterThan(0);
    expect(table.spine).toBeLessThanOrEqual(table.columns.length);
  });
});

/* ── The prompt ────────────────────────────────────────────────────────── */

describe("a writing prompt", () => {
  it("is decided by the seed, and a new seed is a new prompt", () => {
    // The one generated thing on this shelf, and the reason it has a seed at
    // all: "another one like this" is `seed + 1` here as everywhere else (§7).
    const built = config({ style: "writing-prompt" });
    expect(buildSheet(built, 3).header.instructions).toBe(promptAt(3));
    expect(buildSheet(built, 4).header.instructions).toBe(promptAt(4));
    expect(promptAt(3)).not.toBe(promptAt(4));
  });

  it("can reach every prompt in the bank", () => {
    // A modulo that lost an entry would lose it silently and for ever.
    const drawn = new Set(
      Array.from({ length: WRITING_PROMPTS.length }, (_, seed) =>
        promptAt(seed),
      ),
    );
    expect(drawn.size).toBe(WRITING_PROMPTS.length);
  });

  it("prints the parent's own prompt where they wrote one", () => {
    const sheet = buildSheet(
      config({ style: "writing-prompt", prompt: "  Write about a door.  " }),
      1,
    );
    expect(sheet.header.instructions).toBe("Write about a door.");
  });

  it("rules a page to write on, and stops at the bottom margin", () => {
    for (const fontPt of [8, 12, 36]) {
      const sheet = buildSheet(config({ style: "writing-prompt", fontPt }), 1);
      const rules = sheet.blocks.filter((block) => block.kind === "rules");
      expect(rules).toHaveLength(1);
      expect(rules[0].lines * rulePitch(rules[0].rule)).toBeLessThanOrEqual(
        printedBlockBox(sheet).height,
      );
    }
  });

  it("names itself without quoting a prompt nobody printed", () => {
    // `describe` is handed a config and no seed. Quoting the seed-zero prompt
    // would name a sheet that does not exist.
    expect(describeSheet(config({ style: "writing-prompt" }))).not.toContain(
      WRITING_PROMPTS[0],
    );
    expect(
      describeSheet(config({ style: "writing-prompt", prompt: "A door." })),
    ).toContain("A door.");
  });
});

/* ── The promises every family makes ───────────────────────────────────── */

describe("the forms family", () => {
  it("is deterministic in (config, seed)", () => {
    for (const style of STYLES) {
      const built = config({ style });
      expect(JSON.stringify(buildSheet(built, 9))).toBe(
        JSON.stringify(buildSheet(built, 9)),
      );
    }
  });

  it("withholds nothing, and says so where a page can ask", () => {
    // The whole of §11's third tier: these are supposed to be empty, so a key
    // is the same paper with a word in the footer. A page asks the family
    // rather than assuming, which is why `formKeyed` exists at all.
    expect(formKeyed()).toBe(false);
    const built = config();
    const sheet = buildSheet(built, 1);
    const key = sheetSpec("form").key(sheet);
    expect(key.blocks).toEqual(sheet.blocks);
    expect(key.footer.note).toBe("Answer key");
  });

  it("prints a page from a config that arrived from outside this build", () => {
    // A bookmarked link, a sheet saved last term, a hand-edited fragment.
    const hostile = {
      ...config(),
      style: "constructor" as FormStyle,
      rows: Number.NaN,
      space: "lots" as unknown as number,
    };
    const sheet = buildSheet(hostile, 1);
    expect(sheet.blocks.length).toBeGreaterThan(0);
    expect(toInches(printedBlockBox(sheet).height)).toBeGreaterThan(0);
  });
});
