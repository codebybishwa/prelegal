import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    // What `next build` sets from `trailingSlash: true`, so <Link> hrefs match the exported app.
    env: { __NEXT_TRAILING_SLASH: "true" },
  },
});
