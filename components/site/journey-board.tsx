import { CalendarCheck, ClipboardText, ListChecks, Notebook, Path, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { LIFECYCLE_STAGES, type LifecycleStageKey } from "@/content/therapies";

const STAGE_ICONS: Record<LifecycleStageKey, typeof ClipboardText> = {
  intake: ClipboardText,
  assessment: ListChecks,
  plan: Path,
  sessions: CalendarCheck,
  review: Notebook,
  outcome: SealCheck,
};

/**
 * The therapy journey shown like a visual schedule board: one stage per row,
 * always the same order, the first marked "Start here". Real content (the
 * six lifecycle stages), not a mock screenshot.
 */
export function JourneyBoard({
  notes,
  title = "Your child's plan",
  subtitle = "The same six steps for every therapy",
  compactOnMobile = false,
}: {
  /** Optional per-stage text (therapy pages); defaults to the generic description. */
  notes?: Readonly<Record<LifecycleStageKey, string>>;
  title?: string;
  subtitle?: string;
  compactOnMobile?: boolean;
}) {
  return (
    <div className="board-dots rounded-3xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
        <p className="font-display text-lg font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-soft">{subtitle}</p>
      </div>
      <ol className="relative flex flex-col gap-2.5">
        {LIFECYCLE_STAGES.map((stage, i) => {
          const Icon = STAGE_ICONS[stage.key];
          const first = i === 0;
          return (
            <li
              key={stage.key}
              className={`relative flex items-start gap-4 rounded-2xl bg-surface p-3.5 shadow-[0_1px_2px_rgba(24,33,58,0.06)] ${
                first ? "ring-2 ring-marigold" : ""
              }`}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mist text-harbour">
                <Icon size={24} weight="duotone" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {stage.title}
                  {first ? (
                    <span className="rounded-md bg-marigold-soft px-1.5 py-0.5 text-xs font-semibold text-ink">Start here</span>
                  ) : null}
                </span>
                <span className={`text-sm leading-relaxed text-ink-soft ${compactOnMobile ? "hidden sm:block" : ""}`}>
                  {notes ? notes[stage.key] : stage.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
