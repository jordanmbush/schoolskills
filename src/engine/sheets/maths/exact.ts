/**
 * Numbers a worksheet can be marked against — the two exact shapes fractions,
 * decimals and money count in, and the argument for them (§11).
 *
 * Nothing here knows what a sheet is, so a family cannot grow a second answer
 * to a question this file has already settled.
 */

/* ── Fractions ─────────────────────────────────────────────────────────────
   A numerator and a denominator, both whole, the denominator positive. No
   fraction *question* in the shop is negative — a subtraction sheet orders its
   operands so it doesn't have to — so a minus sign is the slope sheet's to
   write, in `prealgebra.ts`, and not this file's to carry.                   */

export type Fraction = { n: number; d: number };

export function gcd(a: number, b: number): number {
  let left = Math.abs(Math.trunc(a));
  let right = Math.abs(Math.trunc(b));
  while (right > 0) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left;
}

/** The same value with nothing left to cancel. Zero is `0/1`, always. */
export function reduced(value: Fraction): Fraction {
  if (value.n === 0) return { n: 0, d: 1 };
  const by = gcd(value.n, value.d);
  return by <= 1 ? { ...value } : { n: value.n / by, d: value.d / by };
}

/** Whether a fraction is already written the smallest way it can be. */
export const lowest = (value: Fraction): boolean =>
  value.n === 0 ? value.d === 1 : gcd(value.n, value.d) === 1;

/**
 * The four operations, over a common denominator of `a.d × b.d`.
 *
 * Deliberately not the *lowest* common denominator: the product is always a
 * common one, `reduced` takes the answer down to lowest terms afterwards, and
 * the numbers a worksheet works in are small enough that the intermediate never
 * approaches an unsafe integer. One less thing to be subtly wrong.
 */
export const plus = (a: Fraction, b: Fraction): Fraction =>
  reduced({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });

export const minus = (a: Fraction, b: Fraction): Fraction =>
  reduced({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });

export const times = (a: Fraction, b: Fraction): Fraction =>
  reduced({ n: a.n * b.n, d: a.d * b.d });

export const over = (a: Fraction, b: Fraction): Fraction =>
  reduced({ n: a.n * b.d, d: a.d * b.n });

/**
 * Negative, zero or positive, the way a comparator answers.
 *
 * Cross-multiplied rather than divided out, because dividing is where the floats
 * would get back in. Both denominators are positive, so the sense of the
 * comparison survives the multiplication.
 */
export const compare = (a: Fraction, b: Fraction): number =>
  a.n * b.d - b.n * a.d;

export const whole = (value: number): Fraction => ({ n: value, d: 1 });

/**
 * A fraction as it is written on paper: "3/4", or "3" when there is nothing
 * under the line to say.
 *
 * A solidus rather than a stacked drawing, and that is a decision rather than a
 * shortcut. A stacked fraction would be a `Problem` shape of its own — new
 * markup, new alignment, and an answer nobody can type — where "3/4" is real
 * text a search engine reads, a screen reader says correctly and a parent can
 * copy (§2). It is also how a child writes one in the blank.
 */
export function fractionText(value: Fraction): string {
  if (value.d === 1) return String(value.n);
  return `${value.n}/${value.d}`;
}

/**
 * The same value as a whole number and what is left over: "1 1/4" rather than
 * "5/4". Which form a sheet wants is the family's call, not this one's.
 */
export function mixedText(value: Fraction): string {
  if (value.d === 1 || value.n < value.d) return fractionText(value);
  const units = Math.floor(value.n / value.d);
  const left = value.n - units * value.d;
  return left === 0 ? String(units) : `${units} ${left}/${value.d}`;
}

/** Written the way the sheet asks: as a mixed number, or left top-heavy. */
export const writeFraction = (value: Fraction, mixed: boolean): string =>
  mixed ? mixedText(value) : fractionText(value);

/* ── Signed whole numbers ────────────────────────────────────────────────── */

/**
 * The proper minus sign, U+2212 — not a hyphen.
 *
 * The same character `arithmetic.ts` prints as its operator, and for the same
 * reason: a hyphen is narrower than a plus and sits at the wrong height beside
 * one, so a column of sums set in the two of them looks like a typing error to
 * the adult marking it.
 */
export const MINUS = "−";

/** A signed whole number as it is written on its own: "7", "−7". */
export const signedText = (value: number): string =>
  value < 0 ? `${MINUS}${Math.abs(value)}` : String(value);

/**
 * The same number written *after* an operator: "7", "(−7)".
 *
 * The bracket is the notation rather than a nicety — `7 + −4` is two operators
 * in a row, and a child asked to read it aloud has been asked the wrong
 * question. Algebra is the one place this does not apply: `3x − 4` is how a
 * negative constant is written in an equation, with the sign folded into the
 * operator, and a sheet printing `3x + (−4)` would be teaching notation nobody
 * uses.
 */
export const factorText = (value: number): string =>
  value < 0 ? `(${signedText(value)})` : String(value);

/* ── Fixed point ───────────────────────────────────────────────────────────
   $3.45 is `{ units: 345, places: 2 }` from the moment it is drawn to the moment
   it is printed. `fixedText` is the one function in the shop that knows where
   the point goes.                                                           */

export type Fixed = { units: number; places: number };

/** Ten to the `places` — how many of the smallest unit make one whole. */
export const scale = (places: number): number => 10 ** Math.max(0, places);

export const fixed = (units: number, places: number): Fixed => ({
  units: Math.round(units),
  places: Math.max(0, Math.trunc(places)),
});

/**
 * Adding and subtracting are adding and subtracting the units, which is the
 * whole point of holding a decimal this way: two amounts at the same number of
 * places are two whole numbers, and whole numbers do not drift.
 */
export const plusFixed = (a: Fixed, b: Fixed): Fixed =>
  fixed(a.units + b.units, a.places);

export const minusFixed = (a: Fixed, b: Fixed): Fixed =>
  fixed(a.units - b.units, a.places);

/**
 * A decimal multiplied by a whole number — three lots of £1.25.
 *
 * Whole numbers only, and that is what keeps the promise the config makes:
 * `0.25 × 0.4` is 0.1, which has fewer places than either number that made it,
 * and `2.5 × 2.5` has more. A sheet set at two places whose answers are at four
 * is a sheet nobody chose.
 */
export const timesWhole = (value: Fixed, by: number): Fixed =>
  fixed(value.units * Math.round(by), value.places);

/**
 * The number with its point written in: "3.45", "0.60", "12.000".
 *
 * Padded to the places the value carries rather than trimmed, because trailing
 * zeros are not noise on a worksheet — they are how a column of decimals lines
 * up under itself, and how a child is taught that 0.6 and 0.60 are the same
 * number.
 */
export function fixedText(value: Fixed): string {
  const units = Math.abs(value.units);
  const by = scale(value.places);
  const sign = value.units < 0 ? "-" : "";
  const front = Math.floor(units / by);
  if (value.places === 0) return `${sign}${front}`;
  const back = String(units - front * by).padStart(value.places, "0");
  return `${sign}${front}.${back}`;
}

/** The same value as a fraction, for the sheets that ask for both forms. */
export const fixedFraction = (value: Fixed): Fraction =>
  reduced({ n: value.units, d: scale(value.places) });
