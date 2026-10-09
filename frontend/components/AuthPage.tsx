import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import Logo from "@/components/Logo";
import { DRAFT_DISCLAIMER } from "@/lib/disclaimer";

const COPY = {
  signin: {
    title: "Welcome back",
    subtitle: "Sign in to pick up your drafts where you left off.",
    switchPrompt: "New to PreLegal?",
    switchLabel: "Create an account",
    switchHref: "/signup/",
  },
  signup: {
    title: "Create your account",
    subtitle: "Draft your first agreement in minutes. Free to use.",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/",
  },
};

const FEATURES = [
  "Chat with an AI assistant instead of filling in forms",
  "Common Paper standard agreements, from NDAs to data processing",
  "Every draft saved to your account, ready to continue",
];

/** The sign-in and sign-up screens: a brand panel beside the form. */
export default function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const copy = COPY[mode];
  return (
    <div className="grid flex-1 lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-navy p-12 text-white lg:flex">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5 bg-brand-accent" />
        <Logo inverted />
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">Legal agreements, drafted in a conversation.</h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-slate-200">
                <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 fill-brand-accent" aria-hidden="true">
                  <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">Built on Common Paper standard agreements.</p>
      </aside>

      <main className="flex flex-col items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">{copy.title}</h1>
          <p className="mt-1 mb-8 text-sm text-brand-gray">{copy.subtitle}</p>
          <LoginForm mode={mode} />
          <p className="mt-6 text-center text-sm text-slate-600">
            {copy.switchPrompt}{" "}
            <Link href={copy.switchHref} className="font-medium text-brand-primary hover:underline">
              {copy.switchLabel}
            </Link>
          </p>
          <p role="note" className="mt-10 border-t border-slate-200 pt-4 text-xs leading-relaxed text-brand-gray">
            {DRAFT_DISCLAIMER}
          </p>
        </div>
      </main>
    </div>
  );
}
