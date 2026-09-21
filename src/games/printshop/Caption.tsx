/**
 * The line under the paper: what the engine says is on it, which draw of it
 * this is, and the two things to do with a sheet short of printing it — another
 * draw, and the link.
 *
 * The link button copies the address bar, which already holds the whole
 * configuration: `useBuilder` rewrites `#s=` on every change, so there is
 * nothing to build here and nothing to keep in step.
 */
import { useState } from "react";

import { Button } from "@/components/ui/kit";

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

export function Caption({
  line,
  seed,
  onReroll,
}: {
  /** The family's own sentence about what is set — `describe(config)`. */
  line: string;
  seed: number;
  onReroll: () => void;
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
    <div className="caption no-print">
      <p className="caption__line">{line}</p>
      <p className="caption__seed">
        Sheet <span className="u-mono">{seed}</span>. The number is printed at
        the foot of the page, so this exact sheet can be had again. For a file
        rather than paper, choose <strong>Save as PDF</strong> in the print
        dialog.
      </p>
      <span className="caption__actions">
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
