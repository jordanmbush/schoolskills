import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import { decodeSharedSheet } from "@/engine/sheets/share";

import {
  CUSTOM_PAGES,
  CUSTOM_ROOT,
  CUSTOM_SEED,
  builderHref,
  hrefFor,
} from "./_custom";

/**
 * The builder's front door, held to what a catalog page has to be — and to
 * the one thing these pages exist for, which is that every door on them
 * opens the bench on the sheet it names. A link whose payload the bench
 * refuses lands a parent on step one with nothing chosen, and nothing on the
 * page would say so.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const read = (path: string) => readFileSync(`${ROOT}/${path}`, "utf8");

describe("the custom pages", () => {
  it("are one front door and the pages behind it, at distinct routes", () => {
    expect(CUSTOM_PAGES[0].slug).toBeUndefined();
    expect(hrefFor(CUSTOM_PAGES[0])).toBe(CUSTOM_ROOT);
    const hrefs = CUSTOM_PAGES.map(hrefFor);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs.slice(1)) {
      expect(href.startsWith(`${CUSTOM_ROOT}/`)).toBe(true);
    }
  });

  it("print a finished sheet on every page, with its key where it has one", () => {
    for (const page of CUSTOM_PAGES) {
      const sheet = buildSheet(page.example.config, CUSTOM_SEED);
      expect(sheet.blocks.length, page.name).toBeGreaterThan(0);
      if (page.example.keyed) {
        expect(
          answerKey(page.example.config, CUSTOM_SEED).blocks.length,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("open the builder on every door, and the link carries the sheet it names", () => {
    for (const page of CUSTOM_PAGES) {
      const doors = [
        { label: "the example", config: page.example.config },
        ...page.groups.flatMap((group) => group.doors),
      ];
      for (const door of doors) {
        const href = builderHref(door.config);
        expect(href.startsWith("/printables/make#s=")).toBe(true);
        const opened = decodeSharedSheet(
          href.slice("/printables/make#s=".length),
        );
        expect(opened, `${page.name}: ${door.label}`).not.toBeNull();
        expect(opened?.config).toEqual(door.config);
        expect(opened?.seed).toBe(CUSTOM_SEED);
      }
    }
  });

  it("keep the title and the description to what a result shows", () => {
    for (const page of CUSTOM_PAGES) {
      expect(page.title.length, page.title).toBeLessThanOrEqual(70);
      expect(page.description.length, page.description).toBeLessThanOrEqual(
        165,
      );
      expect(page.notes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("are linked from the hub and the home page, and speak to a classroom", () => {
    // A page nothing links to is a page nothing ranks, and these exist to
    // rank: the search-index guard only checks that the route was built.
    expect(read("src/pages/printables/index.astro")).toContain(CUSTOM_ROOT);
    expect(read("src/pages/index.astro")).toContain(CUSTOM_ROOT);
    expect(read("src/pages/printables/custom/[...slug].astro")).toContain(
      "In the classroom",
    );
  });
});
