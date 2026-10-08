/**
 * Placeholder session for the fake login: the signed-in email lives in sessionStorage.
 * There is no authentication yet; this only remembers who "signed in" for this tab.
 */
const USER_EMAIL_KEY = "prelegal.userEmail";

export function signIn(email: string): void {
  sessionStorage.setItem(USER_EMAIL_KEY, email.trim());
}

export function signOut(): void {
  sessionStorage.removeItem(USER_EMAIL_KEY);
}

export function getUserEmail(): string | null {
  return sessionStorage.getItem(USER_EMAIL_KEY) || null;
}
