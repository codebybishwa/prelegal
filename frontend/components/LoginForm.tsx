"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/session";

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary";

export const MIN_PASSWORD_LENGTH = 8;

/** Signs in to an existing account, or (mode "signup") creates one; either way, then opens the creator. */
export default function LoginForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignUp = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await (isSignUp ? signUp : signIn)(email, password);
      router.push("/create/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Password
        <input
          type="password"
          name="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={isSignUp ? "password-hint" : undefined}
          className={inputClass}
        />
        {isSignUp && (
          <span id="password-hint" className="mt-1 block text-xs font-normal text-brand-gray">
            At least {MIN_PASSWORD_LENGTH} characters.
          </span>
        )}
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (isSignUp ? "Creating account…" : "Signing in…") : isSignUp ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
