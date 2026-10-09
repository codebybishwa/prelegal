"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import Disclaimer from "@/components/Disclaimer";
import DocumentChat from "@/components/DocumentChat";
import DocumentPreview from "@/components/DocumentPreview";
import { buildGreeting, NO_DOCUMENT, type ChatMessage } from "@/lib/chat";
import { renderCoverPage } from "@/lib/coverPage";
import { findDocument, type DocumentTemplates, type Registry } from "@/lib/documents";
import { getDraft } from "@/lib/drafts";
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

/** The draft id in `?doc=`; anything that isn't one becomes 0, which no draft has, so it shows as not found. */
function parseDraftId(param: string | null): number | null {
  if (param === null) return null;
  const id = Number(param);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

/**
 * One document being worked on. `key` remounts the creator; `load` is the saved draft it opened
 * with; `url` is the draft id in the URL it belongs to; `draftId` is the draft it saves to.
 */
type Session = { key: number; load: number | null; url: number | null; draftId: number | null };

const openSession = (key: number, draftId: number | null): Session => ({ key, load: draftId, url: draftId, draftId });

/**
 * The document creator at /create/: a new document, or with `?doc=<id>` a saved draft to continue.
 * Once a new document is first saved, the URL becomes its ?doc= link (so refresh and Back return
 * to it) without remounting. Any other change of draft, or "New document", remounts the creator,
 * so no state leaks between documents.
 */
export default function DocumentCreator(props: Props) {
  const docParam = useSearchParams().get("doc");
  const router = useRouter();
  const requested = parseDraftId(docParam);
  const [session, setSession] = useState(() => openSession(0, requested));

  // Adjusting state during render (not in an effect) so the old document never renders against the new URL.
  if (requested !== session.url) {
    setSession(
      requested === session.draftId
        ? { ...session, url: requested } // The URL caught up with this document's first save.
        : openSession(session.key + 1, requested), // Another draft (a link, Back/Forward) or none.
    );
  }

  function handleSaved(draftId: number) {
    if (draftId === session.draftId) return;
    setSession({ ...session, draftId });
    router.replace(`/create/?doc=${draftId}`);
  }

  function startNewDocument() {
    // Leaving ?doc= opens a new session by itself; on an unsaved document's URL, remount directly.
    if (docParam === null) setSession(openSession(session.key + 1, null));
    else router.push("/create/");
  }

  return (
    <Creator
      key={session.key}
      {...props}
      savedDraftId={session.load}
      onSaved={handleSaved}
      onNewDocument={startNewDocument}
    />
  );
}

type Loaded = { status: "loading" } | { status: "ready"; messages?: ChatMessage[] } | { status: "error"; message: string };

function Creator({
  registry,
  templates,
  savedDraftId,
  onSaved,
  onNewDocument,
}: Props & { savedDraftId: number | null; onSaved: (draftId: number) => void; onNewDocument: () => void }) {
  const userEmail = useRequireUser();
  const [state, setState] = useState(NO_DOCUMENT);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Loaded>(savedDraftId === null ? { status: "ready" } : { status: "loading" });

  useEffect(() => {
    if (!userEmail || savedDraftId === null) return;
    let cancelled = false;
    getDraft(savedDraftId).then(
      (draft) => {
        if (cancelled) return;
        setState({ documentId: draft.documentId, values: draft.values });
        setDraftId(draft.id);
        setLoaded({ status: "ready", messages: draft.messages });
      },
      (e: Error) => !cancelled && setLoaded({ status: "error", message: e.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [userEmail, savedDraftId]);

  // Render nothing until the session is known, so signed-out visitors never see the app.
  if (!userEmail) return null;

  const doc = findDocument(registry, state.documentId);

  function handleChange(next: typeof state, savedId: number | null) {
    setState(next);
    setDraftId(savedId);
    if (savedId !== null) onSaved(savedId);
  }

  return (
    // On large screens the page fits the viewport: the chat and preview scroll independently,
    // so the message box always stays in view. Print falls back to normal document flow.
    <div className="flex min-h-screen flex-col lg:h-screen print:block print:h-auto">
      <AppHeader userEmail={userEmail} current="create" onNewDocument={onNewDocument} />

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 print:hidden">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-brand-navy">Document Creator</h1>
          <p className="truncate text-sm text-brand-gray" aria-live="polite">
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
          {draftId !== null && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0z" />
              </svg>
              Saved to My documents
            </span>
          )}
          <button
            type="button"
            disabled={!doc}
            onClick={() => doc && downloadPdf(doc.name.replace(/\s+/g, "-"))}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PDF
          </button>
        </div>
      </div>

      <Disclaimer />

      <main className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:grid-rows-1 print:block">
        <aside className="border-b border-slate-200 bg-white lg:min-h-0 lg:border-r lg:border-b-0 print:hidden">
          {loaded.status === "ready" ? (
            <DocumentChat
              greeting={buildGreeting(registry.documents)}
              initialMessages={loaded.messages}
              document={state}
              draftId={draftId}
              onChange={handleChange}
            />
          ) : loaded.status === "loading" ? (
            <p className="p-6 text-sm text-brand-gray" role="status">
              Loading your document…
            </p>
          ) : (
            <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
              <p>{loaded.message}</p>
              <p className="mt-3 flex gap-4">
                <Link href="/documents/" className="font-medium text-brand-primary hover:underline">
                  Back to My documents
                </Link>
                <button type="button" onClick={onNewDocument} className="font-medium text-brand-primary hover:underline">
                  Start a new document
                </button>
              </p>
            </div>
          )}
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
            <div className="mx-auto max-w-3xl">
              <h2 className="text-base font-semibold text-brand-navy">Documents you can draft</h2>
              <p className="mt-1 text-sm text-brand-gray">
                Describe your deal in the chat, for example &ldquo;an NDA with Globex&rdquo;, and the preview appears here.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {registry.documents.map((d) => (
                  <li key={d.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-brand-gray">{d.description}</p>
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
