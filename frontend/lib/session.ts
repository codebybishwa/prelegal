import { ApiError, apiFetch } from "@/lib/api";

/**
 * Accounts and sign-in. The backend keeps the session in an HttpOnly cookie, so the browser
 * sends it with every API call and scripts never see it.
 */

type Account = { email: string };

const FALLBACK = "PreLegal could not be reached. Please try again.";

export async function signUp(email: string, password: string): Promise<string> {
  return (await apiFetch<Account>("/api/auth/signup", FALLBACK, { email, password })).email;
}

export async function signIn(email: string, password: string): Promise<string> {
  return (await apiFetch<Account>("/api/auth/signin", FALLBACK, { email, password })).email;
}

export async function signOut(): Promise<void> {
  await apiFetch<void>("/api/auth/signout", FALLBACK, {});
}

/** The signed-in user's email, or null when there is no valid session. */
export async function fetchCurrentUser(): Promise<string | null> {
  try {
    return (await apiFetch<Account>("/api/auth/me", FALLBACK)).email;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}
