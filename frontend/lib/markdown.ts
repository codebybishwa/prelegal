/** Helpers for writing user input into agreement markdown safely and readably. */

/** Escapes user input so it renders as literal text in markdown (and never as raw HTML). */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]<>()#+\-.!|~&]/g, "\\$&");
}

/** User text as markdown paragraph content, or the placeholder if blank. */
export function inline(value: string, placeholder: string): string {
  const text = value.trim();
  if (!text) return placeholder;
  return text.split(/\r?\n/).map(escapeMarkdown).join("  \n");
}

/** User text as a single table cell. */
export function cell(value: string): string {
  return value.trim().split(/\r?\n/).map(escapeMarkdown).join("<br>");
}

export function years(n: number): string {
  return `${n} year${n === 1 ? "" : "s"}`;
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { dateStyle: "long" });
}
