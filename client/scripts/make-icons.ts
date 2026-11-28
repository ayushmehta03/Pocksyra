// Draws every app icon from lib/logo.ts. Run from client/ after changing the logo:
//   npm run icons
// Needs `rsvg-convert` (librsvg) on the machine. The PNGs are committed, so the build never needs it.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { badgeSvg, logoSvg } from "../lib/logo.ts";

mkdirSync("public/icons", { recursive: true });

function png(svg: string, px: number, out: string) {
  const tmp = `${out}.svg`;
  writeFileSync(tmp, svg);
  execFileSync("rsvg-convert", ["-w", String(px), "-h", String(px), tmp, "-o", out]);
  execFileSync("rm", ["-f", tmp]);
  console.log("wrote", out);
}

png(logoSvg(192), 192, "public/icons/icon-192.png");
png(logoSvg(512), 512, "public/icons/icon-512.png");
png(logoSvg(512, true), 512, "public/icons/maskable-512.png");
png(badgeSvg(96), 96, "public/icons/badge-96.png");
// Next.js picks these two up by file name.
png(logoSvg(180, true), 180, "app/apple-icon.png"); // iOS rounds the corners itself
png(logoSvg(64), 64, "app/icon.png");
writeFileSync("app/icon.svg", logoSvg(512));
console.log("wrote app/icon.svg");
