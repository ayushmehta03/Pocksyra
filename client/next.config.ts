import type { NextConfig } from "next";

// The Go API. The browser only ever talks to this Next.js origin; these
// rewrites forward auth/profile calls to Go. That keeps everything same-origin
// (no CORS) and the Go cookies (Path=/ and Path=/auth) work as-is.
const API_URL = process.env.API_URL ?? "http://localhost:8090";

const config: NextConfig = {
  async rewrites() {
    return [
      { source: "/auth/:path*", destination: `${API_URL}/auth/:path*` },
      { source: "/me", destination: `${API_URL}/me` },
    ];
  },
};

export default config;
