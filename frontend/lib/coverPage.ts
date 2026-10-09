import { formatValue, PARTY_IDS, type DocumentDef, type Registry, type Values } from "@/lib/documents";
import { cell, escapeMarkdown } from "@/lib/markdown";
import { fillCoverPage, toNdaData } from "@/lib/nda";

/**
 * The cover page as markdown: the document's own cover page template filled in when it has
 * one (the Mutual NDA), otherwise one generated from its key terms and parties.
 */
export function renderCoverPage(
  registry: Registry,
  doc: DocumentDef,
  values: Values,
  coverPageTemplate: string | undefined,
): string {
  return coverPageTemplate ? fillCoverPage(coverPageTemplate, toNdaData(values)) : buildCoverPage(registry, doc, values);
}

/** A Common Paper style cover page: a key terms table and a signature block for both parties. */
export function buildCoverPage(registry: Registry, doc: DocumentDef, values: Values): string {
  const keyTerms = doc.fields.map((key) => {
    const field = registry.fields[key];
    const value = formatValue(field, values[key]);
    const shown = value ? cell(value) : field.optional ? "None" : `\\[${escapeMarkdown(field.label)}\\]`;
    return `| ${field.label} | ${shown} |`;
  });

  const signatures = [
    "| Signature | | |",
    ...registry.partyFields.map(
      (field) => `| ${field.label} | ${PARTY_IDS.map((id) => cell(values[`${id}.${field.key}`] ?? "")).join(" | ")} |`,
    ),
    "| Date | | |",
  ];

  return [
    `# ${doc.name}`,
    "## Cover Page",
    `This ${doc.name} consists of this Cover Page and the Common Paper ${doc.name} Standard Terms that follow. ` +
      "The key terms below complete the Standard Terms, and this Cover Page controls over any conflict with them.",
    "### Key Terms",
    // The wrapper lets the stylesheet tell this table from the signature table.
    '<div class="key-terms">',
    ["| Term | Value |", "| :--- | :--- |", ...keyTerms].join("\n"),
    "</div>",
    `By signing this Cover Page, each party agrees to enter into this ${doc.name}.`,
    [`|| ${doc.parties.map((role) => role.toUpperCase()).join(" | ")} |`, "|:--- | :----: | :----: |", ...signatures].join(
      "\n",
    ),
    `Common Paper ${doc.name} free to use under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).`,
  ].join("\n\n");
}
