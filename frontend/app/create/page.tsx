import type { Metadata } from "next";
import DocumentCreator from "@/components/DocumentCreator";
import { readDocumentTemplates, readRegistry } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Document Creator | PreLegal",
  description: "Chat with AI to draft a completed Common Paper legal agreement and download it as a PDF.",
};

// Read at module scope so the definitions and templates are baked into the static page at build time.
const registry = readRegistry();
const templates = readDocumentTemplates(registry);

export default function CreatePage() {
  return <DocumentCreator registry={registry} templates={templates} />;
}
