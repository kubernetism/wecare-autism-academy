/**
 * WeCare logomark (an arch sheltering a dot) and wordmark set in Lemonada. Original mark,
 * plain SVG and text, safe in Server Components. Website only.
 */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="12" fill="#2F55A4" />
      <path d="M12 30 V21 a8 8 0 0 1 16 0 V30" stroke="#FDFEFF" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={20} cy={25.5} r={3.4} fill="#F0B44C" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-accent text-[21px] font-semibold tracking-tight text-ink">WeCare</span>
        <span className="mt-1 text-[13px] font-semibold text-ink-soft">Autism Academy</span>
      </span>
    </span>
  );
}
