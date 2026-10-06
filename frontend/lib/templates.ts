import { readFileSync } from "node:fs";
import path from "node:path";

/** The repo-level templates/ directory is the single source of truth for agreement text. */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

export function readTemplate(filename: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8").replace(/\r\n/g, "\n");
}
