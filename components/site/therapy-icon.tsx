import { ChatsCircle, HandGrabbing, Heart, PersonSimpleWalk, Target } from "@phosphor-icons/react/dist/ssr";
import type { IconProps } from "@phosphor-icons/react";

/**
 * One Phosphor icon per therapy line, so lines differ by shape as well as by
 * name (server-rendered build). Decorative: always shown next to the name.
 */
const ICONS = {
  "speech-language-pathology": ChatsCircle,
  "occupational-therapy": HandGrabbing,
  "applied-behavior-analysis": Target,
  physiotherapy: PersonSimpleWalk,
} as const;

export function TherapyIcon({ slug, ...props }: { slug: string } & IconProps) {
  const Icon = ICONS[slug as keyof typeof ICONS] ?? Heart;
  return <Icon aria-hidden weight="duotone" {...props} />;
}
