"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { THERAPIES } from "@/content/therapies";
import { APPOINTMENT_TYPES, PREFERRED_TIMES, type AppointmentType } from "@/db/schema/enums";
import { APPOINTMENT_TYPE_HELP, APPOINTMENT_TYPE_LABEL, PREFERRED_TIME_LABEL } from "@/lib/labels";
import { bookingSchema } from "@/lib/validation/public-forms";
import { submitBooking } from "@/server/actions/public";
import { ErrorSummary, Field, Honeypot, inputClass, SubmitButton, useFieldErrors } from "./form-kit";

const LABELS = {
  type: "What you would like to book",
  contactName: "Your name",
  contactPhone: "Phone",
  contactEmail: "Email",
  childName: "Child's first name",
  childAgeYears: "Age in years",
  therapySlug: "Therapy",
  preferredDate: "Preferred date",
  preferredTime: "Preferred time of day",
  message: "Anything we should know",
};

type Values = {
  type: AppointmentType;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  childName: string;
  childAgeYears: string;
  therapySlug: string;
  preferredDate: string;
  preferredTime: string;
  message: string;
};

const s = bookingSchema.shape;
const SHAPE = {
  type: s.type,
  contactName: s.contactName,
  contactPhone: s.contactPhone,
  contactEmail: s.contactEmail,
  childName: s.childName,
  childAgeYears: s.childAgeYears,
  therapySlug: s.therapySlug,
  preferredDate: s.preferredDate,
  preferredTime: s.preferredTime,
  message: s.message,
};

/** The number input gives a string; the schema expects a number or nothing. */
function toPayload(values: Values) {
  const age = values.childAgeYears.trim();
  return { ...values, childAgeYears: age === "" ? undefined : Number(age) };
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Reads `?therapy=` / `?type=` to preselect; must render inside <Suspense>. */
export function BookingFormWithParams() {
  const params = useSearchParams();
  const therapy = params.get("therapy");
  const type = params.get("type");
  return (
    <BookingForm
      initialTherapy={THERAPIES.some((t) => t.slug === therapy) ? (therapy ?? undefined) : undefined}
      initialType={APPOINTMENT_TYPES.includes(type as AppointmentType) ? (type as AppointmentType) : undefined}
    />
  );
}

export function BookingForm({ initialTherapy, initialType }: { initialTherapy?: string; initialType?: AppointmentType }) {
  const empty: Values = {
    type: initialType ?? "appointment",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    childName: "",
    childAgeYears: "",
    therapySlug: initialTherapy ?? "unsure",
    preferredDate: "",
    preferredTime: "any",
    message: "",
  };
  const [values, setValues] = useState<Values>(empty);
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sentType, setSentType] = useState<AppointmentType | null>(null);
  const [pending, startTransition] = useTransition();
  const { errors, setErrors, check, checkAll } = useFieldErrors(SHAPE);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const set = (name: keyof Values) => (value: string) => setValues((v) => ({ ...v, [name]: value }));
  const blur = (name: keyof Values) => () => {
    if (values[name] !== "" || errors[name]) check(name, toPayload(values)[name]);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const payload = toPayload(values);
    const found = checkAll(payload);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    startTransition(async () => {
      const result = await submitBooking({ ...payload, website });
      if (result.ok) {
        setSentType(values.type);
        requestAnimationFrame(() => doneRef.current?.focus());
        return;
      }
      if (result.error.fieldErrors) setErrors(result.error.fieldErrors);
      setMessage(result.error.message);
      requestAnimationFrame(() => summaryRef.current?.focus());
    });
  }

  if (sentType) {
    return (
      <div ref={doneRef} tabIndex={-1} role="status" className="flex flex-col items-start gap-4 focus:outline-none">
        <CheckCircle size={44} weight="duotone" className="text-harbour" aria-hidden />
        <h2 className="font-display text-2xl font-semibold text-ink">Thank you, your request has been sent</h2>
        <p className="text-ink-soft">
          We have received your {APPOINTMENT_TYPE_LABEL[sentType].toLowerCase()} request. The clinic will contact you by
          phone or email to confirm a time.
        </p>
        <button
          type="button"
          onClick={() => {
            setValues(empty);
            setSentType(null);
          }}
          className="min-h-11 rounded-xl border border-field px-5 font-semibold text-ink hover:border-harbour hover:text-harbour"
        >
          Make another request
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="relative flex flex-col gap-8">
      <ErrorSummary errors={errors} labels={LABELS} message={message} summaryRef={summaryRef} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-base font-semibold text-ink">{LABELS.type}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {APPOINTMENT_TYPES.map((t) => (
            <label
              key={t}
              className="flex cursor-pointer flex-col gap-1 rounded-2xl border border-line bg-surface p-4 transition-colors has-[:checked]:border-harbour has-[:checked]:bg-mist has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-harbour/25"
            >
              <span className="flex items-center gap-3 font-semibold text-ink">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={values.type === t}
                  onChange={() => set("type")(t)}
                  className="size-5 accent-harbour"
                />
                {APPOINTMENT_TYPE_LABEL[t]}
              </span>
              <span className="pl-8 text-sm text-ink-muted">{APPOINTMENT_TYPE_HELP[t]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="mb-1 font-display text-xl font-semibold text-ink">Your details</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={LABELS.contactName} name="contactName" error={errors.contactName}>
            {(p) => <input {...p} autoComplete="name" className={inputClass} value={values.contactName} onChange={(e) => set("contactName")(e.target.value)} onBlur={blur("contactName")} />}
          </Field>
          <Field label={LABELS.contactPhone} name="contactPhone" error={errors.contactPhone}>
            {(p) => <input {...p} type="tel" inputMode="tel" autoComplete="tel" className={inputClass} value={values.contactPhone} onChange={(e) => set("contactPhone")(e.target.value)} onBlur={blur("contactPhone")} />}
          </Field>
        </div>
        <Field label={LABELS.contactEmail} name="contactEmail" error={errors.contactEmail}>
          {(p) => <input {...p} type="email" inputMode="email" autoComplete="email" className={inputClass} value={values.contactEmail} onChange={(e) => set("contactEmail")(e.target.value)} onBlur={blur("contactEmail")} />}
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="mb-1 font-display text-xl font-semibold text-ink">About your child</legend>
        <div className="grid gap-6 sm:grid-cols-[2fr_1fr]">
          <Field label={LABELS.childName} name="childName" error={errors.childName} optional>
            {(p) => <input {...p} autoComplete="off" className={inputClass} value={values.childName} onChange={(e) => set("childName")(e.target.value)} onBlur={blur("childName")} />}
          </Field>
          <Field label={LABELS.childAgeYears} name="childAgeYears" error={errors.childAgeYears} optional>
            {(p) => <input {...p} type="number" inputMode="numeric" min={0} max={30} step={1} className={inputClass} value={values.childAgeYears} onChange={(e) => set("childAgeYears")(e.target.value)} onBlur={blur("childAgeYears")} />}
          </Field>
        </div>
        <Field label={LABELS.therapySlug} name="therapySlug" error={errors.therapySlug}>
          {(p) => (
            <select {...p} className={inputClass} value={values.therapySlug} onChange={(e) => set("therapySlug")(e.target.value)}>
              <option value="unsure">Not sure yet, please advise</option>
              {THERAPIES.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-6">
        <legend className="mb-1 font-display text-xl font-semibold text-ink">When suits you</legend>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label={LABELS.preferredDate} name="preferredDate" error={errors.preferredDate} optional hint="We will confirm the exact time with you.">
            {(p) => <input {...p} type="date" min={todayLocal()} className={inputClass} value={values.preferredDate} onChange={(e) => set("preferredDate")(e.target.value)} onBlur={blur("preferredDate")} />}
          </Field>
          <Field label={LABELS.preferredTime} name="preferredTime" error={errors.preferredTime}>
            {(p) => (
              <select {...p} className={inputClass} value={values.preferredTime} onChange={(e) => set("preferredTime")(e.target.value)}>
                {PREFERRED_TIMES.map((t) => (
                  <option key={t} value={t}>
                    {PREFERRED_TIME_LABEL[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label={LABELS.message} name="message" error={errors.message} optional hint="For example: sensory needs, a quiet waiting area, or questions you have.">
          {(p) => <textarea {...p} rows={4} maxLength={2000} className={`${inputClass} resize-y`} value={values.message} onChange={(e) => set("message")(e.target.value)} onBlur={blur("message")} />}
        </Field>
      </fieldset>

      <Honeypot value={website} onChange={setWebsite} />
      <div>
        <SubmitButton pending={pending}>Send request</SubmitButton>
      </div>
    </form>
  );
}
