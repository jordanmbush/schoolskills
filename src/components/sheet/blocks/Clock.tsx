import { ClockFaceView } from "../ClockFace";
import type { BlockProps } from "./block";

/**
 * A row of analog dials.
 *
 * One block covers both halves of telling the time: `hands: true` is a face to
 * read, `hands: false` is a face to draw. On the key the hands appear either
 * way — a sheet asking a child to draw twenty past three is answered by the face
 * with the hands on it.
 *
 * The dial itself is `ClockFace.tsx`, because a clock is also drawn beside a
 * problem in the problem grid — the same face, the same size, and the same rule
 * about when the hands go on it.
 */
export function Clock({ block, metrics }: BlockProps<"clock">) {
  return (
    <div className="sheet__faces">
      {block.faces.map((face, index) => (
        <figure className="sheet__face" key={`${index}-${face.label ?? ""}`}>
          <ClockFaceView face={face} answers={metrics.answers} />
          {face.label && (
            <figcaption className="sheet__caption">{face.label}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}
