/**
 * Deterministic RNG. Decks are generated from a seed so that racing a ghost
 * means racing over the *same* cards in the same order — otherwise the
 * comparison isn't a race, it's a coincidence.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A whole number from `min` to `max`, both ends included.
 *
 * Here rather than in the module that first wanted it because three of the
 * sheet families draw numbers out of a declared range, and an off-by-one in a
 * bound is a worksheet with a problem on it the parent excluded.
 */
export function between(min: number, max: number, rand: () => number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

export function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}
