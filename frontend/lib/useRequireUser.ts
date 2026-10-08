import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { getUserEmail } from "@/lib/session";

// sessionStorage has no change events within a tab, so there is nothing to subscribe to.
const subscribe = () => () => {};

/**
 * Returns the signed-in email, or redirects to the login page when there is none.
 * Returns `undefined` during prerendering/hydration, before sessionStorage can be read.
 */
export function useRequireUser(): string | null | undefined {
  const email = useSyncExternalStore(subscribe, getUserEmail, () => undefined);
  const router = useRouter();

  useEffect(() => {
    if (email === null) router.replace("/");
  }, [email, router]);

  return email;
}
