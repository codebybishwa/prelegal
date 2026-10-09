import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGreeting, NO_DOCUMENT, sendChat } from "./chat";
import { readRegistry } from "./templates";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const registry = readRegistry();

describe("buildGreeting", () => {
  it("asks what to draft and lists every supported document", () => {
    const greeting = buildGreeting(registry.documents);

    expect(greeting.role).toBe("assistant");
    expect(greeting.content).toContain("What would you like to draft");
    for (const doc of registry.documents) expect(greeting.content).toContain(doc.name);
  });
});

describe("sendChat", () => {
  const messages = [buildGreeting(registry.documents), { role: "user" as const, content: "An NDA with Globex" }];
  const state = { documentId: "mutual-nda", values: { governingLaw: "Delaware" } };

  it("posts the conversation and document and returns the reply", async () => {
    const reply = { reply: "Great", documentId: "mutual-nda", values: { governingLaw: "Delaware", purpose: "Hiring" } };
    const fetchMock = stubFetch(json(reply));

    await expect(sendChat(messages, state)).resolves.toEqual(reply);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ messages, ...state });
  });

  it("sends a null document before one is chosen", async () => {
    const fetchMock = stubFetch(json({ reply: "Which document?", documentId: null, values: {} }));

    await sendChat(messages, NO_DOCUMENT);

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ messages, documentId: null, values: {} });
  });

  it("surfaces the backend's error detail", async () => {
    stubFetch(json({ detail: "The free AI model is busy right now." }, 503));

    await expect(sendChat(messages, state)).rejects.toThrow("The free AI model is busy right now.");
  });

  it("falls back to a generic message for non-JSON errors and network failures", async () => {
    stubFetch(new Response("Bad gateway", { status: 502 }));
    await expect(sendChat(messages, state)).rejects.toThrow("could not be reached");

    stubFetch(new TypeError("Failed to fetch"));
    await expect(sendChat(messages, state)).rejects.toThrow("could not be reached");
  });
});
