/**
 * Something to cut out and fold up, or cut out and spin.
 *
 * Two drawings with nothing in common but the block that carries them: a die is
 * six squares, five folds and seven glue tabs, and a spinner is a circle cut
 * into equal sectors with an arrow under it. They share a `Block` kind because
 * `templates/nets.ts` is one family — both are objects rather than pages, and
 * both are wrong in the same way if the ink is a sixteenth of an inch out — and
 * they share nothing else, which is why the file that dispatches between them
 * is this one and the drawings are two files of their own.
 */
import type { BlockProps } from "./block";
import { Cube } from "./Cube";
import { Spinner } from "./Spinner";

export function Net({ block, metrics }: BlockProps<"net">) {
  return block.net.shape === "cube" ? (
    <Cube net={block.net} fontPt={metrics.fontPt} />
  ) : (
    <Spinner net={block.net} fontPt={metrics.fontPt} />
  );
}
