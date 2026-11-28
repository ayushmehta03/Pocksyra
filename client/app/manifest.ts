import type { MetadataRoute } from "next";

// Colours match the night theme (--page in globals.css): it is the colour of the
// splash screen and the system bar while the app opens, before any page code runs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pocksyra",
    short_name: "Pocksyra",
    description: "Split expenses with friends, beautifully.",
    lang: "en",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    // No orientation lock: tablets, foldables and phones held sideways all work.
    background_color: "#09090b",
    theme_color: "#09090b",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Add expense",
        short_name: "Add",
        url: "/dashboard/expenses/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Settle up",
        short_name: "Settle",
        url: "/dashboard/settle",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Friends",
        url: "/dashboard/friends",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
