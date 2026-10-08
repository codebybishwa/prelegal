import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to static files in out/, which the FastAPI backend serves.
  output: "export",
  // Emit /nda/index.html (not /nda.html) so a plain static file server resolves every route.
  trailingSlash: true,
};

export default nextConfig;
