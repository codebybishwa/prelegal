import type { NdaData, Party } from "@/lib/nda";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** The fields the AI changed this turn (mirrors the backend's ChatResponse.updates). */
export type NdaUpdates = Partial<Omit<NdaData, "party1" | "party2">> & {
  party1?: Partial<Party>;
  party2?: Partial<Party>;
};

export type ChatReply = { reply: string; updates: NdaUpdates };

export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'll help you put together a Mutual Non-Disclosure Agreement. " +
    "To start, who are the two parties: which companies, and who will sign for each?",
};

const FALLBACK_ERROR = "The AI assistant could not be reached. Please try again.";

/** Merges the AI's changes into the NDA, keeping party fields it didn't mention. */
export function applyUpdates(data: NdaData, updates: NdaUpdates): NdaData {
  const { party1, party2, ...rest } = updates;
  return {
    ...data,
    ...rest,
    party1: { ...data.party1, ...party1 },
    party2: { ...data.party2, ...party2 },
  };
}

/** Sends the conversation and current NDA to the backend; throws with a user-facing message on failure. */
export async function sendChat(messages: ChatMessage[], nda: NdaData): Promise<ChatReply> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, nda }),
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
