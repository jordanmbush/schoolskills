import type { BlockProps } from "./block";

/**
 * Sentences with something missing.
 *
 * `_` marks each gap, the same convention `Card.clue` already uses, so a run of
 * underscores of any length is one blank. The gap is a ruled span rather than
 * the underscores themselves: underscores set in a proportional face are a
 * ragged line whose length depends on how many the generator happened to
 * write, and a child writing in one needs the same room whatever the answer is.
 *
 * On the key the answer is printed in the gap and the rule stays under it,
 * which is how a marked sheet reads.
 */
export function Blanks({ block, metrics }: BlockProps<"blanks">) {
  return (
    <ol className="sheet__blanks">
      {block.sentences.map((sentence, index) => {
        // n gaps split the sentence into n + 1 segments, so segment i is
        // followed by gap i — and the last segment is followed by nothing.
        const segments = sentence.text.split(/_+/);
        return (
          <li className="sheet__sentence" key={`${index}-${sentence.text}`}>
            <span className="sheet__number">{index + 1}.</span>
            {segments.map((segment, gap) => (
              <span key={gap}>
                {segment}
                {gap < segments.length - 1 && (
                  <span
                    className={`sheet__slot${
                      metrics.answers ? " sheet__slot--answered" : ""
                    }`}
                  >
                    {metrics.answers ? (sentence.answers[gap] ?? "") : ""}
                  </span>
                )}
              </span>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
