"use client";

import type { ReactNode } from "react";
import { FadeUp } from "@/components/motion";

// A template remounts on every navigation, so each page fades in as you move around.
// Pages add their own movement (staggered sections) on top of this soft fade.
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <FadeUp y={0}>{children}</FadeUp>;
}
