"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/session";

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary";

/** Fake sign-in: any email and password are accepted. Real authentication comes later. */
export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signIn(email);
    router.push("/nda");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        className="w-full rounded-md bg-brand-secondary px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
      >
        Sign in
      </button>
    </form>
  );
}
