"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { contactSchema } from "@/lib/validation/public-forms";
import { submitContact } from "@/server/actions/public";
import { ErrorSummary, Field, Honeypot, inputClass, SubmitButton, useFieldErrors } from "./form-kit";

const LABELS = { name: "Your name", email: "Email", phone: "Phone", subject: "Subject", message: "Message" };
type Values = Record<keyof typeof LABELS, string>;
const EMPTY: Values = { name: "", email: "", phone: "", subject: "", message: "" };
const c = contactSchema.shape;
const shape = { name: c.name, email: c.email, phone: c.phone, subject: c.subject, message: c.message };

export function ContactForm() {
  const [values, setValues] = useState<Values>(EMPTY);
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const { errors, setErrors, check, checkAll } = useFieldErrors(shape);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const set = (name: keyof Values) => (value: string) => setValues((v) => ({ ...v, [name]: value }));
  const blur = (name: keyof Values) => () => {
    if (values[name] !== "" || errors[name]) check(name, values[name]);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const found = checkAll(values);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    startTransition(async () => {
      const result = await submitContact({ ...values, website });
      if (result.ok) {
        setSent(true);
        requestAnimationFrame(() => doneRef.current?.focus());
        return;
      }
      if (result.error.fieldErrors) setErrors(result.error.fieldErrors);
      setMessage(result.error.message);
      requestAnimationFrame(() => summaryRef.current?.focus());
    });
  }

  if (sent) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-4 focus:outline-none">
        <CheckCircle size={44} weight="duotone" className="text-harbour" aria-hidden />
        <h2 className="font-display text-2xl font-semibold text-ink">Thank you, your message has been sent</h2>
        <p className="text-ink-soft">The clinic team reads every message and will reply by email or phone.</p>
        <button
          type="button"
          onClick={() => {
            setValues(EMPTY);
            setSent(false);
          }}
          className="min-h-11 rounded-xl border border-field px-5 font-semibold text-ink hover:border-harbour hover:text-harbour"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="relative flex flex-col gap-6">
      <ErrorSummary errors={errors} labels={LABELS} message={message} summaryRef={summaryRef} />
      <Field label={LABELS.name} name="name" error={errors.name}>
        {(p) => <input {...p} className={inputClass} autoComplete="name" value={values.name} onChange={(e) => set("name")(e.target.value)} onBlur={blur("name")} />}
      </Field>
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={LABELS.email} name="email" error={errors.email}>
          {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" className={inputClass} value={values.email} onChange={(e) => set("email")(e.target.value)} onBlur={blur("email")} />}
        </Field>
        <Field label={LABELS.phone} name="phone" error={errors.phone} optional>
          {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" className={inputClass} value={values.phone} onChange={(e) => set("phone")(e.target.value)} onBlur={blur("phone")} />}
        </Field>
      </div>
      <Field label={LABELS.subject} name="subject" error={errors.subject}>
        {(p) => <input {...p} className={inputClass} value={values.subject} onChange={(e) => set("subject")(e.target.value)} onBlur={blur("subject")} />}
      </Field>
      <Field label={LABELS.message} name="message" error={errors.message} hint="At least 10 characters.">
        {(p) => (
          <textarea {...p} rows={6} maxLength={4000} className={`${inputClass} resize-y`} value={values.message} onChange={(e) => set("message")(e.target.value)} onBlur={blur("message")} />
        )}
      </Field>
      <Honeypot value={website} onChange={setWebsite} />
      <div>
        <SubmitButton pending={pending}>Send message</SubmitButton>
      </div>
    </form>
  );
}
