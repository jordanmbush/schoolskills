/**
 * What leaves the bench as paper, at the right-hand end of the rail: how many
 * copies, whether the answer key comes with them, and Print.
 *
 * Print is the entire output path and the browser's own dialog is the download
 * as well as the print (§10). The sentence that says so is under the paper
 * (`Caption.tsx`), because it needs a line and the rail has room for a word.
 */
import { Button, Checkbox, NumberStepper } from "@/components/ui/kit";

import { MAX_VARIANTS } from "./useBuilder";

export function PrintBar({
  variants,
  answers,
  onVariants,
  onAnswers,
}: {
  variants: number;
  answers: boolean;
  onVariants: (count: number) => void;
  onAnswers: (on: boolean) => void;
}) {
  return (
    <div className="printbar">
      <span className="printbar__copies">
        <span aria-hidden="true">Copies</span>
        <NumberStepper
          label="Copies, each a different draw of the same settings"
          value={variants}
          min={1}
          max={MAX_VARIANTS}
          onChange={onVariants}
        />
      </span>
      <Checkbox
        label="Answer key"
        className="checkbox checkbox--inline"
        checked={answers}
        onChange={onAnswers}
      />
      <Button variant="go" onClick={() => window.print()}>
        Print
      </Button>
    </div>
  );
}
