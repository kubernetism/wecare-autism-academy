import type { TherapySlug } from "./therapies";
import type { LifecycleStage } from "@/db/schema/enums";
import type { TemplateField, TemplateOption, TemplateSchema } from "@/lib/templates/types";

/**
 * Version 1 record templates for the four therapy lines. These are DRAFTS for
 * the clinic's clinicians to review and adapt. They are not clinically
 * validated instruments. Seeded into form_templates by migration 0005
 * (generated with `npm run db:gen-templates`).
 */

const o = (...labels: string[]): TemplateOption[] =>
  labels.map((label) => ({ value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), label }));

const scale5 = (key: string, label: string, anchors: [string, string], required = false): TemplateField => ({
  type: "scale",
  key,
  label,
  min: 1,
  max: 5,
  anchors,
  required,
});

/* ---------- Shared building blocks ---------- */

const historyCommon: TemplateField[] = [
  { type: "select", key: "referral_source", label: "Referral source", required: true, options: o("Parent or guardian", "School", "Paediatrician", "Psychologist or psychiatrist", "Another clinic", "Other") },
  { type: "select", key: "diagnosis_status", label: "Autism diagnosis", required: true, options: o("Diagnosed", "Under assessment", "Suspected, not assessed", "Not autistic") },
  { type: "number", key: "diagnosis_age_years", label: "Age at diagnosis", min: 0, max: 25, unit: "years", integer: true },
  { type: "multiselect", key: "co_occurring", label: "Co-occurring conditions (reported)", options: o("ADHD", "Intellectual disability", "Epilepsy", "Anxiety", "Sleep difficulties", "Feeding difficulties", "Gastrointestinal issues", "Hearing impairment", "Visual impairment", "None known") },
  { type: "select", key: "communication_mode", label: "Main way of communicating", required: true, options: o("Speaks in sentences", "Single words or short phrases", "Gestures or signs", "Pictures or AAC device", "Minimal intentional communication") },
  { type: "multiselect", key: "sensory_sensitivities", label: "Sensory sensitivities", options: o("Sound", "Light", "Touch", "Taste or texture", "Smell", "Movement", "None reported") },
  { type: "select", key: "schooling", label: "Schooling", options: o("Not in school", "Mainstream school", "Mainstream with support", "Special school", "Home schooled") },
  { type: "boolean", key: "takes_medication", label: "Currently takes medication" },
  { type: "text", key: "medication_details", label: "Medication details", maxLength: 300 },
];

const impactScale = scale5("concern_impact", "Impact of concerns on daily life (parent rating)", ["Very little", "Very high"], true);

const planCommon = (approaches: TemplateOption[]): TemplateField[] => [
  { type: "multiselect", key: "approaches", label: "Planned approaches", required: true, options: approaches },
  { type: "number", key: "sessions_per_week", label: "Recommended sessions per week", min: 1, max: 7, integer: true, required: true },
  { type: "select", key: "session_length", label: "Session length", required: true, options: o("30 minutes", "45 minutes", "60 minutes") },
  { type: "number", key: "review_after_weeks", label: "Review the plan after", min: 2, max: 52, unit: "weeks", integer: true, required: true },
  { type: "boolean", key: "home_programme", label: "Home programme provided" },
  { type: "textarea", key: "plan_notes", label: "Plan notes", maxLength: 1500 },
];

const sessionCommon: TemplateField[] = [
  scale5("engagement", "Engagement", ["Not engaged", "Fully engaged"], true),
  scale5("regulation", "Regulation", ["Very dysregulated", "Calm and regulated"], true),
  { type: "select", key: "prompt_level", label: "Highest prompt level needed", options: o("Independent", "Gestural", "Verbal", "Model", "Partial physical", "Full physical") },
  { type: "select", key: "goal_progress", label: "Progress on today's goals", required: true, options: o("Progressing", "Maintained", "Regressed", "Not addressed") },
  { type: "boolean", key: "home_practice_given", label: "Home practice given" },
];

const reviewFields: TemplateField[] = [
  { type: "number", key: "review_period_weeks", label: "Review period", min: 1, max: 104, unit: "weeks", integer: true, required: true },
  { type: "select", key: "overall_progress", label: "Overall progress", required: true, options: o("Significant", "Some", "Minimal", "None", "Regression") },
  { type: "number", key: "goals_achieved", label: "Goals achieved", min: 0, max: 50, integer: true },
  { type: "number", key: "goals_in_progress", label: "Goals in progress", min: 0, max: 50, integer: true },
  scale5("parent_satisfaction", "Parent-reported satisfaction", ["Very unsatisfied", "Very satisfied"]),
  { type: "select", key: "recommendation", label: "Recommendation", required: true, options: o("Continue the same plan", "Increase intensity", "Reduce intensity", "Add another therapy", "Plan discharge") },
  { type: "textarea", key: "review_summary", label: "Summary", maxLength: 2000 },
];

const dischargeFields: TemplateField[] = [
  { type: "select", key: "discharge_reason", label: "Reason", required: true, options: o("Goals met", "Family request", "Moved away", "Transferred to another service", "Low attendance", "Upgraded to another programme") },
  { type: "select", key: "goal_outcome", label: "Goal outcome", required: true, options: o("Fully met", "Partly met", "Not met") },
  { type: "boolean", key: "home_programme_given", label: "Home programme given" },
  { type: "select", key: "follow_up", label: "Follow-up", options: o("None", "After 3 months", "After 6 months") },
  { type: "multiselect", key: "referrals", label: "Referrals made", options: o("Speech and language", "Occupational therapy", "ABA", "Physiotherapy", "Psychology", "Paediatrician", "None") },
  { type: "textarea", key: "discharge_summary", label: "Summary", maxLength: 2000 },
];

/* ---------- Per-line fields ---------- */

type LineFields = {
  concerns: TemplateOption[];
  historyExtra: TemplateField[];
  assessment: TemplateField[];
  approaches: TemplateOption[];
  sessionExtra: TemplateField[];
};

const LINES: Record<TherapySlug, LineFields> = {
  "speech-language-pathology": {
    concerns: o("Understanding language", "Expressive language", "Speech sounds", "Social communication", "Fluency", "Voice", "Feeding or swallowing"),
    historyExtra: [
      { type: "number", key: "first_words_months", label: "Age of first words", min: 0, max: 120, unit: "months", integer: true },
      { type: "select", key: "hearing_test", label: "Hearing test", options: o("Normal result", "Concern found", "Not done", "Unknown") },
    ],
    assessment: [
      { type: "multiselect", key: "tools", label: "Assessment tools used", required: true, options: o("CELF-5", "PLS-5", "GFTA-3", "Language sample", "Informal observation") },
      scale5("receptive_level", "Receptive language", ["Severe difficulty", "Age appropriate"], true),
      scale5("expressive_level", "Expressive language", ["Severe difficulty", "Age appropriate"], true),
      { type: "select", key: "intelligibility", label: "Speech intelligibility to unfamiliar listeners", required: true, options: o("Under 25 percent", "25 to 50 percent", "50 to 75 percent", "Over 75 percent", "Not applicable (non-speaking)") },
      scale5("social_communication", "Social communication", ["Severe difficulty", "Age appropriate"]),
      { type: "boolean", key: "aac_recommended", label: "AAC recommended" },
      { type: "textarea", key: "assessment_summary", label: "Summary", maxLength: 2000 },
    ],
    approaches: o("Play-based language therapy", "PECS", "AAC device training", "Articulation therapy", "Social communication group", "Parent coaching"),
    sessionExtra: [
      { type: "multiselect", key: "targets", label: "Targets worked on", options: o("Requesting", "Labelling", "Following directions", "Turn-taking", "Speech sounds", "Conversation", "AAC use") },
      { type: "number", key: "target_accuracy", label: "Accuracy on main target", min: 0, max: 100, unit: "%", integer: true },
    ],
  },
  "occupational-therapy": {
    concerns: o("Sensory processing", "Fine motor skills", "Self-care", "Handwriting", "Play skills", "Attention and regulation"),
    historyExtra: [{ type: "select", key: "hand_preference", label: "Hand preference", options: o("Right", "Left", "Not yet established") }],
    assessment: [
      { type: "multiselect", key: "tools", label: "Assessment tools used", required: true, options: o("Sensory Profile 2", "BOT-2", "Beery VMI", "PEDI-CAT", "Clinical observation") },
      { type: "select", key: "sensory_pattern", label: "Main sensory pattern", required: true, options: o("Seeking", "Avoiding", "Sensitivity", "Low registration", "Typical") },
      scale5("fine_motor", "Fine motor skills", ["Severe difficulty", "Age appropriate"], true),
      scale5("dressing", "Dressing independence", ["Fully dependent", "Independent"]),
      scale5("feeding", "Feeding independence", ["Fully dependent", "Independent"]),
      scale5("toileting", "Toileting independence", ["Fully dependent", "Independent"]),
      { type: "textarea", key: "assessment_summary", label: "Summary", maxLength: 2000 },
    ],
    approaches: o("Sensory integration", "Fine motor practice", "Self-care routines", "Visual schedules", "Handwriting programme", "Parent coaching"),
    sessionExtra: [
      { type: "multiselect", key: "targets", label: "Areas worked on", options: o("Sensory regulation", "Grasp and manipulation", "Dressing", "Feeding", "Handwriting", "Play") },
      { type: "select", key: "task_completion", label: "Task completion", options: o("Completed independently", "Completed with support", "Partly completed", "Not completed") },
    ],
  },
  "applied-behavior-analysis": {
    concerns: o("Communication skills", "Social skills", "Daily living skills", "Behaviours that cause harm", "Behaviours that cause distress", "Difficulty with transitions", "Learning readiness"),
    historyExtra: [
      { type: "multiselect", key: "behaviours_of_concern", label: "Behaviours of concern", options: o("Self-injury", "Aggression", "Leaving safe areas", "Property damage", "Long meltdowns", "None reported") },
      scale5("behaviour_frequency", "How often behaviours of concern happen", ["Rarely", "Many times a day"]),
    ],
    assessment: [
      { type: "multiselect", key: "tools", label: "Assessment tools used", required: true, options: o("VB-MAPP", "ABLLS-R", "Functional behaviour assessment", "Vineland-3", "Direct observation") },
      { type: "multiselect", key: "behaviour_functions", label: "Likely functions of behaviour", options: o("Attention", "Escape or avoidance", "Access to items", "Sensory") },
      { type: "number", key: "baseline_rate_per_hour", label: "Baseline rate of main behaviour", min: 0, max: 500, unit: "per hour" },
      { type: "select", key: "vbmapp_level", label: "VB-MAPP milestone level", options: o("Level 1", "Level 2", "Level 3", "Not assessed") },
      { type: "multiselect", key: "priority_domains", label: "Priority skill domains", required: true, options: o("Requesting", "Labelling", "Listener responding", "Social play", "Daily living", "Learning readiness") },
      { type: "textarea", key: "assessment_summary", label: "Summary", maxLength: 2000 },
    ],
    approaches: o("Discrete trial teaching", "Natural environment teaching", "Pivotal response treatment", "Functional communication training", "Positive behaviour support plan", "Parent training"),
    sessionExtra: [
      { type: "number", key: "trials_correct", label: "Trials correct", min: 0, max: 500, integer: true },
      { type: "number", key: "trials_total", label: "Trials total", min: 0, max: 500, integer: true },
      { type: "number", key: "behaviour_count", label: "Behaviours of concern observed", min: 0, max: 500, integer: true },
    ],
  },
  physiotherapy: {
    concerns: o("Walking pattern", "Balance", "Coordination", "Strength", "Low muscle tone", "High muscle tone", "Posture", "Pain"),
    historyExtra: [
      { type: "select", key: "mobility", label: "Current mobility", required: true, options: o("Walks independently", "Walks with an aid", "Uses a wheelchair", "Crawls", "Not yet mobile") },
      { type: "select", key: "motor_milestones", label: "Motor milestones", options: o("On time", "Mildly delayed", "Significantly delayed", "Unknown") },
    ],
    assessment: [
      { type: "multiselect", key: "tools", label: "Assessment tools used", required: true, options: o("GMFM-88", "PDMS-2", "BOT-2", "Goniometry", "Clinical observation") },
      { type: "select", key: "gmfcs_level", label: "GMFCS level", options: o("Level I", "Level II", "Level III", "Level IV", "Level V", "Not applicable") },
      { type: "select", key: "muscle_tone", label: "Muscle tone", required: true, options: o("Typical", "Low", "High", "Mixed") },
      { type: "number", key: "single_leg_stance_seconds", label: "Single-leg stance (best side)", min: 0, max: 120, unit: "seconds" },
      { type: "multiselect", key: "rom_concerns", label: "Range of movement concerns", options: o("Hip", "Knee", "Ankle", "Shoulder", "Trunk", "None") },
      scale5("endurance", "Endurance", ["Very low", "Age appropriate"]),
      { type: "textarea", key: "assessment_summary", label: "Summary", maxLength: 2000 },
    ],
    approaches: o("Strength training", "Balance training", "Gait training", "Stretching programme", "Coordination games", "Orthotics or equipment"),
    sessionExtra: [
      { type: "multiselect", key: "targets", label: "Areas worked on", options: o("Strength", "Balance", "Gait", "Range of movement", "Coordination", "Endurance") },
      { type: "number", key: "pain_score", label: "Pain score", min: 0, max: 10, integer: true, help: "0 means no pain." },
    ],
  },
};

const STAGE_TITLE: Record<LifecycleStage, string> = {
  intake: "History and symptoms",
  assessment: "Assessment",
  plan: "Treatment plan and goals",
  session_note: "Session note",
  progress_review: "Progress review",
  discharge: "Discharge",
};

function build(slug: TherapySlug, stage: LifecycleStage): TemplateSchema {
  const line = LINES[slug];
  switch (stage) {
    case "intake":
      return {
        sections: [
          { key: "background", title: "Background", fields: historyCommon },
          {
            key: "concerns",
            title: "Presenting concerns",
            fields: [
              { type: "multiselect", key: "primary_concerns", label: "Main concerns", required: true, options: line.concerns },
              impactScale,
              ...line.historyExtra,
              { type: "textarea", key: "parent_goals", label: "What the family hopes to achieve", maxLength: 1000 },
            ],
          },
        ],
      };
    case "assessment":
      return { sections: [{ key: "assessment", title: "Assessment", fields: line.assessment }] };
    case "plan":
      return { sections: [{ key: "plan", title: "Treatment plan", fields: planCommon(line.approaches) }] };
    case "session_note":
      return {
        sections: [
          { key: "session", title: "This session", fields: [...line.sessionExtra, ...sessionCommon] },
          { key: "notes", title: "Notes", fields: [{ type: "textarea", key: "session_notes", label: "Session notes", maxLength: 2000 }] },
        ],
      };
    case "progress_review":
      return { sections: [{ key: "review", title: "Progress review", fields: reviewFields }] };
    case "discharge":
      return { sections: [{ key: "discharge", title: "Discharge", fields: dischargeFields }] };
  }
}

export type SeedTemplate = { slug: TherapySlug; stage: LifecycleStage; version: number; title: string; schema: TemplateSchema };

export const SEED_TEMPLATES: SeedTemplate[] = (Object.keys(LINES) as TherapySlug[]).flatMap((slug) =>
  (Object.keys(STAGE_TITLE) as LifecycleStage[]).map((stage) => ({
    slug,
    stage,
    version: 1,
    title: STAGE_TITLE[stage],
    schema: build(slug, stage),
  })),
);

export { STAGE_TITLE };
