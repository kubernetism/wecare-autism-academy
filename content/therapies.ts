/**
 * Public website copy for the four therapy lines. The slugs match the rows
 * seeded into `therapies` by migration 0001; forms post the slug and the
 * server resolves it to the therapy id.
 *
 * Copy describes each discipline in general terms. It makes no claims about
 * specific staff, outcomes or numbers.
 */

export const LIFECYCLE_STAGES = [
  {
    key: "intake",
    title: "Referral and intake",
    description:
      "We meet you, listen to your concerns and collect the history we need: development, health, school and daily routines.",
  },
  {
    key: "assessment",
    title: "Assessment",
    description:
      "A therapist observes and assesses your child with structured tools, so the plan starts from a clear picture of strengths and needs.",
  },
  {
    key: "plan",
    title: "Treatment plan and goals",
    description:
      "Together we agree on a small set of meaningful goals, how often sessions happen and how progress will be measured.",
  },
  {
    key: "sessions",
    title: "Sessions",
    description:
      "Regular sessions work towards the goals. Each session is recorded in a structured way so nothing is lost between visits.",
  },
  {
    key: "review",
    title: "Progress review",
    description:
      "At set points we review progress with you, share a report card and adjust the goals or the plan where needed.",
  },
  {
    key: "outcome",
    title: "Discharge or upgrade",
    description:
      "When goals are met your child is discharged with a home plan, or moves up to the next level of support.",
  },
] as const;

export type LifecycleStageKey = (typeof LIFECYCLE_STAGES)[number]["key"];

export type TherapyContent = {
  slug: string;
  name: string;
  shortName: string;
  summary: string;
  intro: string;
  helpsWith: readonly string[];
  /** What each lifecycle stage looks like in this discipline. */
  stageNotes: Readonly<Record<LifecycleStageKey, string>>;
};

export const THERAPIES = [
  {
    slug: "speech-language-pathology",
    name: "Speech and Language Pathology",
    shortName: "Speech and Language",
    summary:
      "Support for communication: understanding, expressing needs, social language and, where useful, alternative ways to communicate.",
    intro:
      "Speech and language therapy helps children understand others and be understood, in whatever form of communication works best for them.",
    helpsWith: [
      "Understanding and using words and sentences",
      "Social communication and turn-taking",
      "Speech sound clarity",
      "Alternative and augmentative communication (AAC)",
      "Feeding and swallowing concerns, where relevant",
    ],
    stageNotes: {
      intake:
        "We ask how your child communicates today at home and at school, and what you would most like to change.",
      assessment:
        "The therapist looks at understanding, expression, speech sounds and social communication through play and structured tasks.",
      plan: "Goals are practical, for example asking for help or following a two-step instruction, with a clear way to measure them.",
      sessions:
        "Play-based sessions practise the target skills, with simple activities you can repeat at home.",
      review:
        "We compare progress against the baseline and update the goals with you.",
      outcome:
        "Your child is discharged with a home communication plan, or continues with new goals.",
    },
  },
  {
    slug: "occupational-therapy",
    name: "Occupational Therapy",
    shortName: "Occupational",
    summary:
      "Building independence in daily life: sensory regulation, fine motor skills, self-care and play.",
    intro:
      "Occupational therapy helps children take part in everyday life with more comfort and independence, from getting dressed to joining in at school.",
    helpsWith: [
      "Sensory processing and self-regulation",
      "Fine motor skills such as grasp and handwriting",
      "Self-care routines: dressing, eating, toileting",
      "Play skills and attention",
      "Motor planning and coordination",
    ],
    stageNotes: {
      intake:
        "We talk through daily routines and the moments that are hardest for your child and family.",
      assessment:
        "The therapist assesses sensory preferences, motor skills and self-care using observation and standard tools.",
      plan: "Goals focus on daily activities that matter to you, with sensory strategies to support them.",
      sessions:
        "Sessions use purposeful play and practice, often in a sensory-friendly room.",
      review:
        "We review progress on daily skills and adjust strategies for home and school.",
      outcome:
        "Discharge comes with a home and school strategy plan, or the plan steps up to new goals.",
    },
  },
  {
    slug: "applied-behavior-analysis",
    name: "Applied Behavior Analysis (ABA)",
    shortName: "ABA",
    summary:
      "Structured, positive support for learning new skills and understanding the reasons behind behaviour.",
    intro:
      "ABA uses careful observation and positive reinforcement to help children learn skills that matter to them and their family.",
    helpsWith: [
      "Communication and social skills",
      "Daily living and independence skills",
      "Understanding and reducing behaviours that cause harm or distress",
      "Learning readiness and attention",
      "Generalising skills to home and school",
    ],
    stageNotes: {
      intake:
        "We learn about your child's interests, routines and the priorities you have for them.",
      assessment:
        "The therapist observes skills and behaviour, and looks at what happens before and after behaviours of concern.",
      plan: "Behaviour targets and skill goals are written in clear, measurable terms and agreed with you.",
      sessions:
        "Sessions teach skills in small steps, with data recorded each time so progress is visible.",
      review:
        "Data is reviewed regularly; targets are updated as skills are mastered.",
      outcome:
        "Skills are handed over to home and school routines at discharge, or new targets are set.",
    },
  },
  {
    slug: "physiotherapy",
    name: "Physiotherapy",
    shortName: "Physiotherapy",
    summary:
      "Movement, strength, balance and coordination, so children can move with confidence.",
    intro:
      "Physiotherapy supports gross motor development: how children move, balance and use their bodies in play and daily life.",
    helpsWith: [
      "Gross motor skills: walking, running, jumping",
      "Balance and coordination",
      "Muscle tone, strength and posture",
      "Range of movement",
      "Confidence in physical play",
    ],
    stageNotes: {
      intake:
        "We ask about motor milestones, health history and the movements your child finds difficult.",
      assessment:
        "The therapist measures strength, balance, posture and range of movement.",
      plan: "Goals target specific movements, with measures such as range of movement or balance time.",
      sessions:
        "Sessions use guided exercise and active play, with a simple home programme.",
      review:
        "Measurements are repeated and compared with the starting point.",
      outcome:
        "Discharge includes a home exercise programme, or the plan moves to the next level.",
    },
  },
] as const satisfies readonly TherapyContent[];

export type TherapySlug = (typeof THERAPIES)[number]["slug"];

export const THERAPY_SLUGS = THERAPIES.map((t) => t.slug) as [
  TherapySlug,
  ...TherapySlug[],
];

export function getTherapyContent(slug: string): TherapyContent | undefined {
  return THERAPIES.find((t) => t.slug === slug);
}
