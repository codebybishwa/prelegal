import { readFileSync } from "node:fs";
import path from "node:path";
import type { DocumentTemplates, Registry } from "@/lib/documents";

/** The repo-level templates/ directory is the single source of truth for agreement text. */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

/** The repo-level documents.json defines the supported documents, shared with the backend. */
const DOCUMENTS_PATH = path.join(process.cwd(), "..", "documents.json");

export function readTemplate(filename: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8").replace(/\r\n/g, "\n");
}

export function readRegistry(): Registry {
  return JSON.parse(readFileSync(DOCUMENTS_PATH, "utf-8"));
}

/** Every supported document's template text, keyed by document id. */
export function readDocumentTemplates(registry: Registry): DocumentTemplates {
  return Object.fromEntries(
    registry.documents.map(({ id, templates }) => [
      id,
      {
        terms: readTemplate(templates.terms),
        ...(templates.coverPage && { coverPage: readTemplate(templates.coverPage) }),
      },
    ]),
  );
}
