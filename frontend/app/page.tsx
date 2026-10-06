import NdaCreator from "@/components/NdaCreator";
import { readTemplate } from "@/lib/templates";

// Read at module scope so the templates are baked into the static page at build time.
const coverPageTemplate = readTemplate("Mutual-NDA-coverpage.md");
const standardTerms = readTemplate("Mutual-NDA.md");

export default function Home() {
  return <NdaCreator coverPageTemplate={coverPageTemplate} standardTerms={standardTerms} />;
}
