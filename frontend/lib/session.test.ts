// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { getUserEmail, signIn, signOut } from "./session";

beforeEach(() => sessionStorage.clear());

describe("session", () => {
  it("has no user before signing in", () => {
    expect(getUserEmail()).toBeNull();
  });

  it("remembers the signed-in email, trimmed", () => {
    signIn("  ada@acme.com ");
    expect(getUserEmail()).toBe("ada@acme.com");
  });

  it("forgets the user on sign out", () => {
    signIn("ada@acme.com");
    signOut();
    expect(getUserEmail()).toBeNull();
  });

  it("treats a blank email as signed out", () => {
    signIn("   ");
    expect(getUserEmail()).toBeNull();
  });
});
