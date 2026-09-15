/**
 * The working of a long division, as data (§21).
 *
 * Divide, multiply, subtract, bring down — walked exactly as it is written on
 * paper, and returned as the digits that get written and the columns they get
 * written in. The renderer places those digits in squares and does no
 * arithmetic of its own, so the key shows the working that was computed when
 * the problem was built rather than a second computation that might disagree
 * with it (§7).
 *
 * Columns are counted over the dividend's digits alone. A decimal point is not
 * a column; a family that prints one records where it falls and this module
 * never sees it.
 */

export type TableauRow = {
  /**
   * `take` is the product subtracted (it gets the − and the rule under it);
   * `left` is what remains with the next digit brought down. The last row is
   * always `left` and is the remainder.
   */
  role: "take" | "left";
  /** The digits as written — "05" after 6 − 6 with 5 brought down. */
  text: string;
  /** The dividend column its last digit sits under, counted from 0. */
  end: number;
};

export type Tableau = {
  /** Digits only. `start` is the column the first of them sits over. */
  quotient: { text: string; start: number };
  rows: TableauRow[];
  remainder: number;
};

const NOTHING: Tableau = {
  quotient: { text: "", start: 0 },
  rows: [],
  remainder: 0,
};

/**
 * The tableau of `digits ÷ divisor`.
 *
 * The quotient's first digit is written at the first column where the digits
 * read so far come to at least the divisor — 105 ÷ 7 starts at the 0, because
 * 1 is short of 7 and 10 is not. From there every column writes a digit, zero
 * included: 849 ÷ 12 writes 7, then 0 over the 9, because that is what the
 * algorithm writes and a key that skipped it would show a child a different
 * method. A dividend smaller than its divisor writes a single 0 over the last
 * column, which is the one case where the quotient is written and is nothing.
 *
 * A `left` row's text is the remainder of the subtraction followed by the digit
 * brought down, so it can begin with a 0 ("05") — the digit a child writes
 * before bringing the next one down. The final `left` row has nothing to bring
 * down and is the remainder.
 */
export function divisionTableau(digits: string, divisor: number): Tableau {
  if (!/^\d+$/.test(digits) || !Number.isInteger(divisor) || divisor < 1)
    return NOTHING;

  const last = digits.length - 1;
  const rows: TableauRow[] = [];
  let quotient = "";
  let start = 0;
  let running = 0;

  for (let column = 0; column <= last; column += 1) {
    running = running * 10 + Number(digits[column]);
    if (quotient === "") {
      if (running < divisor && column < last) continue;
      start = column;
    }

    const digit = Math.floor(running / divisor);
    const taken = digit * divisor;
    quotient += String(digit);
    rows.push({ role: "take", text: String(taken), end: column });

    running -= taken;
    if (column < last) {
      rows.push({
        role: "left",
        text: `${running}${digits[column + 1]}`,
        end: column + 1,
      });
    } else {
      rows.push({ role: "left", text: String(running), end: column });
    }
  }

  return { quotient: { text: quotient, start }, rows, remainder: running };
}
