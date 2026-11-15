"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useId, useState, type ReactNode, type RefObject } from "react";
import type { z } from "zod";

/**
 * Small accessible form kit for the website (no component library).
 * Labels sit above fields, hints and errors below, fields are linked to them
 * with aria-describedby, and invalid fields get aria-invalid. Validation uses
 * the same Zod schemas as the Server Actions.
 */

export type FieldErrors = Record<string, string>;

/** Native inputs give "" for empty; treat it as missing so "Please enter..." messages show. */
const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

/** Per-field validation against one schema per field, plus server error adoption. */
export function useFieldErrors<T extends Record<string, z.ZodType>>(shape: T) {
  const [errors, setErrors] = useState<FieldErrors>({});

  function check(name: keyof T & string, value: unknown): boolean {
    const result = shape[name]!.safeParse(blankToUndefined(value));
    setErrors((prev) => {
      const next = { ...prev };
      if (result.success) delete next[name];
      else next[name] = result.error.issues[0]?.message ?? "Please check this field.";
      return next;
    });
    return result.success;
  }

  function checkAll(values: Partial<Record<keyof T & string, unknown>>): FieldErrors {
    const found: FieldErrors = {};
    for (const name of Object.keys(shape) as (keyof T & string)[]) {
      const result = shape[name]!.safeParse(blankToUndefined(values[name]));
      if (!result.success) found[name] = result.error.issues[0]?.message ?? "Please check this field.";
    }
    setErrors(found);
    return found;
  }

  return { errors, setErrors, check, checkAll };
}

export function Field({
  label,
  name,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const id = `field-${name}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-semibold text-danger">
          <WarningCircle size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "min-h-12 w-full rounded-xl border border-field bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted " +
  "transition-colors hover:border-ink-soft focus:border-harbour focus:outline-none focus:ring-4 focus:ring-harbour/20 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15";

export function ErrorSummary({
  errors,
  labels,
  message,
  summaryRef,
}: {
  errors: FieldErrors;
  labels: Record<string, string>;
  message: string | null;
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  const entries = Object.entries(errors).filter(([name]) => labels[name]);
  if (!message && entries.length === 0) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-ink focus:outline-none focus:ring-4 focus:ring-danger/20"
    >
      <p className="flex items-center gap-2 font-semibold text-danger">
        <WarningCircle size={20} weight="bold" aria-hidden />
        {message ?? "Please check the highlighted fields."}
      </p>
      {entries.length > 0 ? (
        <ul className="mt-2 list-disc pl-7 text-sm">
          {entries.map(([name, text]) => (
            <li key={name}>
              <a href={`#field-${name}`} className="font-semibold underline underline-offset-2">
                {labels[name]}
              </a>
              : {text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-harbour px-6 text-base font-semibold text-surface transition-[background-color,transform] hover:bg-harbour-deep active:translate-y-px disabled:cursor-progress disabled:opacity-80"
    >
      {pending ? (
        <span className="size-4 animate-spin rounded-full border-2 border-surface/40 border-t-surface motion-reduce:animate-none" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

/** Hidden field people never fill in (bots often do). */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
      <label htmlFor={id}>Leave this empty</label>
      <input id={id} tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
