import { ImageResponse } from "next/og";
import { logoMarkup } from "@/lib/pwa-icon";

// Icons referenced from the web manifest, generated once at build time.
export const dynamic = "force-static";

const SPECS = {
  "192": { px: 192, fullBleed: false },
  "512": { px: 512, fullBleed: false },
  "maskable-512": { px: 512, fullBleed: true },
} as const;

export function generateStaticParams() {
  return Object.keys(SPECS).map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const spec = SPECS[size as keyof typeof SPECS];
  if (!spec) return new Response("Not found", { status: 404 });
  return new ImageResponse(logoMarkup(spec.px, spec.fullBleed), { width: spec.px, height: spec.px });
}
