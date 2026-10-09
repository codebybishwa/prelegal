// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginForm from "./LoginForm";
import DocumentCreator from "./DocumentCreator";
import { getUserEmail, signIn } from "@/lib/session";
import { readDocumentTemplates, readRegistry } from "@/lib/templates";

const registry = readRegistry();
const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("LoginForm", () => {
  it("signs in with any credentials and goes to the document creator", () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@acme.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "anything" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(getUserEmail()).toBe("ada@acme.com");
    expect(router.push).toHaveBeenCalledWith("/create");
  });

  it("does not sign in until both email and password are filled", () => {
    render(<LoginForm />);
    const submit = screen.getByRole("button", { name: "Sign in" });

    fireEvent.click(submit);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@acme.com" } });
    fireEvent.click(submit);

    expect(getUserEmail()).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("DocumentCreator access", () => {
  const renderCreator = () =>
    render(<DocumentCreator registry={registry} templates={readDocumentTemplates(registry)} />);

  it("redirects signed-out visitors to the login page and renders nothing", () => {
    const { container } = renderCreator();

    expect(router.replace).toHaveBeenCalledWith("/");
    expect(container.innerHTML).toBe("");
  });

  it("shows the signed-in user and lets them log out", () => {
    signIn("ada@acme.com");
    renderCreator();

    expect(screen.getByText("ada@acme.com")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Document Creator" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(getUserEmail()).toBeNull();
    expect(router.replace).toHaveBeenCalledExactlyOnceWith("/");
  });
});
