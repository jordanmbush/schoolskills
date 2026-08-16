import { inch } from "../units";
import type { BlockProps } from "./block";

/**
 * Reserved space with nothing in it.
 *
 * The one block whose whole content is its height — a page a child writes a
 * story on is a title, a name line and one of these. It is `aria-hidden`
 * because there is nothing there to announce; the blank is the point.
 */
export function Spacer({ block }: BlockProps<"spacer">) {
  return (
    <div
      className="sheet__spacer"
      style={{ height: inch(block.height) }}
      aria-hidden="true"
    />
  );
}
