import { ApiError, apiFetch, SESSION_EXPIRED } from "@/lib/api";
import type { DocumentDef, Values } from "@/lib/documents";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** The selected document and its values; the backend owns both and returns them each turn. */
export type DocumentState = { documentId: string | null; values: Values };

/** `draftId` is the saved draft the turn was stored in; null until a document is selected. */
export type ChatReply = DocumentState & { reply: string; draftId: number | null };

export const NO_DOCUMENT: DocumentState = { documentId: null, values: {} };

/** The opening message, listing the documents the AI can draft. */
export function buildGreeting(documents: DocumentDef[]): ChatMessage {
  return {
    role: "assistant",
    content:
      "Hi! I'll help you draft a legal agreement. I can prepare: " +
      `${documents.map((doc) => doc.name).join(", ")}. ` +
      "What would you like to draft, and who is it between?",
  };
}

const FALLBACK_ERROR = "The AI assistant could not be reached. Please try again.";

/**
 * Sends the conversation and current document to the backend, which saves the turn to the
 * draft `draftId` (or a new draft). Throws with a user-facing message on failure.
 */
export async function sendChat(
  messages: ChatMessage[],
  { documentId, values }: DocumentState,
  draftId: number | null = null,
): Promise<ChatReply> {
  try {
    return await apiFetch<ChatReply>("/api/chat", FALLBACK_ERROR, { messages, documentId, values, draftId });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) throw new ApiError(SESSION_EXPIRED, 401);
    throw e;
  }
}
