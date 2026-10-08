"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { GREETING, sendChat, type ChatMessage, type NdaUpdates } from "@/lib/chat";
import type { NdaData } from "@/lib/nda";

type Props = {
  data: NdaData;
  onUpdate: (updates: NdaUpdates) => void;
};

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-900"
        }`}
      >
        {message.content}
      </p>
    </li>
  );
}

/** Free-form chat with the AI, which asks about the NDA and fills in its fields from the answers. */
export default function NdaChat({ data, onUpdate }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
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
      const { reply, updates } = await sendChat(history, data);
      setMessages([...history, { role: "assistant", content: reply }]);
      onUpdate(updates);
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
      <ul ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-6" aria-label="Conversation" aria-live="polite">
        {messages.map((message, i) => (
          <Bubble key={i} message={message} />
        ))}
        {pending && (
          <li className="text-sm text-brand-gray" role="status">
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

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-slate-200 p-4">
        <textarea
          rows={2}
          aria-label="Message"
          placeholder="Type your answer…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="rounded-md bg-brand-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
