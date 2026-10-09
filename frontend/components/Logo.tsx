/** The PreLegal mark and wordmark. `inverted` is for dark backgrounds. */
export default function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-brand-primary" />
        <path d="M10 7h8l6 6v11a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" className="fill-white" />
        <path d="M18 7v6h6z" className="fill-brand-accent" />
        <path d="M12 17h8M12 21h5" strokeWidth="1.8" strokeLinecap="round" className="stroke-brand-secondary" />
      </svg>
      <span className={`text-lg font-semibold tracking-tight ${inverted ? "text-white" : "text-brand-navy"}`}>
        PreLegal
      </span>
    </span>
  );
}
