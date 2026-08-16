import { TracedRow } from "../Traced";
import type { BlockProps } from "./block";

/**
 * A passage on ruled lines, in one of the five trace styles.
 *
 * **Where it breaks is the family's decision, not this component's.** There is
 * no measurement in the view — that is the declared-size bargain `layout.ts` is
 * built on (§4) — so one line of `text` is one repeat of the ruling, and a
 * family that wants a verse across four lines puts three newlines in it. It
 * also means a Scripture passage is stored and rendered exactly as it was
 * given, punctuation and all, which the WEB's one licence condition requires
 * (§12).
 */
export function Copywork({ block, metrics }: BlockProps<"copywork">) {
  return (
    <div className="sheet__block">
      {block.text.split("\n").map((line, index) => (
        <div className="sheet__row" key={`${index}-${line}`}>
          <TracedRow
            rule={block.rule}
            metrics={metrics}
            cells={[{ text: line, style: block.mode }]}
          />
        </div>
      ))}
    </div>
  );
}
