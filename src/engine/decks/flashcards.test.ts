import { describe, expect, it } from "vitest";

import {
  OPERATIONS,
  buildFlashDeck,
  buildFlashDrill,
  flashConfigKey,
  readConfig,
} from "./flashcards";
import type { FlashConfig } from "@/engine/types";

const config = (over: Partial<FlashConfig> = {}): FlashConfig => ({
  operation: "multiply",
  tables: [7],
  others: [1, 2, 3],
  cardCount: 6,
  inputMode: "type",
  ...over,
});

describe("buildDeck", () => {
  it("is a pure function of its config and seed", () => {
    // Ghost racing depends on this outright: a rival's run is replayed from a
    // seed, so the same seed producing a different deck would race two people
    // on different questions and call it a record.
    const a = buildFlashDeck(config(), 12345);
    const b = buildFlashDeck(config(), 12345);
    expect(a).toEqual(b);
    expect(buildFlashDeck(config(), 12346)).not.toEqual(a);
  });

  it("answers with text, not numbers", () => {
    for (const card of buildFlashDeck(config(), 7)) {
      expect(typeof card.answer).toBe("string");
    }
  });

  it("gets the arithmetic right in every operation", () => {
    const check: Record<string, (a: number, b: number) => number> = {
      multiply: (a, b) => a * b,
      add: (a, b) => a + b,
    };
    for (const operation of ["multiply", "add"] as const) {
      for (const card of buildFlashDeck(config({ operation }), 99)) {
        const [left, , right] = card.prompt.split(" ");
        expect(card.answer).toBe(
          String(check[operation](Number(left), Number(right))),
        );
      }
    }
  });

  it("never asks division to divide by zero", () => {
    const deck = buildFlashDeck(
      config({ operation: "divide", others: [0, 1, 2, 3] }),
      5,
    );
    for (const card of deck) {
      expect(card.prompt).not.toMatch(/÷ 0$/);
    }
  });

  it("keeps subtraction above zero", () => {
    for (const card of buildFlashDeck(config({ operation: "subtract" }), 5)) {
      expect(Number(card.answer)).toBeGreaterThanOrEqual(0);
    }
  });

  it("exhausts the pool before repeating a fact", () => {
    // Three facts over six cards should be two full passes, not the same card
    // four times while another never appears.
    const seen = buildFlashDeck(config({ cardCount: 6 }), 3).map(
      (c) => c.factId,
    );
    expect(new Set(seen).size).toBe(3);
  });

  it("offers four distinct choices including the answer", () => {
    for (const card of buildFlashDeck(config({ inputMode: "choose" }), 8)) {
      expect(card.choices).toHaveLength(4);
      expect(new Set(card.choices).size).toBe(4);
      expect(card.choices).toContain(card.answer);
      for (const choice of card.choices!) expect(typeof choice).toBe("string");
    }
  });

  it("builds no choices when the answer is typed", () => {
    for (const card of buildFlashDeck(config(), 8)) {
      expect(card.choices).toBeUndefined();
    }
  });
});

describe("the marking rule", () => {
  it("forgives a leading zero and stray whitespace", () => {
    // The keypad lets a five-year-old lead with a zero and the number row
    // lets anyone hit space. Neither is a wrong answer to 7 × 8.
    const { normalise } = OPERATIONS.multiply;
    expect(normalise("056")).toBe(normalise("56"));
    expect(normalise(" 56 ")).toBe(normalise("56"));
  });

  it("does not forgive a different number", () => {
    const { normalise } = OPERATIONS.multiply;
    expect(normalise("57")).not.toBe(normalise("56"));
  });

  it("leaves a non-numeric entry alone rather than turning it into NaN", () => {
    expect(OPERATIONS.multiply.normalise("abc")).toBe("abc");
    expect(OPERATIONS.multiply.normalise("")).toBe("");
  });
});

describe("factLabel", () => {
  it("names a multiplication fact as the question it asks", () => {
    expect(OPERATIONS.multiply.factLabel("7:8")).toBe("7 × 8");
  });

  it("names a division fact as the question it asks, not as its two numbers", () => {
    // The pair behind "21 ÷ 3 = 7" is [3, 7]. Rendering that literally gives
    // "3 ÷ 7", which is a different — and wrong — sum. The trouble list and
    // the drill chips both used to show it that way.
    expect(OPERATIONS.divide.factLabel("3:7")).toBe("21 ÷ 3");
  });

  it("does the same for subtraction", () => {
    expect(OPERATIONS.subtract.factLabel("3:7")).toBe("10 − 3");
  });
});

describe("configKey", () => {
  // Pinned exactly. The key is how a run finds the ghosts it may race, so a
  // change to its format doesn't break a test — it silently orphans every run
  // already saved, and nobody's personal best lines up again.
  it("is stable for a plain config", () => {
    expect(flashConfigKey(config())).toBe("multiply|7|1.2.3|6|type");
  });

  it("appends the clock only when there is one", () => {
    expect(flashConfigKey(config({ timeLimitMs: 8000 }))).toBe(
      "multiply|7|1.2.3|6|type|t8000",
    );
    expect(flashConfigKey(config({ timeLimitMs: null }))).toBe(
      "multiply|7|1.2.3|6|type",
    );
  });

  it("sorts numerically, so 10 doesn't file itself before 2", () => {
    expect(flashConfigKey(config({ tables: [10, 2, 1] }))).toContain(
      "|1.2.10|",
    );
  });

  it("reads a pre-`others` config through its old min/max range", () => {
    expect(
      readConfig({
        operation: "multiply",
        tables: [7],
        otherMin: 1,
        otherMax: 3,
        cardCount: 6,
        inputMode: "type",
      }).others,
    ).toEqual([1, 2, 3]);
  });
});

describe("buildDrill", () => {
  it("takes fact ids and files them as the persisted pair shape", () => {
    const drill = buildFlashDrill(["7:8", "6:9"], {
      operation: "multiply",
      inputMode: "type",
    });
    expect(drill.facts).toEqual([
      [7, 8],
      [6, 9],
    ]);
  });

  it("de-duplicates", () => {
    expect(
      buildFlashDrill(["7:8", "7:8"], {
        operation: "multiply",
        inputMode: "type",
      }).facts,
    ).toHaveLength(1);
  });

  it("fills the axes in from the facts so the run still describes itself", () => {
    const drill = buildFlashDrill(["7:8", "6:9"], {
      operation: "multiply",
      inputMode: "type",
    });
    expect(drill.tables).toEqual([6, 7]);
    expect(drill.others).toEqual([8, 9]);
  });

  it("asks each fact twice, within bounds", () => {
    expect(
      buildFlashDrill(["7:8"], { operation: "multiply", inputMode: "type" })
        .cardCount,
    ).toBe(6);
    const many = Array.from({ length: 40 }, (_, i) => `1:${i}`);
    expect(
      buildFlashDrill(many, { operation: "multiply", inputMode: "type" })
        .cardCount,
    ).toBe(30);
  });

  it("builds a deck of only those facts", () => {
    const drill = buildFlashDrill(["7:8", "6:9"], {
      operation: "multiply",
      inputMode: "type",
    });
    const ids = new Set(buildFlashDeck(drill, 4).map((c) => c.factId));
    expect([...ids].sort()).toEqual(["6:9", "7:8"]);
  });
});
