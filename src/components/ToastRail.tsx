import { useHub } from "@/components/state/HubContext";

/**
 * Lives outside `components/ui/` deliberately: it reads the hub, so it is a
 * connected component, not a primitive. The kit boundary caught this during
 * the port — the original `ui.tsx` mixed the two.
 */
export function ToastRail() {
  const { toasts } = useHub();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-rail" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast${toast.tone === "bad" ? " toast--bad" : ""}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
