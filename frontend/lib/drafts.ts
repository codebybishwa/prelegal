import { apiFetch } from "@/lib/api";
import type { ChatMessage } from "@/lib/chat";
import type { Values } from "@/lib/documents";

/** A document the user has drafted, as listed on "My documents". */
export type DraftSummary = {
  id: number;
  documentId: string;
  /** The parties' company names that are filled in. */
  parties: string[];
  /** ISO 8601, UTC. */
  updatedAt: string;
};

/** A saved draft with everything needed to carry on: the document, its values and the chat. */
export type Draft = {
  id: number;
  documentId: string;
  values: Values;
  messages: ChatMessage[];
  updatedAt: string;
};

export function listDrafts(): Promise<DraftSummary[]> {
  return apiFetch("/api/drafts", "Your documents could not be loaded. Please try again.");
}

export function getDraft(id: number): Promise<Draft> {
  return apiFetch(`/api/drafts/${id}`, "This document could not be loaded. Please try again.");
}
