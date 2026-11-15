"use client";

import { Button, type ButtonProps } from "antd";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

/**
 * An antd Button that is a real link (`<a href>`, so it works without JS and
 * can be opened in a new tab) but navigates client-side on a plain click.
 */
export function LinkButton({ href, onClick, ...props }: Omit<ButtonProps, "href"> & { href: string }) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (props.target !== undefined && props.target !== "_self") ||
      !href.startsWith("/")
    ) {
      return;
    }
    event.preventDefault();
    router.push(href);
  }

  return <Button {...props} href={href} onClick={handleClick} onMouseEnter={() => router.prefetch(href)} />;
}
