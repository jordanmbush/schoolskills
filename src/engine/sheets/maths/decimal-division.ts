/**
 * The three divisions a decimals sheet can set (§22). Every one is built from
 * the answer outward — the quotient drawn, the dividend made from it — so
 * nothing here divides and nothing can fail to stop. A draw returns the
 * sentence and the bracket both; whether the bracket prints is decimals.ts's
 * to decide from the layout it reserved.
 */
import { between } from "@/engine/random";

import type { DecimalConfig } from "../types";

import { whole } from "../paper";
import { bounds, drawValue, placesOf, type Drawn } from "./decimal-draw";
import { fixed, fixedText, gcd, scale, timesWhole, type Fixed } from "./exact";
import { divisionTableau, type Tableau } from "./tableau";

/** What a decimal is divided by unless the config says: the single digits. */
const DIVISOR = { min: 2, max: 9 };

/**
 * As far as a divisor may run. Two digits is the harder sheet a parent asks
 * for by name; three is a calculator's, and the squares it would take under
 * the bracket would not fit the column.
 */
const MAX_DIVISOR = 99;

/** The divisor span, made safe to draw from whatever a saved config says. */
export function divisorOf(config: DecimalConfig): { min: number; max: number } {
  const asked: Partial<Record<"min" | "max", unknown>> =
    config.divisor ?? DIVISOR;
  const min = whole(asked.min, DIVISOR.min, DIVISOR.min, MAX_DIVISOR);
  const max = whole(asked.max, min, min, MAX_DIVISOR);
  return { min, max };
}

/**
 * The divisors in the span a whole dividend divides by to an answer that
 * stops at the sheet's places: 2, 4, 5, 6 and 8 among the single digits,
 * never 3, 7 or 9 (§22). Empty when the span holds none.
 */
export function stoppingDivisors(config: DecimalConfig): number[] {
  const by = scale(placesOf(config));
  const { min, max } = divisorOf(config);
  const out: number[] = [];
  for (let divisor = min; divisor <= max; divisor += 1) {
    if (gcd(by, divisor) > 1) out.push(divisor);
  }
  return out;
}

/**
 * Decided once, here, so the draw, the layout and the title agree. Dividing
 * *by* a decimal wins over a whole dividend (§22).
 */
export type Division = "byWhole" | "byDecimal" | "wholeDividend";

export function divisionOf(config: DecimalConfig): Division {
  if (config.by === "decimal") return "byDecimal";
  return config.wholeDividend === true ? "wholeDividend" : "byWhole";
}

/**
 * A decimal divided by a whole number: 8.46 ÷ 3. A quotient ending in a zero
 * is thrown away — `20.5 ÷ 5` written to two places is an exercise nobody
 * sets — though the dividend may end in one (§22).
 */
export function drawByWhole(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const quotient = drawValue(config, rand);
  if (quotient === null || quotient.units % 10 === 0) return null;
  const { min, max } = divisorOf(config);
  const divisor = between(min, max, rand);
  const dividend = fixedText(timesWhole(quotient, divisor));
  return divided(dividend, divisor, quotient);
}

/**
 * A whole number divided to a decimal answer: 7 ÷ 4 = 1.75.
 *
 * Walked in steps rather than drawn and rejected, as `drawPercent` is and for
 * its reason (§22). Unlike `drawByWhole`, a quotient ending in a zero stays:
 * `1.50` is the last annexed zero divided into and found empty.
 */
export function drawWholeDividend(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const places = placesOf(config);
  const by = scale(places);
  const usable = stoppingDivisors(config);
  if (usable.length === 0) return null;
  const divisor = usable[Math.floor(rand() * usable.length)];
  const step = by / gcd(by, divisor);
  const { min, max } = bounds(config.range);
  const first = Math.ceil(Math.max(min * by, 1) / step);
  const last = Math.floor((max * by) / step);
  if (first > last) return null;
  const units = between(first, last, rand) * step;
  // A whole quotient; this sheet promises an answer past the point.
  if (units % by === 0) return null;
  const quotient = fixed(units, places);
  const product = timesWhole(quotient, divisor);
  const whole = String(product.units / by);
  return divided(whole, divisor, quotient, fixedText(product));
}

/**
 * A decimal divided by a decimal: 8.4 ÷ 0.2, drawn as the whole-number
 * division it is rewritten into and then given its places (§22). No bracket
 * is returned — this one is only ever written along a line.
 */
export function drawByDecimal(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const places = placesOf(config);
  const { min, max } = bounds(config.range);
  if (max < 1) return null;
  const quotient = between(Math.max(1, min), max, rand);
  const span = divisorOf(config);
  const divisor = between(span.min, span.max, rand);
  const dividend = quotient * divisor;
  // Neither side may end in a zero: the place count is the lesson.
  if (dividend % 10 === 0 || divisor % 10 === 0) return null;
  const divisorPlaces = between(1, places, rand);
  const dividendPlaces = between(divisorPlaces, places, rand);
  // A number divided by itself answers itself.
  if (quotient === 1 && dividendPlaces === divisorPlaces) return null;
  const left = fixedText(fixed(dividend, dividendPlaces));
  const right = fixedText(fixed(divisor, divisorPlaces));
  return {
    key: `divide:${left}:${right}`,
    prompt: `${left} ÷ ${right} =`,
    answer: fixedText(fixed(quotient, dividendPlaces - divisorPlaces)),
  };
}

/**
 * A division as a sentence and as a bracket.
 *
 * `annexed` is what the bracket prints where that differs from what the
 * sentence says — `7.00` for a whole dividend, so there are zeros to divide
 * into. The key is the sentence's, so the same division is one problem in
 * either form.
 */
function divided(
  dividend: string,
  divisor: number,
  quotient: Fixed,
  annexed = dividend,
): Drawn {
  return {
    key: `divide:${dividend}:${divisor}`,
    prompt: `${dividend} ÷ ${divisor} =`,
    answer: fixedText(quotient),
    bracket: { divisor: String(divisor), dividend: annexed },
  };
}

/**
 * The working under a decimal dividend: `divisionTableau` over the digits
 * alone, then the quotient padded back to the units column so 0.69 ÷ 3 reads
 * 0.23, never .23 (§22).
 */
export function decimalTableau(dividend: string, divisor: number): Tableau {
  const point = dividend.indexOf(".");
  const digits = dividend.replace(".", "");
  const tableau = divisionTableau(digits, divisor);
  const units = point < 0 ? digits.length - 1 : Math.max(0, point - 1);
  const { text, start } = tableau.quotient;
  if (start <= units) return tableau;
  return {
    ...tableau,
    quotient: { text: "0".repeat(start - units) + text, start: units },
  };
}
