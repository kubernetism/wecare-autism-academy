CREATE TYPE "public"."admission_kind" AS ENUM('admit', 'readmit', 'cancel', 'upgrade', 'discharge');--> statement-breakpoint
CREATE TYPE "public"."amendable_record" AS ENUM('therapy_session', 'clinical_record');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'on_hold', 'completed', 'discharged', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('not_started', 'in_progress', 'achieved', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_stage" AS ENUM('intake', 'assessment', 'plan', 'session_note', 'progress_review', 'discharge');--> statement-breakpoint
CREATE TYPE "public"."patient_attendance" AS ENUM('present', 'absent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('active', 'cancelled', 'discharged');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('empty', 'draft', 'signed');--> statement-breakpoint
CREATE TYPE "public"."session_outcome" AS ENUM('progressing', 'maintained', 'regressed', 'not_assessed');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'completed', 'missed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('female', 'male', 'other', 'not_stated');--> statement-breakpoint
CREATE TYPE "public"."staff_attendance" AS ENUM('present', 'absent', 'leave');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('draft', 'approved', 'retired');--> statement-breakpoint
CREATE TABLE "admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" "admission_kind" NOT NULL,
	"effective_on" date NOT NULL,
	"reason" text,
	"enrollment_id" uuid,
	"details" jsonb,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_patient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" "patient_attendance" NOT NULL,
	"reason" text,
	"marked_by_user_id" text,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_patient_sessionId_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_profile_id" uuid NOT NULL,
	"day" date NOT NULL,
	"status" "staff_attendance" NOT NULL,
	"check_in_at" timestamp with time zone,
	"check_out_at" timestamp with time zone,
	"note" text,
	"marked_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_staff_times_check" CHECK ("attendance_staff"."check_out_at" is null or "attendance_staff"."check_in_at" is null or "attendance_staff"."check_out_at" >= "attendance_staff"."check_in_at")
);
--> statement-breakpoint
CREATE TABLE "clinical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"stage" "lifecycle_stage" NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version" smallint NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"author_staff_id" uuid,
	"signed_at" timestamp with time zone,
	"signed_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"therapy_id" uuid NOT NULL,
	"lead_staff_id" uuid,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"planned_sessions" smallint NOT NULL,
	"sessions_per_week" smallint NOT NULL,
	"session_minutes" smallint NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_plan_check" CHECK ("enrollments"."planned_sessions" between 1 and 500 and "enrollments"."sessions_per_week" between 1 and 14 and "enrollments"."session_minutes" between 15 and 240)
);
--> statement-breakpoint
CREATE TABLE "form_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapy_id" uuid NOT NULL,
	"stage" "lifecycle_stage" NOT NULL,
	"version" smallint NOT NULL,
	"title" text NOT NULL,
	"schema" jsonb NOT NULL,
	"status" "template_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"title" text NOT NULL,
	"baseline" text,
	"target" text,
	"measure" text,
	"status" "goal_status" DEFAULT 'not_started' NOT NULL,
	"target_date" date,
	"created_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medical_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"description" text,
	"uploaded_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medical_files_storageKey_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "patient_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"staff_profile_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by_user_id" text,
	"unassigned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"date_of_birth" date NOT NULL,
	"sex" "sex" DEFAULT 'not_stated' NOT NULL,
	"diagnosis_summary" text,
	"guardian_name" text NOT NULL,
	"guardian_relationship" text NOT NULL,
	"guardian_phone" text NOT NULL,
	"guardian_email" text,
	"address" text,
	"notes" text,
	"status" "patient_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "patients_trackingId_unique" UNIQUE("tracking_id"),
	CONSTRAINT "patients_tracking_id_format" CHECK ("patients"."tracking_id" ~ '^WCA-[0-9]{4}-[0-9]{4,}$')
);
--> statement-breakpoint
CREATE TABLE "record_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_type" "amendable_record" NOT NULL,
	"record_id" uuid NOT NULL,
	"version" smallint NOT NULL,
	"snapshot" jsonb NOT NULL,
	"reason" text NOT NULL,
	"amended_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "therapy_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"staff_profile_id" uuid NOT NULL,
	"scheduled_start" timestamp with time zone NOT NULL,
	"scheduled_end" timestamp with time zone NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"record_status" "record_status" DEFAULT 'empty' NOT NULL,
	"template_refs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"history_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"assessment_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"note_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"doctor_note" text,
	"outcome" "session_outcome",
	"signed_at" timestamp with time zone,
	"signed_by_user_id" text,
	"created_by_user_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "therapy_sessions_order_check" CHECK ("therapy_sessions"."scheduled_end" > "therapy_sessions"."scheduled_start")
);
--> statement-breakpoint
CREATE TABLE "tracking_counters" (
	"year" smallint PRIMARY KEY NOT NULL,
	"last_value" integer NOT NULL
);
--> statement-breakpoint
DROP INDEX "staff_profiles_public_idx";--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "joined_on" date;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_patient" ADD CONSTRAINT "attendance_patient_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_patient" ADD CONSTRAINT "attendance_patient_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_patient" ADD CONSTRAINT "attendance_patient_marked_by_user_id_users_id_fk" FOREIGN KEY ("marked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_staff" ADD CONSTRAINT "attendance_staff_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_staff" ADD CONSTRAINT "attendance_staff_marked_by_user_id_users_id_fk" FOREIGN KEY ("marked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_template_id_form_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."form_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_author_staff_id_staff_profiles_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_therapy_id_therapies_id_fk" FOREIGN KEY ("therapy_id") REFERENCES "public"."therapies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_lead_staff_id_staff_profiles_id_fk" FOREIGN KEY ("lead_staff_id") REFERENCES "public"."staff_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_templates" ADD CONSTRAINT "form_templates_therapy_id_therapies_id_fk" FOREIGN KEY ("therapy_id") REFERENCES "public"."therapies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_files" ADD CONSTRAINT "medical_files_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medical_files" ADD CONSTRAINT "medical_files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_staff" ADD CONSTRAINT "patient_staff_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_staff" ADD CONSTRAINT "patient_staff_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_staff" ADD CONSTRAINT "patient_staff_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "record_amendments" ADD CONSTRAINT "record_amendments_amended_by_user_id_users_id_fk" FOREIGN KEY ("amended_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admissions_patient_idx" ON "admissions" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_staff_day_unique" ON "attendance_staff" USING btree ("staff_profile_id","day");--> statement-breakpoint
CREATE INDEX "clinical_records_enrollment_idx" ON "clinical_records" USING btree ("enrollment_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_open_unique" ON "enrollments" USING btree ("patient_id","therapy_id") WHERE "enrollments"."status" in ('active', 'on_hold');--> statement-breakpoint
CREATE INDEX "enrollments_patient_idx" ON "enrollments" USING btree ("patient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "form_templates_version_unique" ON "form_templates" USING btree ("therapy_id","stage","version");--> statement-breakpoint
CREATE INDEX "goals_enrollment_idx" ON "goals" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "medical_files_patient_idx" ON "medical_files" USING btree ("patient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_staff_open_unique" ON "patient_staff" USING btree ("patient_id","staff_profile_id") WHERE "patient_staff"."unassigned_at" is null;--> statement-breakpoint
CREATE INDEX "patient_staff_staff_idx" ON "patient_staff" USING btree ("staff_profile_id") WHERE "patient_staff"."unassigned_at" is null;--> statement-breakpoint
CREATE INDEX "patients_status_idx" ON "patients" USING btree ("status","last_name");--> statement-breakpoint
CREATE INDEX "patients_name_trgm_idx" ON "patients" USING gin (("first_name" || ' ' || "last_name") gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "record_amendments_version_unique" ON "record_amendments" USING btree ("record_type","record_id","version");--> statement-breakpoint
CREATE INDEX "therapy_sessions_staff_start_idx" ON "therapy_sessions" USING btree ("staff_profile_id","scheduled_start");--> statement-breakpoint
CREATE INDEX "therapy_sessions_patient_start_idx" ON "therapy_sessions" USING btree ("patient_id","scheduled_start");--> statement-breakpoint
CREATE INDEX "therapy_sessions_enrollment_idx" ON "therapy_sessions" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "staff_profiles_team_idx" ON "staff_profiles" USING btree ("full_name") WHERE "staff_profiles"."is_verified" and "staff_profiles"."archived_at" is null and "staff_profiles"."staff_type" <> 'labour';