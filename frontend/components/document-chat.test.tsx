// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentCreator from "./DocumentCreator";
import { buildGreeting } from "@/lib/chat";
import { DRAFT_DISCLAIMER } from "@/lib/disclaimer";
import { readDocumentTemplates, readRegistry } from "@/lib/templates";
import { json, sentBodies, stubApi } from "@/lib/test-utils";

const router = { push: vi.fn(), replace: vi.fn() };
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
}));

const registry = readRegistry();
const templates = readDocumentTemplates(registry);
const GREETING = buildGreeting(registry.documents);
const ME = { "/api/auth/me": json({ email: "ada@acme.com" }) };

let fetchMock: ReturnType<typeof stubApi>;

/** Signed in as Ada, with the given chat replies queued. */
function stubChat(...replies: Response[]) {
  fetchMock = stubApi({ ...ME, "/api/chat": replies });
}

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  stubChat();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Renders the creator and waits for the signed-in session check. */
async function renderCreator() {
  const view = render(<DocumentCreator registry={registry} templates={templates} />);
  await screen.findByRole("heading", { name: "Document Creator" });
  return view;
}

const preview = () => screen.getByRole("region", { name: "Document preview" });
const messageBox = () => screen.getByLabelText("Message");
const sendButton = () => screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
const downloadButton = () => screen.getByRole("button", { name: "Download PDF" }) as HTMLButtonElement;
const chatBodies = () => sentBodies(fetchMock, "/api/chat");

function say(text: string) {
  fireEvent.change(messageBox(), { target: { value: text } });
  fireEvent.click(sendButton());
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
  it("opens by asking what to draft, with no document selected", async () => {
    await renderCreator();

    expect(screen.getByText(GREETING.content)).toBeTruthy();
    expect(sendButton().disabled).toBe(true);
    expect(downloadButton().disabled).toBe(true);
    expect(preview().textContent).toContain("Documents you can draft");
    expect(preview().textContent).toContain("Cloud Service Agreement");
    expect(screen.queryByText("Saved to My documents")).toBeNull();
  });

  it("selects the document the AI chose, fills it from the returned values and saves it", async () => {
    stubChat(
      json({ reply: "Thanks Ada! Who signs for Globex?", documentId: "mutual-nda", values: ndaValues, draftId: 4 }),
    );
    await renderCreator();

    say("An NDA between Acme Inc (me, Ada Lovelace) and Globex under Delaware law, until terminated.");

    expect(screen.getByText(/An NDA between Acme Inc/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Thinking…");
    expect((messageBox() as HTMLTextAreaElement).value).toBe("");

    await screen.findByText("Thanks Ada! Who signs for Globex?");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Mutual Non-Disclosure Agreement", { selector: "span" })).toBeTruthy();
    expect(downloadButton().disabled).toBe(false);
    expect(screen.getByText("Saved to My documents")).toBeTruthy();

    const doc = preview().textContent ?? "";
    expect(doc).toContain("Ada Lovelace");
    expect(doc).toContain("Acme Inc");
    expect(doc).toContain("Globex");
    expect(doc).toContain("Delaware");
    expect(preview().querySelectorAll("input[type=checkbox]:checked").length).toBeGreaterThan(0);

    expect(chatBodies()).toEqual([
      {
        messages: [
          GREETING,
          { role: "user", content: "An NDA between Acme Inc (me, Ada Lovelace) and Globex under Delaware law, until terminated." },
        ],
        documentId: null,
        values: {},
        draftId: null,
      },
    ]);
  });

  it("sends the full history, current document and draft on the next turn, and follows a switch", async () => {
    stubChat(
      json({ reply: "An NDA. Which state's law?", documentId: "mutual-nda", values: ndaValues, draftId: 4 }),
      json({
        reply: "Switched to a Cloud Service Agreement.",
        documentId: "cloud-service-agreement",
        values: { governingLaw: "Delaware", "party1.name": "Ada Lovelace", subscriptionPeriod: "1 year" },
        draftId: 4,
      }),
    );
    await renderCreator();

    say("An NDA please");
    await screen.findByText("An NDA. Which state's law?");
    say("Actually, a cloud service agreement for 1 year");
    await screen.findByText("Switched to a Cloud Service Agreement.");

    const second = chatBodies()[1];
    expect(second.messages.map((m: { content: string }) => m.content)).toEqual([
      GREETING.content,
      "An NDA please",
      "An NDA. Which state's law?",
      "Actually, a cloud service agreement for 1 year",
    ]);
    expect(second.documentId).toBe("mutual-nda");
    expect(second.values).toEqual(ndaValues);
    expect(second.draftId).toBe(4);

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
    stubChat(json({ reply: "Ok", documentId: null, values: {}, draftId: null }));
    await renderCreator();

    fireEvent.change(messageBox(), { target: { value: "Hello" } });
    fireEvent.keyDown(messageBox(), { key: "Enter", shiftKey: true });
    expect(chatBodies()).toHaveLength(0);

    fireEvent.keyDown(messageBox(), { key: "Enter" });
    expect(chatBodies()).toHaveLength(1);
    await screen.findByText("Ok");
  });

  it("shows the error and retries the same conversation", async () => {
    stubChat(
      json({ detail: "The free AI model is busy right now." }, 503),
      json({ reply: "Back again!", documentId: "pilot-agreement", values: { pilotPeriod: "60 days" }, draftId: 1 }),
    );
    await renderCreator();

    say("Hi");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The free AI model is busy right now.");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Back again!");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(chatBodies()[1].messages).toEqual(chatBodies()[0].messages);
    expect(screen.getAllByText("Hi")).toHaveLength(1);
    await waitFor(() => expect(preview().textContent).toContain("60 days"));
  });

  it("asks to sign in again when the session has ended", async () => {
    stubChat(json({ detail: "Please sign in to continue." }, 401));
    await renderCreator();

    say("Hi");

    expect((await screen.findByRole("alert")).textContent).toContain("Please sign in again.");
  });
});

describe("Saved drafts", () => {
  const savedNda = {
    id: 3,
    documentId: "mutual-nda",
    values: ndaValues,
    messages: [GREETING, { role: "user", content: "An NDA with Globex" }, { role: "assistant", content: "Which law?" }],
    updatedAt: "2026-10-09T10:00:00Z",
  };

  it("reopens a draft with its conversation and document, and keeps saving to it", async () => {
    searchParams = new URLSearchParams("doc=3");
    fetchMock = stubApi({
      ...ME,
      "/api/drafts/3": json(savedNda),
      "/api/chat": [json({ reply: "Noted.", documentId: "mutual-nda", values: ndaValues, draftId: 3 })],
    });
    await renderCreator();

    await screen.findByText("Which law?");
    expect(screen.getByText("An NDA with Globex")).toBeTruthy();
    expect(screen.getByText("Mutual Non-Disclosure Agreement", { selector: "span" })).toBeTruthy();
    expect(preview().textContent).toContain("Globex");
    expect(screen.getByText("Saved to My documents")).toBeTruthy();

    say("Delaware");
    await screen.findByText("Noted.");

    const [body] = chatBodies();
    expect(body.draftId).toBe(3);
    expect(body.documentId).toBe("mutual-nda");
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual([
      GREETING.content,
      "An NDA with Globex",
      "Which law?",
      "Delaware",
    ]);
  });

  it("explains when a draft can't be found", async () => {
    searchParams = new URLSearchParams("doc=99");
    stubApi({ ...ME, "/api/drafts/99": json({ detail: "That document could not be found." }, 404) });
    await renderCreator();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("That document could not be found.");
    expect(screen.getByRole("link", { name: "Back to My documents" }).getAttribute("href")).toBe("/documents/");
    expect(screen.queryByLabelText("Message")).toBeNull();
  });

  it("treats a malformed draft id as not found", async () => {
    searchParams = new URLSearchParams("doc=abc");
    stubApi({ ...ME, "/api/drafts/0": json({ detail: "That document could not be found." }, 404) });
    await renderCreator();

    expect((await screen.findByRole("alert")).textContent).toContain("could not be found");
  });

  it("links the URL to a new document once saved, without reloading it", async () => {
    stubChat(json({ reply: "An NDA it is.", documentId: "mutual-nda", values: ndaValues, draftId: 5 }));
    const { rerender } = await renderCreator();
    say("An NDA please");
    await screen.findByText("An NDA it is.");

    expect(router.replace).toHaveBeenCalledExactlyOnceWith("/create/?doc=5");

    // The router catches up: same document, so no remount and no draft fetch (it would be an unexpected URL).
    searchParams = new URLSearchParams("doc=5");
    rerender(<DocumentCreator registry={registry} templates={templates} />);

    expect(screen.getByText("An NDA it is.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("/api/drafts/5");
  });

  it("starts over on New document", async () => {
    stubChat(json({ reply: "An NDA it is.", documentId: "mutual-nda", values: ndaValues, draftId: 5 }));
    await renderCreator();
    say("An NDA please");
    await screen.findByText("An NDA it is.");

    fireEvent.click(screen.getByRole("button", { name: "New document" }));

    await waitFor(() => expect(screen.queryByText("An NDA it is.")).toBeNull());
    expect(screen.getByText(GREETING.content)).toBeTruthy();
    expect(preview().textContent).toContain("Documents you can draft");
  });

  it("leaves a reopened draft for a new document by navigating to /create/", async () => {
    searchParams = new URLSearchParams("doc=3");
    stubApi({ ...ME, "/api/drafts/3": json(savedNda) });
    const { rerender } = await renderCreator();
    await screen.findByText("Which law?");

    fireEvent.click(screen.getByRole("button", { name: "New document" }));
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/create/");

    searchParams = new URLSearchParams();
    rerender(<DocumentCreator registry={registry} templates={templates} />);

    await screen.findByText(GREETING.content);
    expect(screen.queryByText("Which law?")).toBeNull();
    expect(preview().textContent).toContain("Documents you can draft");
  });
});

describe("Disclaimer", () => {
  it("is shown in the app and printed in the document", async () => {
    stubChat(json({ reply: "Ok", documentId: "mutual-nda", values: ndaValues, draftId: 1 }));
    await renderCreator();

    const banner = screen.getByRole("note");
    expect(banner.textContent).toContain(DRAFT_DISCLAIMER);
    expect(banner.className).toContain("print:hidden");

    say("An NDA");
    await screen.findByText("Ok");

    const printed = preview().querySelector("article .draft-notice");
    expect(printed?.textContent).toContain("subject to legal review");
    expect(printed?.textContent).toContain(DRAFT_DISCLAIMER);
  });
});
