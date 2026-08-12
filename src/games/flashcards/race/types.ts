/** How the card that just landed was answered, or null while it's still live. */
export type Feedback = {
  kind: "right" | "wrong" | "timeout";
  given: string | null;
} | null;
