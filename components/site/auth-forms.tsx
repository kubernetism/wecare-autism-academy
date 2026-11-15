"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { hardNavigate } from "@/lib/hard-navigate";
import { safeNextPath, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { ErrorSummary, Field, inputClass, SubmitButton, useFieldErrors } from "./form-kit";

function homeFor(role: string | null | undefined) {
  return role === "admin" || role === "staff" ? "/app" : "/portal";
}

/** Only follow `next` into the area the signed-in role can use. */
function destination(role: string | null | undefined, next: string | null) {
  const home = homeFor(role);
  if (next && (next === home || next.startsWith(`${home}/`) || next.startsWith(`${home}?`))) return next;
  return home;
}

function friendlyAuthError(error: { status?: number; code?: string; message?: string }, mode: "signin" | "signup") {
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  if (mode === "signin") return "That email and password do not match an account. Please try again.";
  if (error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return "An account with this email already exists. Try logging in instead.";
  }
  return error.message ?? "We could not create your account. Please try again.";
}

function PasswordInput({
  value,
  onChange,
  onBlur,
  autoComplete,
  ...field
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  autoComplete: string;
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        {...field}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        className={`${inputClass} pr-14`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-1 my-auto grid size-11 place-items-center rounded-lg text-ink-soft hover:text-harbour focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-harbour/25"
      >
        {shown ? <EyeSlash size={22} aria-hidden /> : <Eye size={22} aria-hidden />}
      </button>
    </div>
  );
}

const SIGN_IN_LABELS = { email: "Email", password: "Password" };

export function LoginForm() {
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [values, setValues] = useState({ email: "", password: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { errors, check, checkAll } = useFieldErrors(signInSchema.shape);
  const summaryRef = useRef<HTMLDivElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (Object.keys(checkAll(values)).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    startTransition(async () => {
      const parsed = signInSchema.parse(values);
      const { data, error } = await authClient.signIn.email(parsed);
      if (error || !data) {
        setMessage(friendlyAuthError(error ?? {}, "signin"));
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      hardNavigate(destination(data.user.role, next));
    });
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <ErrorSummary errors={errors} labels={SIGN_IN_LABELS} message={message} summaryRef={summaryRef} />
      <Field label="Email" name="email" error={errors.email}>
        {(p) => (
          <input
            {...p}
            type="email"
            inputMode="email"
            autoComplete="email"
            className={inputClass}
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            onBlur={() => values.email && check("email", values.email)}
          />
        )}
      </Field>
      <Field label="Password" name="password" error={errors.password}>
        {(p) => (
          <PasswordInput
            {...p}
            autoComplete="current-password"
            value={values.password}
            onChange={(password) => setValues((v) => ({ ...v, password }))}
            onBlur={() => errors.password && check("password", values.password)}
          />
        )}
      </Field>
      <SubmitButton pending={pending}>Log in</SubmitButton>
      <p className="text-ink-soft">
        New parent?{" "}
        <Link href="/register" className="inline-flex min-h-11 items-center font-semibold text-harbour underline underline-offset-4">
          Create a parent account
        </Link>
        . Clinic staff accounts are created by the clinic administrator.
      </p>
    </form>
  );
}

const SIGN_UP_LABELS = { name: "Your full name", email: "Email", password: "Password", confirmPassword: "Repeat password" };

export function RegisterForm() {
  const [values, setValues] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { errors, setErrors, check, checkAll } = useFieldErrors({
    name: signUpSchema.shape.name,
    email: signUpSchema.shape.email,
    password: signUpSchema.shape.password,
  });
  const summaryRef = useRef<HTMLDivElement>(null);
  const set = (name: keyof typeof values) => (value: string) => setValues((v) => ({ ...v, [name]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const found = checkAll(values);
    if (values.confirmPassword !== values.password) found.confirmPassword = "The passwords do not match.";
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    startTransition(async () => {
      const { name, email, password } = signUpSchema.parse(values);
      const { error } = await authClient.signUp.email({ name, email, password });
      if (error) {
        setMessage(friendlyAuthError(error, "signup"));
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }
      hardNavigate("/portal");
    });
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-6">
      <ErrorSummary errors={errors} labels={SIGN_UP_LABELS} message={message} summaryRef={summaryRef} />
      <Field label={SIGN_UP_LABELS.name} name="name" error={errors.name}>
        {(p) => <input {...p} autoComplete="name" className={inputClass} value={values.name} onChange={(e) => set("name")(e.target.value)} onBlur={() => values.name && check("name", values.name)} />}
      </Field>
      <Field label={SIGN_UP_LABELS.email} name="email" error={errors.email}>
        {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" className={inputClass} value={values.email} onChange={(e) => set("email")(e.target.value)} onBlur={() => values.email && check("email", values.email)} />}
      </Field>
      <Field label={SIGN_UP_LABELS.password} name="password" error={errors.password} hint="At least 10 characters.">
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.password} onChange={set("password")} onBlur={() => values.password && check("password", values.password)} />}
      </Field>
      <Field label={SIGN_UP_LABELS.confirmPassword} name="confirmPassword" error={errors.confirmPassword}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.confirmPassword} onChange={set("confirmPassword")} onBlur={() => undefined} />}
      </Field>
      <SubmitButton pending={pending}>Create parent account</SubmitButton>
      <p className="text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-harbour underline underline-offset-4">
          Log in
        </Link>
        .
      </p>
    </form>
  );
}
