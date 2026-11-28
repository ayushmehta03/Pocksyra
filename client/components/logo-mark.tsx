"use client";

import { useId } from "react";
import { logoInner } from "@/lib/logo";

/** The Pocksyra app icon, drawn as inline SVG so it stays sharp at any size. */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  // useId gives ":r1:"; gradient ids can't contain colons in url(#...), so strip them.
  const id = `pk${useId().replace(/:/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      aria-hidden
      className={className}
      dangerouslySetInnerHTML={{ __html: logoInner(id) }}
    />
  );
}
