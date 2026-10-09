import type { DocumentDef, Values } from "@/lib/documents";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** The selected document and its values; the backend owns both and returns them each turn. */
export type DocumentState = { documentId: string | null; values: Values };

export type ChatReply = DocumentState & { reply: string };

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

/** Sends the conversation and current document to the backend; throws with a user-facing message on failure. */
export async function sendChat(messages: ChatMessage[], { documentId, values }: DocumentState): Promise<ChatReply> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, documentId, values }),
    });
  } catch {
    throw new Error(FALLBACK_ERROR);
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body) => body?.detail)
      .catch(() => null);
    throw new Error(typeof detail === "string" ? detail : FALLBACK_ERROR);
  }
  return response.json();
}
