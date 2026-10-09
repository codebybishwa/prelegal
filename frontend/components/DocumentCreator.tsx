"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DocumentChat from "@/components/DocumentChat";
import DocumentPreview from "@/components/DocumentPreview";
import { buildGreeting, NO_DOCUMENT } from "@/lib/chat";
import { renderCoverPage } from "@/lib/coverPage";
import { findDocument, type DocumentTemplates, type Registry } from "@/lib/documents";
import { signOut } from "@/lib/session";
import { useRequireUser } from "@/lib/useRequireUser";

type Props = {
  registry: Registry;
  templates: DocumentTemplates;
};

/** Saves the document as PDF through the browser's print dialog ("Save as PDF"). */
function downloadPdf(filename: string) {
  const originalTitle = document.title;
  // Browsers use the page title as the default PDF filename.
  document.title = filename;
  window.addEventListener("afterprint", () => (document.title = originalTitle), { once: true });
  window.print();
}

export default function DocumentCreator({ registry, templates }: Props) {
  const [state, setState] = useState(NO_DOCUMENT);
  const userEmail = useRequireUser();
  const router = useRouter();

  // Render nothing until the session is known, so signed-out visitors never see the app.
  if (!userEmail) return null;

  const doc = findDocument(registry, state.documentId);

  function handleSignOut() {
    signOut();
    router.replace("/");
  }

  return (
    // On large screens the page fits the viewport: the chat and preview scroll independently,
    // so the message box always stays in view. Print falls back to normal document flow.
    <div className="flex min-h-screen flex-col lg:h-screen print:block print:h-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-brand-accent bg-white px-6 py-4 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-brand-navy">Document Creator</h1>
          <p className="text-sm text-brand-gray" aria-live="polite">
            {doc ? (
              <>
                Drafting: <span className="font-medium text-brand-navy">{doc.name}</span>
              </>
            ) : (
              "Tell the AI what you need, and it will pick the right agreement and fill it in."
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-brand-gray">{userEmail}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            Log out
          </button>
          <button
            type="button"
            disabled={!doc}
            onClick={() => doc && downloadPdf(doc.name.replace(/\s+/g, "-"))}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
      </header>

      <main className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:grid-rows-1 print:block">
        <aside className="border-b border-slate-200 bg-white lg:min-h-0 lg:border-r lg:border-b-0 print:hidden">
          <DocumentChat greeting={buildGreeting(registry.documents)} document={state} onChange={setState} />
        </aside>
        <section
          className="bg-slate-100 p-4 sm:p-8 lg:overflow-y-auto print:overflow-visible print:bg-white print:p-0"
          aria-label="Document preview"
        >
          {doc ? (
            <DocumentPreview
              coverPage={renderCoverPage(registry, doc, state.values, templates[doc.id].coverPage)}
              standardTerms={templates[doc.id].terms}
            />
          ) : (
            <div className="mx-auto max-w-xl rounded-lg bg-white p-8 shadow-sm">
              <h2 className="text-base font-semibold text-brand-navy">Documents you can draft</h2>
              <ul className="mt-4 space-y-3">
                {registry.documents.map((d) => (
                  <li key={d.id}>
                    <p className="text-sm font-medium text-slate-900">{d.name}</p>
                    <p className="text-sm text-brand-gray">{d.description}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
