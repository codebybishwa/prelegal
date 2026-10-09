import type { Metadata } from "next";
import DocumentsList from "@/components/DocumentsList";
import { readRegistry } from "@/lib/templates";

export const metadata: Metadata = {
  title: "My documents | PreLegal",
};

// Read at build time, for the documents' names.
const registry = readRegistry();

export default function DocumentsPage() {
  return <DocumentsList documents={registry.documents} />;
}
