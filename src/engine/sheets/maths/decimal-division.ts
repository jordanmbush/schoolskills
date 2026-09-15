/**
 * The three divisions a decimals sheet can set (§22), each built from the
 * answer outward: the quotient is drawn and the dividend made from it, so no
 * quotient is ever found and nothing can fail to terminate.
 *
 * A draw returns the sentence and the bracket both; whether the bracket is
 * printed is `decimals.ts`'s to decide from the layout it reserved.
 */
import { between } from "@/engine/random";

import type { DecimalConfig } from "../types";

import { bounds, clamp, drawValue, placesOf, type Drawn } from "./decimal-draw";
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
  const asked = config.divisor ?? DIVISOR;
  const min = clamp(asked.min ?? DIVISOR.min, DIVISOR.min, MAX_DIVISOR);
  const max = clamp(Math.max(min, asked.max ?? min), DIVISOR.min, MAX_DIVISOR);
  return { min, max };
}

/**
 * The three divisions, decided once so the draw, the layout and the title
 * cannot disagree about which it is. Dividing *by* a decimal wins over a whole
 * dividend: they are two lessons rather than one question with two switches
 * on.
 */
export type Division = "byWhole" | "byDecimal" | "wholeDividend";

export function divisionOf(config: DecimalConfig): Division {
  if (config.by === "decimal") return "byDecimal";
  return config.wholeDividend === true ? "wholeDividend" : "byWhole";
}

/**
 * A decimal divided by a whole number: 8.46 ÷ 3.
 *
 * The quotient is drawn and the dividend made from it, so the division comes
 * out exactly and every promise the config makes holds of the answer — which
 * is the number a parent set the places and the range for.
 */
export function drawByWhole(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const quotient = drawValue(config, rand);
  if (quotient === null) return null;
  const { min, max } = divisorOf(config);
  const divisor = between(min, max, rand);
  const dividend = fixedText(timesWhole(quotient, divisor));
  return divided(dividend, divisor, quotient);
}

/**
 * A whole number divided to a decimal answer: 7 ÷ 4 = 1.75.
 *
 * The divisor is drawn first and the quotient then walked in the steps that
 * make their product whole, for the reason `drawPercent` gives: a divisor
 * makes a whole number of one quotient in fifty at two places (2) or one in
 * twenty-five (4), so a draw that made a pair and rejected it would print the
 * friendliest divisors over and over. A divisor with no factor of ten in it —
 * 3, 7, 9 — makes a whole number of no decimal quotient at all, and is left
 * out rather than rounded in. A whole quotient is left out too, because an
 * answer that runs past the point is what this sheet promises.
 *
 * In columns the dividend prints with the zeros annexed, `7.00`, which is the
 * form a child keeps dividing into; along a line it is the whole number it is.
 */
export function drawWholeDividend(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const places = placesOf(config);
  const by = scale(places);
  const span = divisorOf(config);
  const divisor = between(span.min, span.max, rand);
  const step = by / gcd(by, divisor);
  if (step === by) return null;
  const { min, max } = bounds(config.range);
  const first = Math.ceil(Math.max(min * by, 1) / step);
  const last = Math.floor((max * by) / step);
  if (first > last) return null;
  const units = between(first, last, rand) * step;
  if (units % by === 0) return null;
  const quotient = fixed(units, places);
  const product = timesWhole(quotient, divisor);
  const whole = String(product.units / by);
  return divided(whole, divisor, quotient, fixedText(product));
}

/**
 * A decimal divided by a decimal: 8.4 ÷ 0.2.
 *
 * Drawn as the whole-number division a child rewrites it into — 84 ÷ 2 — and
 * then each side is given its places: the divisor one to `places`, and the
 * dividend at least as many, so the answer is the whole quotient with the
 * point moved back by the difference, exact by construction. Neither side
 * ends in a zero, because the two sides carry different place counts by
 * design and `8.40 ÷ 0.2` is a number written the long way for no column to
 * line up on. Along a line only, so no bracket is returned: set in one it
 * would be the rewritten sum rather than the question, and the rewriting is
 * the lesson (§22).
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
 * The working under a decimal dividend (§22).
 *
 * Computed on the digits alone — the point is not a column — and then the
 * quotient is padded back to the units column with zeros, so a quotient below
 * one is written `0.23` and never `.23`. The zeros are written digits: a child
 * writes them, and a guided sheet shades their squares.
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
