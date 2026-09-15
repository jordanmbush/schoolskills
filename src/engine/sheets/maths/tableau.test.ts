import { describe, expect, it } from "vitest";

import { mulberry32 } from "@/engine/random";

import { divisionLines } from "./long";
import { divisionTableau, type Tableau } from "./tableau";

/**
 * The working, checked without doing the working.
 *
 * Nothing below walks the algorithm the module walks. A take-away row is
 * checked by multiplying the divisor by the quotient digit written over it; a
 * bring-down row by taking the dividend's digits so far modulo the divisor and
 * appending the digit brought down; the whole by rebuilding the dividend from
 * quotient, divisor and remainder. If the module divided wrongly, the numbers
 * it wrote would fail one of those without the test having divided at all.
 */

/** A row's text as the number it is — "05" is five. */
const value = (text: string): number => Number(text);

/** What the tableau says the dividend is, put back together. */
function rebuilt(tableau: Tableau, divisor: number): number {
  return Number(tableau.quotient.text) * divisor + tableau.remainder;
}

describe("the tableau of a long division", () => {
  it("writes 657 ÷ 3 the way it is written on paper", () => {
    expect(divisionTableau("657", 3)).toEqual({
      quotient: { text: "219", start: 0 },
      rows: [
        { role: "take", text: "6", end: 0 },
        { role: "left", text: "05", end: 1 },
        { role: "take", text: "3", end: 1 },
        { role: "left", text: "27", end: 2 },
        { role: "take", text: "27", end: 2 },
        { role: "left", text: "0", end: 2 },
      ],
      remainder: 0,
    });
  });

  it("starts the quotient over the first column the divisor goes into", () => {
    // 1 is short of 7, so nothing is written over it; 10 is not.
    expect(divisionTableau("105", 7)).toEqual({
      quotient: { text: "15", start: 1 },
      rows: [
        { role: "take", text: "7", end: 1 },
        { role: "left", text: "35", end: 2 },
        { role: "take", text: "35", end: 2 },
        { role: "left", text: "0", end: 2 },
      ],
      remainder: 0,
    });
  });

  it("keeps a zero quotient digit's rows, because the algorithm writes them", () => {
    expect(divisionTableau("849", 12)).toEqual({
      quotient: { text: "70", start: 1 },
      rows: [
        { role: "take", text: "84", end: 1 },
        { role: "left", text: "09", end: 2 },
        { role: "take", text: "0", end: 2 },
        { role: "left", text: "9", end: 2 },
      ],
      remainder: 9,
    });
  });

  it("writes a single 0 when the dividend is smaller than the divisor", () => {
    expect(divisionTableau("5", 7)).toEqual({
      quotient: { text: "0", start: 0 },
      rows: [
        { role: "take", text: "0", end: 0 },
        { role: "left", text: "5", end: 0 },
      ],
      remainder: 5,
    });
  });

  it("writes nothing for something that is not a division", () => {
    const nothing = {
      quotient: { text: "", start: 0 },
      rows: [],
      remainder: 0,
    };
    expect(divisionTableau("", 3)).toEqual(nothing);
    expect(divisionTableau("12a", 3)).toEqual(nothing);
    expect(divisionTableau("120", 0)).toEqual(nothing);
    expect(divisionTableau("120", 2.5)).toEqual(nothing);
  });

  it("holds on two hundred divisions drawn at random", () => {
    const rand = mulberry32(21);
    for (let draw = 0; draw < 200; draw += 1) {
      const into = 1 + Math.floor(rand() * 5);
      const by = 1 + Math.floor(rand() * 3);
      const dividend = Math.floor(rand() * 10 ** into);
      const divisor = Math.max(1, Math.floor(rand() * 10 ** by));
      const digits = String(dividend);
      const where = `${digits} ÷ ${divisor}`;

      const tableau = divisionTableau(digits, divisor);
      const { quotient, rows, remainder } = tableau;

      // The whole, from its parts.
      expect(rebuilt(tableau, divisor), where).toBe(dividend);
      expect(remainder, where).toBeLessThan(divisor);
      expect(quotient.start + quotient.text.length, where).toBe(digits.length);
      // A quotient never starts with a 0 unless it is the 0 written over a
      // dividend the divisor does not go into at all.
      if (quotient.text.length > 1) expect(quotient.text[0]).not.toBe("0");

      // Two rows per quotient digit — a take-away and what is left — never
      // more than the space `long.ts` reserves before a division is drawn,
      // and the last of them is the remainder.
      expect(rows.length, where).toBe(2 * quotient.text.length);
      expect(rows.length, where).toBeLessThanOrEqual(
        divisionLines({ into: digits.length, by: String(divisor).length }),
      );
      expect(rows[rows.length - 1], where).toMatchObject({
        role: "left",
        text: String(remainder),
        end: digits.length - 1,
      });

      rows.forEach((row, index) => {
        // Alternating, take then left, and never wider than the columns to
        // the left of where it ends.
        expect(row.role, where).toBe(index % 2 === 0 ? "take" : "left");
        expect(row.text.length, where).toBeLessThanOrEqual(row.end + 1);
        expect(row.text, where).toMatch(/^\d+$/);

        if (row.role === "take") {
          const over = Number(quotient.text[row.end - quotient.start]);
          expect(value(row.text), where).toBe(divisor * over);
          return;
        }
        // What is left: the digits so far, less every whole divisor in them,
        // with the next digit brought down — or, on the last row, nothing.
        const last = index === rows.length - 1;
        const sofar = last ? digits : digits.slice(0, row.end);
        const left = Number(sofar) % divisor;
        expect(value(row.text), where).toBe(
          last ? left : left * 10 + Number(digits[row.end]),
        );
      });
    }
  });
});
