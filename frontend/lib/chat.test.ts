import { afterEach, describe, expect, it, vi } from "vitest";
import { applyUpdates, GREETING, sendChat } from "./chat";
import { defaultNdaData } from "./nda";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("applyUpdates", () => {
  it("leaves the data unchanged for empty updates", () => {
    expect(applyUpdates(defaultNdaData, {})).toEqual(defaultNdaData);
  });

  it("sets top-level fields, including open-ended terms", () => {
    const result = applyUpdates(defaultNdaData, { governingLaw: "Delaware", mndaTermYears: null, confidentialityYears: 4 });

    expect(result.governingLaw).toBe("Delaware");
    expect(result.mndaTermYears).toBeNull();
    expect(result.confidentialityYears).toBe(4);
    expect(result.purpose).toBe(defaultNdaData.purpose);
  });

  it("merges party fields without losing the ones not mentioned", () => {
    const data = applyUpdates(defaultNdaData, { party1: { name: "Ada Lovelace", company: "Acme Inc" } });
    const result = applyUpdates(data, { party1: { title: "CEO" }, party2: { company: "Globex" } });

    expect(result.party1).toEqual({ name: "Ada Lovelace", title: "CEO", company: "Acme Inc", noticeAddress: "" });
    expect(result.party2).toEqual({ name: "", title: "", company: "Globex", noticeAddress: "" });
  });

  it("does not mutate the input", () => {
    const data = structuredClone(defaultNdaData);
    applyUpdates(data, { party1: { name: "Ada" }, purpose: "Hiring" });
    expect(data).toEqual(defaultNdaData);
  });
});

describe("sendChat", () => {
  const messages = [GREETING, { role: "user" as const, content: "Acme and Globex" }];

  it("posts the conversation and NDA and returns the reply", async () => {
    const fetchMock = stubFetch(json({ reply: "Great", updates: { purpose: "Hiring" } }));

    await expect(sendChat(messages, defaultNdaData)).resolves.toEqual({ reply: "Great", updates: { purpose: "Hiring" } });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ messages, nda: defaultNdaData });
  });

  it("surfaces the backend's error detail", async () => {
    stubFetch(json({ detail: "The free AI model is busy right now." }, 503));

    await expect(sendChat(messages, defaultNdaData)).rejects.toThrow("The free AI model is busy right now.");
  });

  it("falls back to a generic message for non-JSON errors and network failures", async () => {
    stubFetch(new Response("Bad gateway", { status: 502 }));
    await expect(sendChat(messages, defaultNdaData)).rejects.toThrow("could not be reached");

    stubFetch(new TypeError("Failed to fetch"));
    await expect(sendChat(messages, defaultNdaData)).rejects.toThrow("could not be reached");
  });
});
