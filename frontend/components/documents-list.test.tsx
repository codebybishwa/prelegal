// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DocumentsList from "./DocumentsList";
import { readRegistry } from "@/lib/templates";
import { json, stubApi } from "@/lib/test-utils";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const { documents } = readRegistry();
const ME = { "/api/auth/me": json({ email: "ada@acme.com" }) };

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderList = () => render(<DocumentsList documents={documents} />);

describe("DocumentsList", () => {
  it("lists the user's drafts with their parties and a link to continue each", async () => {
    stubApi({
      ...ME,
      "/api/drafts": json([
        { id: 2, documentId: "pilot-agreement", parties: ["Acme Inc", "Globex"], updatedAt: "2026-10-09T12:00:00Z" },
        { id: 1, documentId: "mutual-nda", parties: [], updatedAt: "2026-10-08T09:30:00Z" },
      ]),
    });
    renderList();

    expect(await screen.findByText("Pilot Agreement")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "My documents" })).toBeTruthy();
    expect(screen.getByText(/Acme Inc and Globex · Updated/)).toBeTruthy();
    expect(screen.getByText("Mutual Non-Disclosure Agreement")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Continue Pilot Agreement" }).getAttribute("href")).toBe("/create/?doc=2");
    expect(screen.getByRole("link", { name: "Continue Mutual Non-Disclosure Agreement" }).getAttribute("href")).toBe(
      "/create/?doc=1",
    );
    expect(screen.getByRole("link", { name: "My documents" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("note").textContent).toContain("subject to legal review");
  });

  it("invites the user to draft a first document when there are none", async () => {
    stubApi({ ...ME, "/api/drafts": json([]) });
    renderList();

    expect(await screen.findByText("No documents yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Draft your first document" }).getAttribute("href")).toBe("/create/");
  });

  it("shows an error and retries", async () => {
    const fetchMock = stubApi({
      ...ME,
      "/api/drafts": [json({ detail: "Database unavailable." }, 500), json([])],
    });
    renderList();

    expect((await screen.findByRole("alert")).textContent).toContain("Database unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("No documents yet")).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/drafts")).toHaveLength(2);
  });

  it("redirects signed-out visitors to the sign-in page", async () => {
    const fetchMock = stubApi({ "/api/auth/me": json({ detail: "Please sign in to continue." }, 401) });
    const { container } = renderList();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(container.innerHTML).toBe("");
    expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain("/api/drafts");
  });
});
