import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultNdaData, escapeMarkdown, fillCoverPage, formatDate, type NdaData } from "./nda";

const template = readFileSync(
  path.join(import.meta.dirname, "..", "..", "templates", "Mutual-NDA-coverpage.md"),
  "utf-8",
);

const filled: NdaData = {
  purpose: "Exploring a joint venture.",
  effectiveDate: "2026-10-06",
  mndaTermYears: 2,
  confidentialityYears: 3,
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  modifications: "Section 5 is amended.",
  party1: { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "ada@acme.com" },
  party2: { name: "Alan Turing", title: "CTO", company: "Globex", noticeAddress: "alan@globex.com" },
};

describe("fillCoverPage", () => {
  it("fills every field into the real template", () => {
    const md = fillCoverPage(template, filled);

    expect(md).toContain("Exploring a joint venture\\.");
    expect(md).toContain("October 6, 2026");
    expect(md).toContain("- [x] Expires 2 years from Effective Date.");
    expect(md).toContain("- [ ] Continues until terminated");
    expect(md).toContain("- [x] 3 years from Effective Date");
    expect(md).toContain("- [ ] In perpetuity.");
    expect(md).toContain("Governing Law: Delaware");
    expect(md).toContain("Jurisdiction: courts located in New Castle, DE");
    expect(md).toContain("Section 5 is amended\\.");
    expect(md).toContain("| Print Name | Ada Lovelace | Alan Turing |");
    expect(md).toContain("| Company | Acme Inc\\. | Globex |");
    expect(md).toContain("| ada@acme\\.com | alan@globex\\.com |");
    expect(md).not.toContain("[Fill in state]");
  });

  it("checks the open-ended options when no term is given", () => {
    const md = fillCoverPage(template, { ...filled, mndaTermYears: null, confidentialityYears: null });

    expect(md).toContain("- [ ] Expires \\[1 year(s)\\] from Effective Date.");
    expect(md).toContain("- [x] Continues until terminated");
    expect(md).toContain("- [x] In perpetuity.");
  });

  it("uses singular 'year' for a one-year term", () => {
    expect(fillCoverPage(template, defaultNdaData)).toContain("Expires 1 year from Effective Date.");
  });

  it("keeps visible placeholders for blank fields", () => {
    const md = fillCoverPage(template, { ...defaultNdaData, purpose: "  " });

    expect(md).toContain("\\[Purpose\\]");
    expect(md).toContain("\\[Effective Date\\]");
    expect(md).toContain("Governing Law: \\[Governing Law\\]");
    expect(md).toContain("None.");
  });

  it("escapes user input and keeps table cells on one line", () => {
    const md = fillCoverPage(template, {
      ...filled,
      governingLaw: "<script>alert(1)</script> $&",
      party1: { ...filled.party1, noticeAddress: "1 Main St\nSpringfield | IL" },
    });

    expect(md).not.toContain("<script>");
    expect(md).toContain("$\\&");
    expect(md).toContain("1 Main St<br>Springfield \\| IL");
  });

  it("handles CRLF line endings", () => {
    expect(() => fillCoverPage(template.replace(/\r?\n/g, "\r\n"), filled)).not.toThrow();
  });

  it("throws when the template is missing a placeholder", () => {
    expect(() => fillCoverPage("# Not the cover page", filled)).toThrow(/missing placeholder/);
  });
});

describe("escapeMarkdown", () => {
  it("backslash-escapes markdown and HTML punctuation", () => {
    expect(escapeMarkdown("*a* [b](c) <d>")).toBe("\\*a\\* \\[b\\]\\(c\\) \\<d\\>");
  });
});

describe("formatDate", () => {
  it("formats an ISO date without timezone shift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });
});
