import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/** Where `npm run dev` forwards /api requests: the FastAPI backend. */
const DEV_API_URL = process.env.PRELEGAL_API_URL ?? "http://localhost:8000";

export default function nextConfig(phase: string): NextConfig {
  // `next dev` (localhost:3000) has no backend of its own, so proxy /api to FastAPI.
  // Rewrites don't work with a static export, hence dev-only.
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      async rewrites() {
        return [{ source: "/api/:path*", destination: `${DEV_API_URL}/api/:path*` }];
      },
    };
  }

  return {
    // Build to static files in out/, which the FastAPI backend serves.
    output: "export",
    // Emit /nda/index.html (not /nda.html) so a plain static file server resolves every route.
    trailingSlash: true,
  };
}
