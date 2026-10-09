"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import Disclaimer from "@/components/Disclaimer";
import type { DocumentDef } from "@/lib/documents";
import { listDrafts, type DraftSummary } from "@/lib/drafts";
import { useRequireUser } from "@/lib/useRequireUser";

type Loaded = { status: "loading" } | { status: "ready"; drafts: DraftSummary[] } | { status: "error"; message: string };

const updatedFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

const primaryButton =
  "inline-flex items-center rounded-lg bg-brand-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary";

/** "My documents": every draft the user has created, newest first, each one ready to continue. */
export default function DocumentsList({ documents }: { documents: DocumentDef[] }) {
  const userEmail = useRequireUser();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userEmail) return;
    let cancelled = false;
    listDrafts().then(
      (drafts) => !cancelled && setLoaded({ status: "ready", drafts }),
      (e: Error) => !cancelled && setLoaded({ status: "error", message: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [userEmail, attempt]);

  if (!userEmail) return null;

  const names = new Map(documents.map((d) => [d.id, d.name]));

  function retry() {
    setLoaded({ status: "loading" });
    setAttempt((a) => a + 1);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader userEmail={userEmail} current="documents" />
      <Disclaimer />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-brand-navy">My documents</h1>
            <p className="mt-1 text-sm text-brand-gray">Drafts are saved automatically as you chat.</p>
          </div>
          <Link href="/create/" className={primaryButton}>
            New document
          </Link>
        </div>

        <div className="mt-8">
          {loaded.status === "loading" && (
            <ul className="space-y-3" role="status" aria-label="Loading your documents">
              {[0, 1, 2].map((i) => (
                <li key={i} className="h-20 animate-pulse rounded-lg border border-slate-200 bg-white" />
              ))}
            </ul>
          )}

          {loaded.status === "error" && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {loaded.message}{" "}
              <button type="button" onClick={retry} className="font-medium text-brand-primary hover:underline">
                Retry
              </button>
            </div>
          )}

          {loaded.status === "ready" && loaded.drafts.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <h2 className="text-base font-semibold text-brand-navy">No documents yet</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-brand-gray">
                Start a conversation with the AI assistant and your draft will appear here.
              </p>
              <Link href="/create/" className={`${primaryButton} mt-6`}>
                Draft your first document
              </Link>
            </div>
          )}

          {loaded.status === "ready" && loaded.drafts.length > 0 && (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {loaded.drafts.map((draft) => {
                const name = names.get(draft.documentId) ?? draft.documentId;
                return (
                  <li key={draft.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{name}</p>
                      <p className="mt-0.5 text-sm text-brand-gray">
                        {draft.parties.length > 0 ? `${draft.parties.join(" and ")} · ` : ""}
                        Updated {updatedFormat.format(new Date(draft.updatedAt))}
                      </p>
                    </div>
                    <Link
                      href={`/create/?doc=${draft.id}`}
                      aria-label={`Continue ${name}`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-brand-primary hover:bg-white hover:shadow-sm"
                    >
                      Continue
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
