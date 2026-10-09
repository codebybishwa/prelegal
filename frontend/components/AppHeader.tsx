"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { signOut } from "@/lib/session";

type Props = {
  userEmail: string;
  current: "create" | "documents";
  /** Starts a fresh document; given on the creator, where linking to the same page wouldn't reset it. */
  onNewDocument?: () => void;
};

const navItem = "rounded-md px-3 py-2 text-sm font-medium transition-colors";
const navActive = `${navItem} bg-brand-primary/10 text-brand-navy`;
const navIdle = `${navItem} text-slate-600 hover:bg-slate-100 hover:text-brand-navy`;

/** The signed-in app's top bar: brand, navigation and account. */
export default function AppHeader({ userEmail, current, onNewDocument }: Props) {
  const router = useRouter();

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      router.replace("/");
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/create/" aria-label="PreLegal home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {onNewDocument ? (
              <button type="button" onClick={onNewDocument} className={current === "create" ? navActive : navIdle}>
                New document
              </button>
            ) : (
              <Link href="/create/" className={current === "create" ? navActive : navIdle}>
                New document
              </Link>
            )}
            <Link
              href="/documents/"
              aria-current={current === "documents" ? "page" : undefined}
              className={current === "documents" ? navActive : navIdle}
            >
              My documents
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="hidden h-8 w-8 items-center justify-center rounded-full bg-brand-navy text-sm font-semibold text-white uppercase sm:flex"
          >
            {userEmail[0]}
          </span>
          <span className="hidden text-sm text-slate-600 md:inline">{userEmail}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
