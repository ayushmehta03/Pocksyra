import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pocksyra",
    short_name: "Pocksyra",
    description: "Split expenses with friends, beautifully.",
    // Signed-out users are bounced to /login by the dashboard layout.
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06100d",
    theme_color: "#06100d",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Friends", url: "/dashboard/friends", icons: [{ src: "/pwa-icon/192", sizes: "192x192" }] },
    ],
  };
}
