import { DRAFT_DISCLAIMER } from "@/lib/disclaimer";

/** The "drafts are subject to legal review" notice, as an on-screen banner (the document prints its own). */
export default function Disclaimer() {
  return (
    <div
      role="note"
      className="flex items-start gap-2 border-b border-brand-accent/60 bg-brand-accent/15 px-4 py-2 text-xs text-brand-navy sm:px-6 print:hidden"
    >
      <svg viewBox="0 0 20 20" className="mt-px h-4 w-4 shrink-0 fill-brand-secondary" aria-hidden="true">
        <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3.5a1 1 0 0 1 1 1V10a1 1 0 1 1-2 0V6.5a1 1 0 0 1 1-1zm0 7.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z" />
      </svg>
      <p>
        <span className="font-semibold">Draft only.</span> {DRAFT_DISCLAIMER}
      </p>
    </div>
  );
}
