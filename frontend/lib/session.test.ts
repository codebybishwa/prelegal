import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCurrentUser, signIn, signOut, signUp } from "./session";
import { json, sentBodies, stubApi } from "./test-utils";

afterEach(() => vi.unstubAllGlobals());

describe("session", () => {
  it("signs up and signs in with email and password, returning the account email", async () => {
    const fetchMock = stubApi({
      "/api/auth/signup": json({ email: "ada@acme.com" }, 201),
      "/api/auth/signin": json({ email: "ada@acme.com" }),
    });

    await expect(signUp("Ada@acme.com", "correct horse")).resolves.toBe("ada@acme.com");
    await expect(signIn("ada@acme.com", "correct horse")).resolves.toBe("ada@acme.com");

    expect(sentBodies(fetchMock, "/api/auth/signup")).toEqual([{ email: "Ada@acme.com", password: "correct horse" }]);
    expect(sentBodies(fetchMock, "/api/auth/signin")).toEqual([{ email: "ada@acme.com", password: "correct horse" }]);
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
  });

  it("surfaces the backend's message when signing in fails", async () => {
    stubApi({ "/api/auth/signin": json({ detail: "Incorrect email or password." }, 401) });

    await expect(signIn("ada@acme.com", "wrong")).rejects.toThrow("Incorrect email or password.");
  });

  it("shows the first validation error as the message", async () => {
    stubApi({
      "/api/auth/signup": json({ detail: [{ msg: "String should have at least 8 characters" }] }, 422),
    });

    await expect(signUp("ada@acme.com", "short")).rejects.toThrow("at least 8 characters");
  });

  it("falls back to a generic message when the backend can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));

    await expect(signIn("ada@acme.com", "x")).rejects.toThrow("could not be reached");
  });

  it("knows the current user, or null without a session", async () => {
    stubApi({ "/api/auth/me": [json({ email: "ada@acme.com" }), json({ detail: "Please sign in." }, 401)] });

    await expect(fetchCurrentUser()).resolves.toBe("ada@acme.com");
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it("signs out", async () => {
    const fetchMock = stubApi({ "/api/auth/signout": new Response(null, { status: 204 }) });

    await expect(signOut()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
