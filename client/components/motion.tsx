"use client";

// Every use of Framer Motion goes through this file, so the rest of the app
// imports animation from one place and the library can be swapped or tuned here.

import { AnimatePresence, LazyMotion, MotionConfig, domMax, m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export { AnimatePresence, m, useReducedMotion };

/** The easing used across the app: quick start, soft landing. */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Wrap the app once. `reducedMotion="user"` makes every animation skip its
 * movement for people who turned on "reduce motion" in their device settings.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domMax}>{children}</LazyMotion>
    </MotionConfig>
  );
}

/** Fades in and rises a little when it first appears. */
export function FadeUp({
  children,
  delay = 0,
  y = 12,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
    >
      {children}
    </m.div>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/** Its StaggerItem children appear one after another. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </m.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div className={className} variants={item}>
      {children}
    </m.div>
  );
}
