/**
 * The head of the paper pane: everything that is about the sheet as paper
 * rather than about making it. Print first, because it is the one thing every
 * visit ends in; then how many copies and whether the answer key comes with
 * them; then another draw of the same settings, and the link.
 *
 * Print is the entire output path and the browser's own dialog is the download
 * as well as the print (§10). The sentence that says so is under the paper
 * (`Caption.tsx`), because it needs a line and this row has room for a word.
 *
 * The link button copies the address bar, which already holds the whole
 * configuration: `useBuilder` rewrites `#s=` on every change, so there is
 * nothing to build here and nothing to keep in step.
 */
import { useState, type RefObject } from "react";

import { Button, Checkbox, NumberStepper } from "@/components/ui/kit";

import { MAX_VARIANTS } from "./useBuilder";

/**
 * The button's three labels. "Copy it from the address bar" is the refusal, and
 * it is an instruction rather than an apology: the link the button would have
 * copied is already visible, so the one useful thing to say is where.
 */
const COPY_LABEL = {
  nothing: "Copy link",
  copied: "Link copied",
  refused: "Copy it from the address bar",
} as const;

export function PrintBar({
  variants,
  answers,
  onVariants,
  onAnswers,
  onReroll,
  printRef,
}: {
  variants: number;
  answers: boolean;
  onVariants: (count: number) => void;
  onAnswers: (on: boolean) => void;
  onReroll: () => void;
  /** The Print button, so the last step's "Next" can hand focus to it. */
  printRef: RefObject<HTMLButtonElement | null>;
}) {
  // Three states rather than a boolean, because the failure has to be visible:
  // see `copyLink`.
  const [said, setSaid] = useState<"nothing" | "copied" | "refused">("nothing");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSaid("copied");
    } catch {
      // Clipboard access is refused often enough — an insecure origin, a
      // browser that wants a gesture it didn't see — that failing silently
      // would be a button that does nothing. The URL is in the address bar
      // either way, so the honest fallback is to say so.
      setSaid("refused");
    }
    window.setTimeout(() => setSaid("nothing"), 2400);
  };

  return (
    <div className="printbar">
      <Button variant="go" ref={printRef} onClick={() => window.print()}>
        Print
      </Button>
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
      <span className="printbar__sheet">
        <Button variant="ghost" size="sm" onClick={onReroll}>
          Another sheet like this
        </Button>
        <Button variant="ghost" size="sm" onClick={() => void copyLink()}>
          {COPY_LABEL[said]}
        </Button>
      </span>
    </div>
  );
}
