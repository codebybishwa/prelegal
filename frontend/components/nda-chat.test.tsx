// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NdaCreator from "./NdaCreator";
import { GREETING } from "@/lib/chat";
import { signIn } from "@/lib/session";
import { readTemplate } from "@/lib/templates";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

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

function renderCreator() {
  render(
    <NdaCreator
      coverPageTemplate={readTemplate("Mutual-NDA-coverpage.md")}
      standardTerms={readTemplate("Mutual-NDA.md")}
    />,
  );
}

const preview = () => screen.getByRole("region", { name: "Document preview" });
const messageBox = () => screen.getByLabelText("Message");
const sendButton = () => screen.getByRole("button", { name: "Send" });

function say(text: string) {
  fireEvent.change(messageBox(), { target: { value: text } });
  fireEvent.click(sendButton());
}

function sentBody(call: number) {
  return JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);
}

describe("NdaChat", () => {
  it("replaces the form with a chat that opens with a greeting", () => {
    renderCreator();

    expect(screen.getByText(GREETING.content)).toBeTruthy();
    expect(screen.queryByLabelText("Governing law")).toBeNull();
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends the user's message and fills the document from the AI's updates", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        reply: "Thanks Ada! Who signs for Globex?",
        updates: {
          governingLaw: "Delaware",
          mndaTermYears: null,
          party1: { name: "Ada Lovelace", company: "Acme Inc" },
          party2: { company: "Globex" },
        },
      }),
    );
    renderCreator();

    say("I'm Ada Lovelace from Acme Inc, signing with Globex under Delaware law, until terminated.");

    expect(screen.getByText(/I'm Ada Lovelace from Acme Inc/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Thinking…");
    expect((messageBox() as HTMLTextAreaElement).value).toBe("");

    await screen.findByText("Thanks Ada! Who signs for Globex?");
    expect(screen.queryByRole("status")).toBeNull();

    const doc = preview().textContent ?? "";
    expect(doc).toContain("Ada Lovelace");
    expect(doc).toContain("Acme Inc");
    expect(doc).toContain("Globex");
    expect(doc).toContain("Delaware");
    expect(preview().querySelectorAll("input[type=checkbox]:checked").length).toBeGreaterThan(0);

    expect(sentBody(0).messages).toEqual([
      GREETING,
      { role: "user", content: "I'm Ada Lovelace from Acme Inc, signing with Globex under Delaware law, until terminated." },
    ]);
    expect(sentBody(0).nda.governingLaw).toBe("");
  });

  it("sends the full history and the updated NDA on the next turn", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ reply: "Which state's law?", updates: { party1: { name: "Ada" } } }))
      .mockResolvedValueOnce(json({ reply: "Done.", updates: { governingLaw: "Delaware" } }));
    renderCreator();

    say("I'm Ada");
    await screen.findByText("Which state's law?");
    say("Delaware");
    await screen.findByText("Done.");

    const second = sentBody(1);
    expect(second.messages.map((m: { content: string }) => m.content)).toEqual([
      GREETING.content,
      "I'm Ada",
      "Which state's law?",
      "Delaware",
    ]);
    expect(second.nda.party1.name).toBe("Ada");
  });

  it("sends on Enter but not Shift+Enter", async () => {
    fetchMock.mockResolvedValueOnce(json({ reply: "Ok", updates: {} }));
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
      .mockResolvedValueOnce(json({ reply: "Back again!", updates: { purpose: "Hiring a contractor" } }));
    renderCreator();

    say("Hi");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The free AI model is busy right now.");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Back again!");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(sentBody(1).messages).toEqual(sentBody(0).messages);
    expect(screen.getAllByText("Hi")).toHaveLength(1);
    await waitFor(() => expect(preview().textContent).toContain("Hiring a contractor"));
  });
});
