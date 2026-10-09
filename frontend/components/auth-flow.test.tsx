// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "./AuthPage";
import LoginForm from "./LoginForm";
import DocumentCreator from "./DocumentCreator";
import { DRAFT_DISCLAIMER } from "@/lib/disclaimer";
import { readDocumentTemplates, readRegistry } from "@/lib/templates";
import { json, sentBodies, stubApi } from "@/lib/test-utils";

const registry = readRegistry();
const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillIn(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: password } });
}

describe("LoginForm", () => {
  it("signs in and goes to the document creator", async () => {
    const fetchMock = stubApi({ "/api/auth/signin": json({ email: "ada@acme.com" }) });
    render(<LoginForm mode="signin" />);

    fillIn("ada@acme.com", "correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/create/"));
    expect(sentBodies(fetchMock, "/api/auth/signin")).toEqual([{ email: "ada@acme.com", password: "correct horse" }]);
  });

  it("shows why signing in failed and stays on the page", async () => {
    stubApi({ "/api/auth/signin": json({ detail: "Incorrect email or password." }, 401) });
    render(<LoginForm mode="signin" />);

    fillIn("ada@acme.com", "wrong password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect email or password.");
    expect(router.push).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not submit until both email and password are filled", () => {
    const fetchMock = stubApi({});
    render(<LoginForm mode="signin" />);
    const submit = screen.getByRole("button", { name: "Sign in" });

    fireEvent.click(submit);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@acme.com" } });
    fireEvent.click(submit);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates an account and goes to the document creator", async () => {
    const fetchMock = stubApi({ "/api/auth/signup": json({ email: "ada@acme.com" }, 201) });
    render(<LoginForm mode="signup" />);

    fillIn("ada@acme.com", "correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/create/"));
    expect(sentBodies(fetchMock, "/api/auth/signup")).toHaveLength(1);
  });

  it("asks for a new password of at least 8 characters when signing up", () => {
    render(<LoginForm mode="signup" />);
    const password = screen.getByLabelText(/^Password/) as HTMLInputElement;

    expect(password.minLength).toBe(8);
    expect(password.autocomplete).toBe("new-password");
    expect(screen.getByText("At least 8 characters.")).toBeTruthy();
  });

  it("explains a taken email", async () => {
    stubApi({ "/api/auth/signup": json({ detail: "An account with this email already exists." }, 409) });
    render(<LoginForm mode="signup" />);

    fillIn("ada@acme.com", "correct horse");
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect((await screen.findByRole("alert")).textContent).toContain("already exists");
  });
});

describe("AuthPage", () => {
  it("links sign in to sign up and back, with the draft disclaimer", () => {
    render(<AuthPage mode="signin" />);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/signup/");
    expect(screen.getByRole("note").textContent).toBe(DRAFT_DISCLAIMER);
    cleanup();

    render(<AuthPage mode="signup" />);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/");
  });
});

describe("DocumentCreator access", () => {
  const renderCreator = () =>
    render(<DocumentCreator registry={registry} templates={readDocumentTemplates(registry)} />);

  it("redirects signed-out visitors to the sign-in page and renders nothing", async () => {
    stubApi({ "/api/auth/me": json({ detail: "Please sign in to continue." }, 401) });
    const { container } = renderCreator();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(container.innerHTML).toBe("");
  });

  it("shows the signed-in user and lets them log out", async () => {
    const fetchMock = stubApi({
      "/api/auth/me": json({ email: "ada@acme.com" }),
      "/api/auth/signout": new Response(null, { status: 204 }),
    });
    renderCreator();

    expect(await screen.findByText("ada@acme.com")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Document Creator" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "My documents" }).getAttribute("href")).toBe("/documents/");
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledExactlyOnceWith("/"));
    expect(fetchMock.mock.calls.map(([url]) => url)).toContain("/api/auth/signout");
  });
});
