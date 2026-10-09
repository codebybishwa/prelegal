// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentCreator from "./DocumentCreator";
import { buildGreeting } from "@/lib/chat";
import { signIn } from "@/lib/session";
import { readDocumentTemplates, readRegistry } from "@/lib/templates";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const registry = readRegistry();
const templates = readDocumentTemplates(registry);
const GREETING = buildGreeting(registry.documents);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  sessionStorage.clear();
  signIn("ada@acme.com");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderCreator = () => render(<DocumentCreator registry={registry} templates={templates} />);

const preview = () => screen.getByRole("region", { name: "Document preview" });
const messageBox = () => screen.getByLabelText("Message");
const sendButton = () => screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
const downloadButton = () => screen.getByRole("button", { name: "Download PDF" }) as HTMLButtonElement;

function say(text: string) {
  fireEvent.change(messageBox(), { target: { value: text } });
  fireEvent.click(sendButton());
}

function sentBody(call: number) {
  return JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);
}

const ndaValues = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTerm: "none",
  confidentialityTerm: "1",
  governingLaw: "Delaware",
  chosenCourts: "",
  modifications: "",
  "party1.name": "Ada Lovelace",
  "party1.company": "Acme Inc",
  "party2.company": "Globex",
};

describe("DocumentChat", () => {
  it("opens by asking what to draft, with no document selected", () => {
    renderCreator();

    expect(screen.getByText(GREETING.content)).toBeTruthy();
    expect(sendButton().disabled).toBe(true);
    expect(downloadButton().disabled).toBe(true);
    expect(preview().textContent).toContain("Documents you can draft");
    expect(preview().textContent).toContain("Cloud Service Agreement");
  });

  it("selects the document the AI chose and fills it from the returned values", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ reply: "Thanks Ada! Who signs for Globex?", documentId: "mutual-nda", values: ndaValues }),
    );
    renderCreator();

    say("An NDA between Acme Inc (me, Ada Lovelace) and Globex under Delaware law, until terminated.");

    expect(screen.getByText(/An NDA between Acme Inc/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Thinking…");
    expect((messageBox() as HTMLTextAreaElement).value).toBe("");

    await screen.findByText("Thanks Ada! Who signs for Globex?");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Mutual Non-Disclosure Agreement", { selector: "span" })).toBeTruthy();
    expect(downloadButton().disabled).toBe(false);

    const doc = preview().textContent ?? "";
    expect(doc).toContain("Ada Lovelace");
    expect(doc).toContain("Acme Inc");
    expect(doc).toContain("Globex");
    expect(doc).toContain("Delaware");
    expect(preview().querySelectorAll("input[type=checkbox]:checked").length).toBeGreaterThan(0);

    expect(sentBody(0)).toEqual({
      messages: [GREETING, { role: "user", content: "An NDA between Acme Inc (me, Ada Lovelace) and Globex under Delaware law, until terminated." }],
      documentId: null,
      values: {},
    });
  });

  it("sends the full history and current document on the next turn, and follows a switch", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ reply: "An NDA. Which state's law?", documentId: "mutual-nda", values: ndaValues }))
      .mockResolvedValueOnce(
        json({
          reply: "Switched to a Cloud Service Agreement.",
          documentId: "cloud-service-agreement",
          values: { governingLaw: "Delaware", "party1.name": "Ada Lovelace", subscriptionPeriod: "1 year" },
        }),
      );
    renderCreator();

    say("An NDA please");
    await screen.findByText("An NDA. Which state's law?");
    say("Actually, a cloud service agreement for 1 year");
    await screen.findByText("Switched to a Cloud Service Agreement.");

    const second = sentBody(1);
    expect(second.messages.map((m: { content: string }) => m.content)).toEqual([
      GREETING.content,
      "An NDA please",
      "An NDA. Which state's law?",
      "Actually, a cloud service agreement for 1 year",
    ]);
    expect(second.documentId).toBe("mutual-nda");
    expect(second.values).toEqual(ndaValues);

    expect(screen.getByText("Cloud Service Agreement", { selector: "span" })).toBeTruthy();
    const doc = preview().textContent ?? "";
    expect(doc).toContain("Subscription Period");
    expect(doc).toContain("1 year");
    expect(doc).toContain("PROVIDER");
    expect(doc).not.toContain("MNDA Term");
    expect(preview().querySelector(".key-terms table")?.textContent).toContain("Subscription Period");
    expect(preview().querySelectorAll(".keyterms_link, .orderform_link").length).toBeGreaterThan(0);
  });

  it("sends on Enter but not Shift+Enter", async () => {
    fetchMock.mockResolvedValueOnce(json({ reply: "Ok", documentId: null, values: {} }));
    renderCreator();

    fireEvent.change(messageBox(), { target: { value: "Hello" } });
    fireEvent.keyDown(messageBox(), { key: "Enter", shiftKey: true });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.keyDown(messageBox(), { key: "Enter" });
    expect(fetchMock).toHaveBeenCalledOnce();
    await screen.findByText("Ok");
  });

  it("shows the error and retries the same conversation", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ detail: "The free AI model is busy right now." }, 503))
      .mockResolvedValueOnce(
        json({ reply: "Back again!", documentId: "pilot-agreement", values: { pilotPeriod: "60 days" } }),
      );
    renderCreator();

    say("Hi");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The free AI model is busy right now.");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Back again!");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(sentBody(1).messages).toEqual(sentBody(0).messages);
    expect(screen.getAllByText("Hi")).toHaveLength(1);
    await waitFor(() => expect(preview().textContent).toContain("60 days"));
  });
});
