import { CountersView } from "../Counters";
import type { BlockProps } from "./block";

/**
 * Counters on their own, as the picture a lesson is about.
 *
 * The same drawing a problem carries, for the reason `Line` is the same
 * drawing as the line under a sum: one placing of the dots, so the ring a
 * child sees in the lesson is the ring they see beside the problem. Not a
 * `problems` block with one item in it, which would number the picture "1."
 * and ask for an answer nobody set.
 */
export function Dots({ block }: BlockProps<"counters">) {
  return <CountersView counters={block.counters} />;
}
