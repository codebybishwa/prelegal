"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NdaChat from "@/components/NdaChat";
import NdaPreview from "@/components/NdaPreview";
import { applyUpdates } from "@/lib/chat";
import { defaultNdaData, fillCoverPage } from "@/lib/nda";
import { signOut } from "@/lib/session";
import { useRequireUser } from "@/lib/useRequireUser";

type Props = {
  coverPageTemplate: string;
  standardTerms: string;
};

/** Saves the document as PDF through the browser's print dialog ("Save as PDF"). */
function downloadPdf() {
  const originalTitle = document.title;
  // Browsers use the page title as the default PDF filename.
  document.title = "Mutual-NDA";
  window.addEventListener("afterprint", () => (document.title = originalTitle), { once: true });
  window.print();
}

export default function NdaCreator({ coverPageTemplate, standardTerms }: Props) {
  const [data, setData] = useState(defaultNdaData);
  const userEmail = useRequireUser();
  const router = useRouter();

  // Render nothing until the session is known, so signed-out visitors never see the app.
  if (!userEmail) return null;

  const coverPage = fillCoverPage(coverPageTemplate, data);

  function handleSignOut() {
    signOut();
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-brand-accent bg-white px-6 py-4 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-brand-navy">Mutual NDA Creator</h1>
          <p className="text-sm text-brand-gray">
            Chat with the AI to fill in the key terms, then download a completed Common Paper Mutual NDA.
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
            onClick={downloadPdf}
            className="rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Download PDF
          </button>
        </div>
      </header>

      <main className="grid flex-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] print:block">
        <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-r lg:border-b-0 print:hidden">
          <NdaChat data={data} onUpdate={(updates) => setData((current) => applyUpdates(current, updates))} />
        </aside>
        <section className="bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0" aria-label="Document preview">
          <NdaPreview coverPage={coverPage} standardTerms={standardTerms} />
        </section>
      </main>
    </div>
  );
}
