import type { NextConfig } from "next";

// The Go API. The browser only ever talks to this Next.js origin; these
// rewrites forward calls to Go. That keeps everything same-origin (no CORS)
// and the Go cookies (Path=/ and Path=/auth) work as-is.
//
// /auth and /me are forwarded as-is. Everything else goes under /api/* so it
// can't collide with page routes like /dashboard/friends or /invite/[token].
const API_URL = process.env.API_URL ?? "http://localhost:8090";

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
