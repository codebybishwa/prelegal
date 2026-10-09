import { describe, expect, it } from "vitest";
import { buildCoverPage, renderCoverPage } from "./coverPage";
import { findDocument, formatValue, type DocumentDef } from "./documents";
import { readDocumentTemplates, readRegistry } from "./templates";

const registry = readRegistry();
const templates = readDocumentTemplates(registry);
const doc = (id: string) => findDocument(registry, id) as DocumentDef;

describe("buildCoverPage", () => {
  const pilot = doc("pilot-agreement");

  it("lists the key terms and both parties' details", () => {
    const md = buildCoverPage(registry, pilot, {
      effectiveDate: "2026-10-06",
      pilotPeriod: "60 days",
      governingLaw: "Delaware",
      "party1.name": "Ada Lovelace",
      "party1.company": "Acme Inc.",
      "party2.company": "Globex",
    });

    expect(md).toContain("# Pilot Agreement");
    expect(md).toContain("| Effective Date | October 6, 2026 |");
    expect(md).toContain("| Pilot Period | 60 days |");
    expect(md).toContain("| Governing Law | Delaware |");
    expect(md).toContain("|| PROVIDER | CUSTOMER |");
    expect(md).toContain("| Print Name | Ada Lovelace |  |");
    expect(md).toContain("| Company | Acme Inc\\. | Globex |");
  });

  it("shows placeholders for missing required terms and 'None' for blank optional ones", () => {
    const md = buildCoverPage(registry, doc("cloud-service-agreement"), {});

    expect(md).toContain("| Subscription Period | \\[Subscription Period\\] |");
    expect(md).toContain("| DPA | None |");
  });

  it("escapes user input and keeps table cells on one line", () => {
    const md = buildCoverPage(registry, pilot, {
      governingLaw: "<script>alert(1)</script>",
      "party1.noticeAddress": "1 Main St\nSpringfield | IL",
    });

    expect(md).not.toContain("<script>");
    expect(md).toContain("1 Main St<br>Springfield \\| IL");
  });
});

describe("renderCoverPage", () => {
  it("fills the Mutual NDA's own cover page template", () => {
    const md = renderCoverPage(registry, doc("mutual-nda"), { governingLaw: "Delaware", mndaTerm: "2" }, templates["mutual-nda"].coverPage);

    expect(md).toContain("USING THIS MUTUAL NON-DISCLOSURE AGREEMENT");
    expect(md).toContain("Governing Law: Delaware");
    expect(md).toContain("- [x] Expires 2 years from Effective Date.");
  });

  it.each(registry.documents.map((d) => d.id))("renders a cover page for %s", (id) => {
    const md = renderCoverPage(registry, doc(id), {}, templates[id].coverPage);

    expect(md.length).toBeGreaterThan(0);
    expect(templates[id].terms.length).toBeGreaterThan(0);
  });
});

describe("formatValue", () => {
  const term = registry.fields.mndaTerm;

  it("formats dates and terms, and leaves text as is", () => {
    expect(formatValue(registry.fields.effectiveDate, "2026-01-01")).toBe("January 1, 2026");
    expect(formatValue(term, "1")).toBe("1 year");
    expect(formatValue(term, "none")).toBe("Continues until terminated");
    expect(formatValue(registry.fields.governingLaw, " Delaware ")).toBe("Delaware");
    expect(formatValue(registry.fields.governingLaw, undefined)).toBe("");
  });
});
