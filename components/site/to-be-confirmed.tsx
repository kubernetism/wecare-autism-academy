import type { ReactNode } from "react";

/**
 * Renders a clinic detail, or a clearly marked placeholder when the clinic has
 * not entered it yet. We never invent contact details.
 */
export function ValueOrPlaceholder({ value, children }: { value: string | null; children?: ReactNode }) {
  if (!value) {
    return (
      <span className="inline-flex items-center rounded-lg bg-marigold-soft px-2 py-0.5 text-sm font-semibold text-ink">
        To be confirmed
      </span>
    );
  }
  return <>{children ?? value}</>;
}
