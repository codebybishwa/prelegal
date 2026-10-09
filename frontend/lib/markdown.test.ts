import { describe, expect, it } from "vitest";
import { cell, escapeMarkdown, formatDate, inline, years } from "./markdown";

describe("escapeMarkdown", () => {
  it("backslash-escapes markdown and HTML punctuation", () => {
    expect(escapeMarkdown("*a* [b](c) <d>")).toBe("\\*a\\* \\[b\\]\\(c\\) \\<d\\>");
  });
});

describe("inline and cell", () => {
  it("keeps line breaks within a paragraph or a table cell", () => {
    expect(inline("a\nb", "x")).toBe("a  \nb");
    expect(inline("  ", "\\[Purpose\\]")).toBe("\\[Purpose\\]");
    expect(cell(" 1 Main St\nSpringfield | IL ")).toBe("1 Main St<br>Springfield \\| IL");
  });
});

describe("formatDate", () => {
  it("formats an ISO date without timezone shift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });
});

describe("years", () => {
  it("pluralizes", () => {
    expect(years(1)).toBe("1 year");
    expect(years(3)).toBe("3 years");
  });
});
