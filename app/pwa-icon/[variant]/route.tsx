import { ImageResponse } from "next/og";

/**
 * PNG app icons for the PWA manifest, drawn from the logomark at build time.
 * `maskable` keeps the mark inside the 80% safe zone for Android masks.
 */
const VARIANTS = {
  "192": { size: 192, scale: 0.72 },
  "512": { size: 512, scale: 0.72 },
  "maskable-512": { size: 512, scale: 0.56 },
} as const;

type Variant = keyof typeof VARIANTS;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, { params }: RouteContext<"/pwa-icon/[variant]">) {
  const { variant } = await params;
  const config = VARIANTS[variant as Variant];
  if (!config) return new Response("Not found", { status: 404 });
  const mark = Math.round(config.size * config.scale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3E4761",
          borderRadius: variant === "maskable-512" ? 0 : config.size * 0.22,
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 40 40">
          <path d="M9 33 V21 a11 11 0 0 1 22 0 V33" fill="none" stroke="#FFFCFA" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={20} cy={27.5} r={4.5} fill="#F5E6A3" />
        </svg>
      </div>
    ),
    { width: config.size, height: config.size },
  );
}
