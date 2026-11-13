import type { NextConfig } from "next";

// The Go API. The browser only ever talks to this Next.js origin; these
// rewrites forward calls to Go. That keeps everything same-origin (no CORS)
// and the Go cookies (Path=/ and Path=/auth) work as-is.
//
// /auth and /me are forwarded as-is. Everything else goes under /api/* so it
// can't collide with page routes like /dashboard/friends or /invite/[token].
// Tolerates common typos in the env var: surrounding quotes or spaces, a
// missing scheme (https is assumed for any non-localhost host) and a trailing slash.
function apiUrl(raw: string | undefined): string {
  const v = (raw ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  if (!v) return "http://localhost:8090";
  if (/^https?:\/\//i.test(v)) return v;
  return `${/^(localhost|127\.0\.0\.1)/.test(v) ? "http" : "https"}://${v}`;
}
const API_URL = apiUrl(process.env.API_URL);

const config: NextConfig = {
  async rewrites() {
    return [
      { source: "/auth/:path*", destination: `${API_URL}/auth/:path*` },
      { source: "/me", destination: `${API_URL}/me` },
      { source: "/api/:path*", destination: `${API_URL}/:path*` },
    ];
  },
  // The service worker must always be revalidated so updates roll out promptly.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default config;
