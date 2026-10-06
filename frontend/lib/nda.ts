export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type NdaData = {
  purpose: string;
  /** ISO date (yyyy-mm-dd), or empty if not chosen yet. */
  effectiveDate: string;
  /** Years until the MNDA expires, or null if it continues until terminated. */
  mndaTermYears: number | null;
  /** Years Confidential Information is protected, or null for perpetuity. */
  confidentialityYears: number | null;
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

const emptyParty: Party = { name: "", title: "", company: "", noticeAddress: "" };

export const defaultNdaData: NdaData = {
  purpose: "Evaluating whether to enter into a business relationship with the other party.",
  effectiveDate: "",
  mndaTermYears: 1,
  confidentialityYears: 1,
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: emptyParty,
  party2: emptyParty,
};

/** Escapes user input so it renders as literal text in markdown (and never as raw HTML). */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]<>()#+\-.!|~&]/g, "\\$&");
}

/** User text as markdown paragraph content, or the template's placeholder if blank. */
function inline(value: string, placeholder: string): string {
  const text = value.trim();
  if (!text) return placeholder;
  return text.split(/\r?\n/).map(escapeMarkdown).join("  \n");
}

/** User text as a single table cell. */
function cell(value: string): string {
  return value.trim().split(/\r?\n/).map(escapeMarkdown).join("<br>");
}

function years(n: number): string {
  return `${n} year${n === 1 ? "" : "s"}`;
}

function checkbox(checked: boolean): string {
  return checked ? "- [x]" : "- [ ]";
}

export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { dateStyle: "long" });
}

/**
 * Fills the Common Paper Mutual NDA cover page template with the user's data.
 * Throws if the template no longer contains an expected placeholder, so template
 * edits that break the form are caught rather than silently ignored.
 */
export function fillCoverPage(template: string, data: NdaData): string {
  const { party1: p1, party2: p2 } = data;
  const mndaTerm = data.mndaTermYears;
  const confidentiality = data.confidentialityYears;

  const replacements: [string, string][] = [
    [
      "[Evaluating whether to enter into a business relationship with the other party.]",
      inline(data.purpose, "\\[Purpose\\]"),
    ],
    [
      "[Today’s date]",
      data.effectiveDate ? formatDate(data.effectiveDate) : "\\[Effective Date\\]",
    ],
    [
      "- [x]     Expires [1 year(s)] from Effective Date.\n" +
        "- [ ]     Continues until terminated in accordance with the terms of the MNDA.",
      `${checkbox(mndaTerm !== null)} Expires ${mndaTerm !== null ? years(mndaTerm) : "\\[1 year(s)\\]"} from Effective Date.\n` +
        `${checkbox(mndaTerm === null)} Continues until terminated in accordance with the terms of the MNDA.`,
    ],
    [
      "- [x]     [1 year(s)] from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.\n" +
        "- [ ]     In perpetuity.",
      `${checkbox(confidentiality !== null)} ${confidentiality !== null ? years(confidentiality) : "\\[1 year(s)\\]"} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.\n` +
        `${checkbox(confidentiality === null)} In perpetuity.`,
    ],
    ["[Fill in state]", inline(data.governingLaw, "\\[Governing Law\\]")],
    [
      "[Fill in city or county and state, i.e. “courts located in New Castle, DE”]",
      inline(data.jurisdiction, "\\[Jurisdiction\\]"),
    ],
    ["List any modifications to the MNDA", inline(data.modifications, "None.")],
    ["| Print Name | |", `| Print Name | ${cell(p1.name)} | ${cell(p2.name)} |`],
    ["| Title | | |", `| Title | ${cell(p1.title)} | ${cell(p2.title)} |`],
    ["| Company | | |", `| Company | ${cell(p1.company)} | ${cell(p2.company)} |`],
    [
      "| Notice Address <label>Use either email or postal address</label> | | |",
      `| Notice Address <label>Use either email or postal address</label> | ${cell(p1.noticeAddress)} | ${cell(p2.noticeAddress)} |`,
    ],
  ];

  let result = template.replace(/\r\n/g, "\n");
  for (const [placeholder, value] of replacements) {
    if (!result.includes(placeholder)) {
      throw new Error(`Mutual NDA cover page template is missing placeholder: ${placeholder}`);
    }
    // Function replacer so "$" in user input is never treated as a replacement pattern.
    result = result.replace(placeholder, () => value);
  }
  return result;
}
