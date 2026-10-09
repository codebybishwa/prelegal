import { formatDate, years } from "@/lib/markdown";

/**
 * The supported documents and their fields, as defined in the repo's documents.json (shared
 * with the backend, which validates every value). A document's values are strings keyed by
 * field key; party fields are prefixed per party, e.g. "party1.name".
 */

export type FieldDef = {
  label: string;
  /** text: free text; date: yyyy-mm-dd; term: whole years, or NO_TERM for noneLabel. */
  type: "text" | "date" | "term";
  description: string;
  default?: string;
  optional?: boolean;
  noneLabel?: string;
  covers?: string[];
};

export type PartyFieldDef = FieldDef & { key: string };

export type DocumentDef = {
  id: string;
  name: string;
  description: string;
  templates: { terms: string; coverPage?: string };
  /** Role labels for party1 and party2, e.g. ["Provider", "Customer"]. */
  parties: [string, string];
  fields: string[];
};

export type Registry = {
  partyFields: PartyFieldDef[];
  fields: Record<string, FieldDef>;
  documents: DocumentDef[];
};

export type Values = Record<string, string>;

/** Each document's template text by document id, read at build time. */
export type DocumentTemplates = Record<string, { terms: string; coverPage?: string }>;

export const PARTY_IDS = ["party1", "party2"] as const;
export const NO_TERM = "none";

export function findDocument(registry: Registry, id: string | null): DocumentDef | null {
  return registry.documents.find((doc) => doc.id === id) ?? null;
}

/** A filled-in value as plain text for the document, or "" if blank. */
export function formatValue(field: FieldDef, value: string | undefined): string {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (field.type === "date") return formatDate(text);
  if (field.type === "term") return text === NO_TERM ? (field.noneLabel ?? "") : years(Number(text));
  return text;
}
