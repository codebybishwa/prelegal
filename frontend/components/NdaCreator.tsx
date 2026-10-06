"use client";

import { useState } from "react";
import NdaForm from "@/components/NdaForm";
import NdaPreview from "@/components/NdaPreview";
import { defaultNdaData, fillCoverPage } from "@/lib/nda";

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
  const coverPage = fillCoverPage(coverPageTemplate, data);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 print:hidden">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Mutual NDA Creator</h1>
          <p className="text-sm text-slate-500">
            Fill in the key terms and download a completed Common Paper Mutual NDA.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadPdf}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Download PDF
        </button>
      </header>

      <main className="grid flex-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] print:block">
        <aside className="border-b border-slate-200 bg-white p-6 lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:border-r lg:border-b-0 print:hidden">
          <NdaForm data={data} onChange={setData} />
        </aside>
        <section className="bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0" aria-label="Document preview">
          <NdaPreview coverPage={coverPage} standardTerms={standardTerms} />
        </section>
      </main>
    </div>
  );
}
