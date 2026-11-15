-- Reference data every environment needs. Idempotent: safe to re-run.
-- Slugs must match content/therapies.ts.
INSERT INTO "therapies" ("slug", "name", "short_name", "summary", "sort_order") VALUES
  ('speech-language-pathology', 'Speech and Language Pathology', 'Speech and Language', 'Support for communication: understanding, expressing needs, social language and, where useful, alternative ways to communicate.', 1),
  ('occupational-therapy', 'Occupational Therapy', 'Occupational', 'Building independence in daily life: sensory regulation, fine motor skills, self-care and play.', 2),
  ('applied-behavior-analysis', 'Applied Behavior Analysis (ABA)', 'ABA', 'Structured, positive support for learning new skills and understanding the reasons behind behaviour.', 3),
  ('physiotherapy', 'Physiotherapy', 'Physiotherapy', 'Movement, strength, balance and coordination, so children can move with confidence.', 4)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
-- The clinic profile row. Contact details stay NULL until the admin enters
-- them in the clinic app (About editor); the website shows a marked placeholder.
INSERT INTO "clinic_profile" ("id", "registered_name") VALUES (1, 'WeCare Autism Academy')
ON CONFLICT ("id") DO NOTHING;
