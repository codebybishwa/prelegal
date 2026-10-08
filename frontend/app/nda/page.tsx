import type { Metadata } from "next";
import NdaCreator from "@/components/NdaCreator";
import { readTemplate } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Mutual NDA Creator | PreLegal",
  description: "Create a completed Common Paper Mutual Non-Disclosure Agreement and download it as a PDF.",
};

// Read at module scope so the templates are baked into the static page at build time.
const coverPageTemplate = readTemplate("Mutual-NDA-coverpage.md");
const standardTerms = readTemplate("Mutual-NDA.md");

export default function NdaPage() {
  return <NdaCreator coverPageTemplate={coverPageTemplate} standardTerms={standardTerms} />;
}
