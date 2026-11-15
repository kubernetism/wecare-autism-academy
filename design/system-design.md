# WeCare Autism Academy — System Design & UX Plan

## Context

WeCare Autism Academy (4 therapy lines, 18 verified staff) needs two things from one product:

1. A responsive public **website** (marketing, appointments, blog, contact, parent portal).
2. A **clinic application** used on site by the Administrator/Owner and by staff/doctors to run operations and keep treatment records.

The differentiator is that every treatment is recorded in a structured way, so a doctor can run a **RAG query** that finds similar past cases, returns a compact summary, and stores the doctor's endorsement or correction note for future retrievals.

The repo is a fresh `create-next-app` (Next 16.4.6, React 19.3, Tailwind 4.3, no DB/auth yet) plus two references in `design/`: a landing page still (website) and a clinic dashboard video (calendar + stepper wizard).

### Decisions already made
| Topic | Decision |
|---|---|
| Clinic app form | Same Next.js codebase, login-protected `/app`, installable PWA |
| Parent access | Full parent accounts (third user type) |
| Language | English only |
| RAG privacy | De-identified data only to cloud AI; vectors in our own Postgres |
| Design | **Web application (clinic app and parent portal): stock Ant Design (`antd`)** with its default layout, default components and default CSS, no custom theme. **Public website: an original WeCare design without Ant Design**, built with Tailwind. The files in `design/` are ideas only and are not to be copied |
| Payments | Record-keeping only (parents may upload payment proof) |
| Attendance | Patients (per session) + all staff incl. labour (daily) |
| Delivery | Phased releases |

### Assumptions to confirm (cheap to change)
- Currency is a clinic setting (single currency, set in About/Settings).
- Doctors see and edit **only patients assigned to them**; no delete; no finance, staff, or settings access.
- Labour staff (maid, cook…) are records for attendance/payroll only, with no login.
- Hosting on Vercel + Neon Postgres (matches the installed tooling).

---

## 1. Architecture

```
Browser (public / parent / staff PWA)
        │
Next.js 16 App Router on Vercel
 ├─ (site)    /            public website      Tailwind, original design, server-rendered, SEO
 ├─ (portal)  /portal      parent portal       Ant Design defaults, auth: parent
 ├─ (clinic)  /app         clinic application  Ant Design defaults, auth: admin | staff
 └─ server layer: Server Actions + route handlers → services → Drizzle
        │
 ├─ Neon Postgres (+ pgvector)   relational data, vectors, audit log
 ├─ Private object storage       medical files (image/PDF/DOCX), signed URLs
 ├─ Email (OTP, invoices, notifications)
 └─ AI: embedding model + Claude (summaries), de-identified input only
```

- **One codebase, three route groups**, each with its own layout. The clinic app and parent portal use **Ant Design exactly as it ships**: default theme (no token overrides), the standard `Layout` / `Sider` / `Header` / `Content` admin layout, and stock components (tables, forms, cards, statistics, steps, calendar, drawers, modals, tags). No custom CSS restyles antd components. The public website does not load Ant Design at all; it is built with Tailwind and plain React.
- **Stack**: Drizzle ORM, Better Auth (email+password, roles `admin` / `staff` / `parent`, admin-created staff accounts, parent sign-up bound to a tracking ID + verified phone/email), Zod validation shared by forms and server.
- **Authorization lives in the service layer**, not in the UI: every query goes through a `can(user, action, resource)` check plus a patient-assignment scope for staff. Route protection in the Next 16 proxy/middleware file is only a first gate.
- **Audit log** on every create/update/delete of patient, clinical and finance data (who, when, before/after). Clinical records are soft-deleted only.
- **Next 16 caveat** (`AGENTS.md`): read `node_modules/next/dist/docs/` before coding; do not assume older conventions.
- **Ant Design setup**: `npm install antd --save`, `@ant-design/nextjs-registry` for App Router SSR, `@ant-design/icons`. The registry and `ConfigProvider` live only in the clinic and portal layouts, so no antd code or CSS ships to public pages.

## 2. Roles and permissions

| Area | Admin/Owner | Staff/Doctor | Parent |
|---|---|---|---|
| Dashboard | Full clinic KPIs | Own day: sessions, assigned patients | Own children |
| Patients & records | Full CRUD | Read/Add/Edit assigned, no delete | Read own child: status, prescriptions, report cards |
| Therapy sessions, RAG | All | Own patients | — |
| Events | CRUD, assign/remove staff | View assigned | Public events only |
| Staff, Users & Roles | CRUD | Own profile | — |
| Finance | Full | — | Own invoices/receipts, upload proof |
| Appointments | Manage all | View own | Request / track |
| Attendance | All | Mark own sessions, own check-in | View child's |
| Blog, About, Inbox, Settings | Full | — | Read public / send messages |

## 3. Data model (Postgres)

- **Identity**: `users`, `sessions`, `staff_profiles` (role type doctor/specialist/labour, expertise, experience, verified flag, therapy lines), `parents`, `parent_children`.
- **Patients**: `patients` (tracking ID `WCA-YYYY-NNNN`, demographics, guardian, status), `admissions` (admit / cancel / upgrade history), `patient_staff` (assignments), `medical_files` (storage key, type, uploader).
- **Clinical**: `therapies` (the 4 lines), `form_templates` (versioned JSON schema per therapy and lifecycle stage), `enrollments` (patient × therapy, plan, total vs completed sessions), `assessments`, `goals`, `therapy_sessions` (structured answers + notes + outcome), `prescriptions`, `report_cards`.
- **Operations**: `appointments` (type: appointment / demo session / introduction; status), `events` + `event_staff` (agenda, workflow, therapy, date/time), `attendance_patient`, `attendance_staff`.
- **Finance**: `accounts`, `invoices` + `invoice_items`, `payments` (fee submissions, proof file), `bills`, `expenses`.
- **Content & comms**: `blog_posts` + `blog_categories` (full-text search), `messages` (contact inbox + parent threads), `clinic_profile` (name, address, contact, courses, sessions, recommended books/sources).
- **RAG**: `case_documents` (de-identified text + structured facets), `case_embeddings` (pgvector, HNSW index), `rag_queries` (inputs, retrieved case IDs, generated summary, model version), `rag_feedback` (doctor note, type: endorse / correct).
- **Cross-cutting**: `audit_log`.

**Therapy life cycle** (same stages for Speech & Language, Occupational, ABA, Physiotherapy; fields differ per `form_templates`):
Referral/Intake → Assessment → Treatment plan & goals → Sessions → Progress review / report card → Discharge or Upgrade.
Template-driven forms are what make records systematic enough for RAG while letting each therapy keep its own vocabulary (e.g. ABA behaviour targets vs physiotherapy range-of-motion measures).

## 4. RAG clinical assistant

**Ingest (on record save, background job)**
1. Build a case document from structured fields: age band, sex, diagnosis, symptoms, therapy line, goals, interventions, outcomes over time.
2. De-identify: drop name, tracking ID, guardian, contacts, address, exact dates (keep age band and relative timing); scrub free-text notes with pattern + model-assisted redaction.
3. Chunk by lifecycle stage, embed, store in `case_embeddings` with facets as filter columns.

**Query (doctor clicks "Find similar cases" after completing the history/symptom forms)**
1. Current patient's forms → de-identified query text.
2. Hybrid retrieval: facet filter (therapy line, age band) + vector similarity + keyword match, excluding the current patient; top cases re-ranked.
3. Claude writes a compact summary: common presentations, interventions that were used, observed outcomes, cautions, each statement citing the internal case reference.
4. UI shows summary + expandable source cases (still de-identified) + a clear "decision support, not a diagnosis" label.

**Feedback loop**
- Doctor must add a note before closing: **Endorse** or **Correct** with free text. Saved to `rag_feedback`, linked to the query and the patient record.
- Feedback is embedded too; corrections are retrieved with their source cases and passed to the model as authoritative overrides in later queries.
- Guardrails: only assigned-patient context, no identities in prompts, every query logged in `rag_queries`, graceful "not enough similar cases yet" state for the cold-start period.

## 5. UX design

### Public website (Tailwind, original design, no Ant Design)
- An original layout and identity for WeCare, designed with the `frontend-design` and `design-taste-frontend` skills. The reference images in `design/` show the level of polish wanted and are not copied. No invented facts (ratings, reviews, testimonials).
- Original WeCare identity: calm, low-stimulation palette (soft sage/teal with a warm accent, no pure-saturated colours), generous spacing, large readable type, original imagery, reduced-motion support, WCAG AA contrast.
- Pages: Home, Therapies (one per line with lifecycle explained), Team (18 verified staff), Events, Blog (categories, date, title/word search), About (courses, sessions, recommended books and sources), Contact, Book (appointment / demo session / introduction), Parent login.
- Mobile first: sticky "Book" button, one-column forms, tap targets ≥ 44px.

### Parent portal (`/portal`, Ant Design defaults)
Children list → child page with treatment timeline (completed vs remaining sessions), status, prescriptions, report cards, attendance, invoices/receipts with proof upload, and messages to the clinic.

### Clinic app (`/app`, Ant Design defaults; the dashboard video is an idea for flows, not a look to copy)
- Shell: collapsible left sidebar grouped as Clinic / Finance / Content / Settings, top bar with global patient search (name or tracking ID), date-time, inbox badge, profile. Sidebar becomes a drawer on mobile; tables switch to card lists.
- **Admin dashboard**: stat tiles (patients, active therapies, staff, events total/active, expenses, pending invoices, new messages), today's schedule, recent admissions.
- **Appointments**: day/week calendar with one column per therapist (as in the reference), request queue for appointment / demo / introduction with approve-and-schedule.
- **Patients**: searchable table → patient workspace with tabs: Overview, Treatment (progress per enrollment), Sessions, Files, Prescriptions, Reports, Finance, Audit. Actions: Admit, Cancel, Upgrade, Fee submission, Add medical record.
- **Session record wizard** (stepper drawer like the reference): History & symptoms → Assessment → Plan/Session notes → Similar cases (RAG) → Doctor note & sign-off.
- **Staff**: profile, expertise, experience, assigned patients/events, completed-events count, attendance.
- **Events, Finance, Attendance, Blog, Inbox, About, Users & Roles**: standard antd table + form drawer pattern, built once and reused.
- The app and portal keep the default Ant Design look on purpose; the WeCare brand lives on the public website.

## 6. Delivery phases

1. **Foundation + website**: brand tokens, DB, auth and roles, app shell, public pages, appointment/demo/introduction requests, contact inbox, About content.
2. **Clinical core**: staff, patients (admit/cancel/upgrade, files), therapies and templates, enrollments, session wizard, treatment progress view, both attendance types, calendar.
3. **Operations**: finance (accounts, invoices, bills, expenses, fee submissions), events, parent portal, blog, admin dashboard KPIs.
4. **RAG assistant**: de-identification pipeline, embeddings, retrieval, summary UI, feedback loop, backfill of existing records.

## 7. How the work is executed

- Per the global instructions, all code changes go to the `lead-software-engineer` subagent, with `lead-product-designer` owning the brand/design-system decisions (palette, typography, antd theme tokens) at the start of Phase 1.
- Commits, pushes, deploys and production database changes only after explicit approval.
- First files touched: `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (restructured into `app/(site)`, `app/(portal)`, `app/(clinic)/app`), plus new `db/` (schema, migrations), `lib/auth`, `lib/permissions`, `lib/rag`.

## 8. Verification

- **Per phase**: `npm run lint`, `npm run build`, unit tests for the permission matrix and service layer, and a browser pass of each flow at phone (375px), tablet and desktop widths.
- **Permissions**: log in as admin, doctor and parent; confirm a doctor cannot open an unassigned patient, cannot delete, cannot reach finance; confirm a parent sees only their own child.
- **Clinical flow**: admit a patient → enroll in a therapy → record sessions → progress view shows remaining vs completed → parent portal shows status, prescription and report card.
- **RAG**: seed synthetic cases, run a query, check retrieved cases are relevant and exclude the current patient, inspect the outgoing prompt to confirm no identifying fields, save an endorse and a correct note, re-run and confirm the correction influences the summary.
- **Accessibility/performance**: keyboard pass, contrast check, Lighthouse on the public pages.
