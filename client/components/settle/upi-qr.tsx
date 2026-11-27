"use client";

import { useMemo } from "react";
import { encodeQr, qrPath, qrViewSize } from "@/lib/qr";

/** A scannable QR code for a UPI payment link, drawn as one SVG path. */
export function UpiQr({ link, className = "h-44 w-44" }: { link: string; className?: string }) {
  const matrix = useMemo(() => encodeQr(link), [link]);
  if (!matrix) return null;
  const size = qrViewSize(matrix);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR code to pay with any UPI app"
      shapeRendering="crispEdges"
      className={`${className} rounded-lg`}
    >
      {/* Scanners need dark modules on a light background with a margin, whatever the app theme is. */}
      <rect width={size} height={size} fill="#ffffff" />
      <path d={qrPath(matrix)} fill="#000000" />
    </svg>
  );
}
