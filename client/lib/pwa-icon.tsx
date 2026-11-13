// Shared artwork for every generated icon (favicon, Apple touch icon, PWA icons).
// Rendered by next/og (satori), so only inline styles with flexbox are supported.

/**
 * @param px       output size in pixels
 * @param fullBleed true = no rounded corners / extra padding (maskable & Apple icons:
 *                  the OS applies its own mask, so the art must reach the edges and
 *                  keep the glyph inside the central safe zone)
 */
export function logoMarkup(px: number, fullBleed = false) {
  const radius = fullBleed ? 0 : Math.round(px * 0.22);
  const glyph = Math.round(px * (fullBleed ? 0.46 : 0.58));
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #7ce6c0 0%, #19b887 55%, #0c7a58 100%)",
        borderRadius: radius,
      }}
    >
      <div style={{ display: "flex", fontSize: glyph, fontWeight: 700, color: "#06100d", lineHeight: 1 }}>P</div>
    </div>
  );
}
