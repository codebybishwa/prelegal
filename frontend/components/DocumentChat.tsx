"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { sendChat, type ChatMessage, type DocumentState } from "@/lib/chat";

type Props = {
  greeting: ChatMessage;
  /** The conversation so far, when continuing a saved draft. */
  initialMessages?: ChatMessage[];
  document: DocumentState;
  /** The saved draft this conversation continues, or null for a new one. */
  draftId: number | null;
  onChange: (document: DocumentState, draftId: number | null) => void;
};

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
          isUser
            ? "rounded-br-sm bg-brand-primary text-white"
            : "rounded-bl-sm border border-slate-200 bg-white text-slate-900"
        }`}
      >
        {message.content}
      </p>
    </li>
  );
}

/** Free-form chat with the AI, which picks the document and fills in its fields from the answers. */
export default function DocumentChat({ greeting, initialMessages, document, draftId, onChange }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? [greeting]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, pending, error]);

  async function request(history: ChatMessage[]) {
    setPending(true);
    setError(null);
    try {
      const reply = await sendChat(history, document, draftId);
      setMessages([...history, { role: "assistant", content: reply.reply }]);
      onChange({ documentId: reply.documentId, values: reply.values }, reply.draftId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  function send() {
    const content = input.trim();
    if (!content || pending) return;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    void request(history);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  // Enter sends; Shift+Enter adds a new line.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-[32rem] flex-col lg:h-full">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-3">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
        <div>
          <h2 className="text-sm font-semibold text-brand-navy">AI drafting assistant</h2>
          <p className="text-xs text-brand-gray">Answer in your own words; the document updates as you go.</p>
        </div>
      </div>

      <ul
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-6"
        aria-label="Conversation"
        aria-live="polite"
      >
        {messages.map((message, i) => (
          <Bubble key={i} message={message} />
        ))}
        {pending && (
          <li className="flex items-center gap-2 text-sm text-brand-gray" role="status">
            <span aria-hidden="true" className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-gray [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-gray [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-gray" />
            </span>
            Thinking…
          </li>
        )}
        {error && (
          <li className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}{" "}
            <button
              type="button"
              onClick={() => request(messages)}
              className="font-medium text-brand-primary hover:underline"
            >
              Retry
            </button>
          </li>
        )}
      </ul>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-slate-200 bg-white p-4">
        <textarea
          rows={2}
          aria-label="Message"
          placeholder="Type your answer…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-lg bg-brand-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
