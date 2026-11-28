"use client";

import type { ReactNode } from "react";
import { FadeUp } from "@/components/motion";

// A template remounts on every navigation, so each page fades in as you move around.
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <FadeUp y={8}>{children}</FadeUp>;
}
