import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchCurrentUser } from "@/lib/session";

/**
 * Returns the signed-in email, or redirects to the sign-in page when there is no session.
 * Returns `undefined` while the session is being checked, and `null` once known to be signed out.
 */
export function useRequireUser(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      // If the check itself fails (backend down), treat it as signed out rather than hang.
      .catch(() => null)
      .then((user) => {
        if (cancelled) return;
        setEmail(user);
        if (user === null) router.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return email;
}
