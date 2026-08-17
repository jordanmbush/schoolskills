import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildSheet, describeSheet } from "@/engine/sheets";
import { toInches } from "@/engine/sheets/paper";
import { SCRIPTURE_CREDIT } from "@/engine/sheets/passages";
import { decodeSharedSheet } from "@/engine/sheets/share";
import { DICE_PAIR } from "@/engine/sheets/templates/nets";
import type { Sheet } from "@/engine/sheets/types";

import {
  TEMPLATE_GROUPS,
  TEMPLATE_SEED,
  TEMPLATE_SHEETS,
  builderHref,
  keyed,
  pathFor,
  templateShelf,
  type TemplateSheet,
} from "./_templates";

/**
 * The paperwork catalog, held to the sheet it prints under itself.
 *
 * A catalog page here *is* the sheet (§8), which turns every number in the
 * prose into a claim about the paper rather than a description of it: a reader
 * who is told there are fourteen rows can look down the page and count them.
 * So the counts and the dimensions written in words above are checked against
 * the blocks the page renders below, the way `_charts.test.ts` holds the
 * reference shelf to its own arithmetic.
 *
 * The dimensions are checked *generically* rather than slug by slug: any
 * "3.75 by 2.25 inches" written anywhere in an entry's prose has to be the card
 * that entry's sheet actually draws. That is what stops a page keeping its old
 * measurements after somebody changes a layout — which is the way this goes
 * stale, and it goes stale silently.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const built = (sheet: TemplateSheet): Sheet =>
  buildSheet(sheet.config, TEMPLATE_SEED);

const bySlug = (slug: string): TemplateSheet => {
  const found = TEMPLATE_SHEETS.find((sheet) => sheet.slug === slug);
  if (!found) throw new Error(`no sheet at ${slug}`);
  return found;
};

/** Everything a page says about its own sheet, as one run of text. */
const prose = (sheet: TemplateSheet): string =>
  [sheet.summary, sheet.lead, ...sheet.notes].join(" ");

const tableOf = (sheet: Sheet) =>
  sheet.blocks.find((block) => block.kind === "table");
const formOf = (sheet: Sheet) =>
  sheet.blocks.find((block) => block.kind === "form");
const cardsOf = (sheet: Sheet) =>
  sheet.blocks.find((block) => block.kind === "cutcards");
const netOf = (sheet: Sheet) =>
  sheet.blocks.find((block) => block.kind === "net")?.net;

/* ── The shelf ─────────────────────────────────────────────────────────── */

describe("the templates catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of TEMPLATE_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(TEMPLATE_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      TEMPLATE_SHEETS.length,
    );
  });

  it("answers a different query on every page", () => {
    const keywords = TEMPLATE_SHEETS.map((sheet) =>
      sheet.keyword.toLowerCase(),
    );
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it("files every sheet under a group the hub lists", () => {
    const shelved = templateShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(TEMPLATE_SHEETS.length);
    // And no empty shelf: a group with nothing on it is a heading over a gap.
    for (const group of templateShelf()) {
      expect(group.sheets.length, group.id).toBeGreaterThan(0);
    }
    expect(TEMPLATE_GROUPS).toHaveLength(templateShelf().length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of TEMPLATE_SHEETS) {
      expect(sheet.notes.length, sheet.slug).toBeGreaterThanOrEqual(2);
      for (const note of sheet.notes)
        expect(note.length, sheet.slug).toBeGreaterThan(200);
      expect(sheet.lead.length, sheet.slug).toBeGreaterThan(100);
      expect(sheet.summary.length, sheet.slug).toBeGreaterThan(60);
    }
  });

  it("prints something on every page", () => {
    for (const sheet of TEMPLATE_SHEETS) {
      const page = built(sheet);
      expect(page.blocks.length, sheet.slug).toBeGreaterThan(0);
      expect(describeSheet(sheet.config), sheet.slug).not.toBe("");
    }
  });

  it("shows every family and every style the shelf can make", () => {
    // A style with no page is a sheet a parent can only find by opening the
    // builder and reading a dropdown.
    const kinds = new Set(TEMPLATE_SHEETS.map((sheet) => sheet.config.kind));
    expect(kinds).toEqual(new Set(["form", "planner", "cards", "net"]));

    const styles = new Set(
      TEMPLATE_SHEETS.map((sheet) =>
        "style" in sheet.config ? String(sheet.config.style) : "",
      ),
    );
    for (const style of [
      "reading-log",
      "book-report",
      "story-map",
      "paragraph-frame",
      "writing-prompt",
      "lab-report",
      "scientific-method",
      "observation-journal",
      "timeline",
      "calendar",
      "week",
      "chores",
      "behaviour",
      "verse-week",
      "flashcard",
      "name-tag",
      "bookmark",
      "verse-card",
      "certificate",
      "dice",
      "spinner",
    ]) {
      expect(styles.has(style), style).toBe(true);
    }
  });

  it("offers no answer key anywhere, because there is nothing to withhold", () => {
    // The tier's own argument (§11), asked of the engine rather than assumed:
    // a second copy of a blank form under the words "Answer key" would be noise
    // on a parent's printer.
    for (const sheet of TEMPLATE_SHEETS) {
      expect(keyed(sheet), sheet.slug).toBe(false);
    }
  });

  it("opens the bench on the sheet the page printed", () => {
    for (const sheet of TEMPLATE_SHEETS) {
      const shared = decodeSharedSheet(builderHref(sheet).split("#s=")[1]);
      expect(shared, sheet.slug).not.toBeNull();
      expect(shared?.seed).toBe(TEMPLATE_SEED);
      expect(JSON.stringify(buildSheet(shared!.config, shared!.seed))).toBe(
        JSON.stringify(built(sheet)),
      );
    }
  });

  it("is listed on the Print Shop's front door", () => {
    // A shelf nobody links to is a shelf a crawler reaches only through the
    // sitemap, which is the thin-content pattern `Base.astro` argues against.
    const hub = readFileSync(
      `${ROOT}/src/pages/printables/index.astro`,
      "utf8",
    );
    expect(hub).toContain("/printables/templates");
    expect(hub).toContain("_templates");
  });
});

/* ── The numbers the prose says out loud ───────────────────────────────── */

describe("what a page claims about its own sheet", () => {
  it("quotes the card size the sheet actually draws", () => {
    // Generic rather than per-slug, so a layout that changes cannot leave a
    // stale measurement behind on a page nobody reopened.
    let checked = 0;
    for (const sheet of TEMPLATE_SHEETS) {
      const block = cardsOf(built(sheet));
      for (const [, wide, tall] of prose(sheet).matchAll(
        /([\d.]+) by ([\d.]+) inches/g,
      )) {
        expect(
          block,
          `${sheet.slug} quotes a card size and draws no cards`,
        ).toBeDefined();
        expect(toInches(block!.card.width), sheet.slug).toBe(Number(wide));
        expect(toInches(block!.card.height), sheet.slug).toBe(Number(tall));
        checked += 1;
      }
    }
    // Guards the guard: a reworded page that stopped quoting dimensions would
    // otherwise turn this into a loop over nothing.
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it("prints a fortnight of reading in five columns", () => {
    const table = tableOf(built(bySlug("reading-log")))!;
    expect(table.rows).toBe(14);
    expect(table.columns.map((column) => column.label)).toEqual([
      "Date",
      "What I read",
      "Pages",
      "Minutes",
      "Signed",
    ]);
  });

  it("draws a timeline as two columns with a line down the middle", () => {
    const table = tableOf(built(bySlug("timeline")))!;
    expect(table.rows).toBe(10);
    expect(table.columns).toHaveLength(2);
    expect(table.spine).toBe(1);
  });

  it("gives each written form the boxes its page counts", () => {
    const counted: Record<string, number> = {
      "book-report": 6,
      "story-map": 6,
      "paragraph-frame": 5,
      "scientific-method": 6,
    };
    for (const [slug, boxes] of Object.entries(counted)) {
      expect(formOf(built(bySlug(slug)))?.fields.length, slug).toBe(boxes);
    }
    // The journal is the one with somewhere to draw rather than write.
    const journal = formOf(built(bySlug("observation-journal")))!;
    expect(journal.columns).toBe(3);
    expect(journal.fields.filter((field) => field.lines === 0)).toHaveLength(1);
  });

  it("rules the week the way each chart says it does", () => {
    const shapes: Record<string, { rows: number; columns: number }> = {
      "blank-calendar": { rows: 5, columns: 7 },
      "weekly-planner": { rows: 7, columns: 4 },
      "chore-chart": { rows: 10, columns: 8 },
      "behaviour-chart": { rows: 8, columns: 9 },
    };
    for (const [slug, shape] of Object.entries(shapes)) {
      const table = tableOf(built(bySlug(slug)))!;
      expect(table.rows, slug).toBe(shape.rows);
      expect(table.columns.length, slug).toBe(shape.columns);
    }
    // And the blank calendar is blank: no dates, so it never goes out of date.
    expect(
      tableOf(built(bySlug("blank-calendar")))!.cells.every(
        (cell) => cell.corner === undefined,
      ),
    ).toBe(true);
  });

  it("counts the cards it says are on the page", () => {
    const counted: Record<string, number> = {
      "blank-flashcards": 8,
      "name-tags": 4,
      bookmarks: 4,
      "memory-verse-cards": 6,
      "scripture-bookmarks": 3,
      "award-certificates": 1,
    };
    for (const [slug, cards] of Object.entries(counted)) {
      const block = cardsOf(built(bySlug(slug)))!;
      expect(block.columns * block.rows, slug).toBe(cards);
      expect(block.faces, slug).toHaveLength(cards);
    }
  });

  it("folds the name tags and nothing else", () => {
    expect(cardsOf(built(bySlug("name-tags")))?.fold).toBe(true);
    expect(cardsOf(built(bySlug("blank-flashcards")))?.fold).toBeUndefined();
  });

  it("prints the certificate landscape, so nobody has to find the control", () => {
    const sheet = built(bySlug("award-certificates"));
    expect(sheet.paper.orientation).toBe("landscape");
    const block = cardsOf(sheet)!;
    expect(block.frame).toBe("award");
    expect(block.faces[0].fields).toHaveLength(4);
  });

  it("folds a die whose opposite faces add to seven", () => {
    // The engine's suite folds the net to prove it; this only checks that the
    // page above the net is talking about the sheet under it.
    const net = netOf(built(bySlug("printable-dice")))!;
    if (net.shape !== "cube") throw new Error("not a cube");
    expect(net.faces.filter(Boolean)).toHaveLength(6);
    expect(net.tabs).toHaveLength(7);
    expect(toInches(net.edge)).toBe(2);
    // The page says it in words, so the word is what is checked — and the
    // constant is checked against the word, which is what ties the two.
    expect(DICE_PAIR).toBe(7);
    expect(prose(bySlug("printable-dice"))).toMatch(
      /opposite faces add to seven/i,
    );
  });

  it("cuts the spinner into the sectors its page names", () => {
    const net = netOf(built(bySlug("spinner-template")))!;
    if (net.shape !== "spinner") throw new Error("not a spinner");
    expect(net.sectors).toHaveLength(6);
    expect(360 / net.sectors.length).toBe(60);
  });
});

/* ── Scripture, in the same list as everything else (§12) ──────────────── */

describe("the three pages that carry a verse", () => {
  const VERSED = [
    "verse-of-the-week",
    "memory-verse-cards",
    "scripture-bookmarks",
  ];

  it("credits the translation on the paper", () => {
    // A condition of the name rather than a courtesy, and it travels on the
    // passage rather than beside it — so a page cannot forget it.
    for (const slug of VERSED) {
      expect(built(bySlug(slug)).footer.source, slug).toBe(SCRIPTURE_CREDIT);
    }
  });

  it("prints the verse it says it prints", () => {
    expect(cardsOf(built(bySlug("memory-verse-cards")))?.faces[0].heading).toBe(
      "John 3:16",
    );
    expect(
      cardsOf(built(bySlug("scripture-bookmarks")))?.faces[0].heading,
    ).toBe("Psalm 23");
    expect(built(bySlug("verse-of-the-week")).header.title).toBe(
      "Proverbs 3:5-6",
    );
  });

  it("sits in the same shelf as the chore chart, not in one of its own", () => {
    // §12's "woven through" as a fact about the data: a Scripture group would
    // be the section off to one side the design refuses.
    const groups = new Set(TEMPLATE_GROUPS.map((group) => group.id));
    for (const group of groups) {
      expect(group.toLowerCase()).not.toContain("bible");
      expect(group.toLowerCase()).not.toContain("scripture");
    }
    for (const slug of VERSED) {
      const sheet = bySlug(slug);
      const neighbours = templateShelf().find(
        (group) => group.id === sheet.group,
      )!.sheets;
      expect(neighbours.length, slug).toBeGreaterThan(1);
    }
  });

  it("keeps the verse off the surfaces §12 calls marketing", () => {
    // "Never in a title, a description or a jsonLd, on any page — that surface
    // *is* marketing." A verse there announces an audience; a verse in the body
    // says something. This shelf carries three Scripture sheets among nineteen
    // others, which is exactly the case where the line is easy to cross.
    const faith = /\b(scripture|bible|verse|christian|faith)\b/i;

    // The strings the two pages hand to `<Content>`, read out of the source
    // rather than guessed at.
    for (const page of ["index.astro", "[slug].astro"]) {
      const source = readFileSync(
        `${ROOT}/src/pages/printables/templates/${page}`,
        "utf8",
      );
      const front = source.slice(0, source.indexOf("<Content"));
      const declared = [
        ...front.matchAll(/const (?:title|description) =([\s\S]*?);\n/g),
      ];
      expect(declared.length, page).toBeGreaterThan(0);
      for (const [, quoted] of declared) {
        expect(quoted, `${page} title or description`).not.toMatch(faith);
      }
    }

    // And the two fields those are built out of on a per-sheet page: `keyword`
    // becomes the `<title>` and `summary` becomes the description, so a verse
    // page naming its audience there would reach the same surface by a
    // different road. Naming the *book* is content — "Psalm 23 bookmarks" is
    // what somebody typed — so what is refused is the label, not the reference.
    for (const slug of VERSED) {
      const sheet = bySlug(slug);
      expect(sheet.keyword, slug).not.toMatch(
        /\b(christian|faith[- ]based|homeschool christian)\b/i,
      );
      expect(sheet.summary, slug).not.toMatch(
        /\b(christian|faith[- ]based)\b/i,
      );
    }
  });
});

/* ── Print isolation, on the pages this shelf added ────────────────────── */

describe("the pages themselves", () => {
  it("prerenders one page per entry", () => {
    if (!existsSync(`${ROOT}/dist/printables/templates`)) return; // No build yet.
    // Built from `pathFor` rather than from the slug, so what the shelf links
    // to and what the build emitted are one claim rather than two.
    for (const sheet of TEMPLATE_SHEETS) {
      expect(
        existsSync(`${ROOT}/dist${pathFor(sheet)}/index.html`),
        sheet.slug,
      ).toBe(true);
    }
  });

  it("puts the sheet on the page rather than a link to one", () => {
    const dist = `${ROOT}/dist/printables/templates/blank-flashcards/index.html`;
    if (!existsSync(dist)) return;
    const html = readFileSync(dist, "utf8");
    expect(html).toContain('class="sheet"');
    // The cut guides are the one thing on this shelf a reader cannot do
    // without, and they are drawn rather than described.
    expect(html).toContain("sheet__cut-guides");
    expect(html).not.toContain("astro-island");
  });
});
