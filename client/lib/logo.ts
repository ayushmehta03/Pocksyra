// The Pocksyra mark: a "P" drawn as one bold stroke, split in two tones (green and white),
// like a bill shared between two people, on a deep-black tile with a soft green glow.
// Every icon (favicon, Apple touch icon, PWA icons, the in-app logo) is drawn from this one file.

const GREEN_LIGHT = "#4ade80";
const GREEN = "#22c55e";

// The P is centred on (256, 256) in a 512 x 512 box, then scaled for maskable icons.
const P_PATH = "M190 392 V128 H270 A84 84 0 0 1 270 296 H190";
// Everything except the lower half of the bowl: that part stays white, the rest turns green.
const GREEN_AREA = "M-100 -100 H700 V212 H222 V700 H-100 Z";
const STROKE = 64;

/**
 * The inside of the logo SVG (everything between the <svg> tags).
 * @param id        prefix for gradient ids, so several logos on one page don't clash
 * @param fullBleed true for maskable and Apple icons: the system rounds the corners itself,
 *                  so the tile fills the square and the P sits in the middle 60%
 */
export function logoInner(id: string, fullBleed = false): string {
  const k = fullBleed ? 0.84 : 1;
  const tile = fullBleed
    ? `<rect width="512" height="512" fill="url(#${id}-bg)"/><rect width="512" height="512" fill="url(#${id}-glow)"/>`
    : `<rect width="512" height="512" rx="112" fill="url(#${id}-bg)"/><rect width="512" height="512" rx="112" fill="url(#${id}-glow)"/>` +
      `<rect x="1.5" y="1.5" width="509" height="509" rx="110.5" fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="3"/>`;
  const caps = `fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${STROKE}"`;
  return (
    `<defs>` +
    `<linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1a1e"/><stop offset="1" stop-color="#09090b"/></linearGradient>` +
    `<radialGradient id="${id}-glow" cx="0.22" cy="0.12" r="0.85"><stop offset="0" stop-color="${GREEN}" stop-opacity="0.34"/><stop offset="0.55" stop-color="${GREEN}" stop-opacity="0.06"/><stop offset="1" stop-color="${GREEN}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${id}-up" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GREEN_LIGHT}"/><stop offset="1" stop-color="${GREEN}"/></linearGradient>` +
    `<linearGradient id="${id}-low" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d4d4d8"/></linearGradient>` +
    `<filter id="${id}-blur" filterUnits="userSpaceOnUse" x="-300" y="-300" width="1200" height="1200"><feGaussianBlur stdDeviation="24"/></filter>` +
    `<clipPath id="${id}-clip"><path d="${GREEN_AREA}"/></clipPath>` +
    `</defs>` +
    tile +
    `<g transform="translate(256 256) scale(${k}) translate(-272 -260)">` +
    `<path d="${P_PATH}" ${caps} stroke="${GREEN}" opacity="0.4" filter="url(#${id}-blur)"/>` +
    `<path d="${P_PATH}" ${caps} stroke="url(#${id}-low)"/>` +
    `<path d="${P_PATH}" ${caps} stroke="url(#${id}-up)" clip-path="url(#${id}-clip)"/>` +
    `</g>`
  );
}

/** A complete SVG document of the logo at the given pixel size. */
export function logoSvg(px: number, fullBleed = false): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 512 512">${logoInner("pk", fullBleed)}</svg>`;
}

/** A white "P" on a transparent background: the small icon Android shows in its status bar for a notification. */
export function badgeSvg(px: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 512 512">` +
    `<path d="${P_PATH}" transform="translate(256 256) scale(1.1) translate(-272 -260)" fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" stroke-width="${STROKE}"/>` +
    `</svg>`
  );
}
